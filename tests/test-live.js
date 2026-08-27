// Live detections (SSE): the card opens one EventSource to BirdNET-Go's
// detections/stream endpoint after the first successful load and treats
// each 'detection' event as a pure "something changed, refetch" signal -
// same push-refresh path the MQTT sensor watcher uses (test-mqtt.js).
// Three scenarios: a detection event triggers a debounced refresh; an
// endpoint that fails before ever opening (404/401) never reconnects
// (no retry storm); config live:false never constructs an EventSource
// at all.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));

// A stubbed EventSource: jsdom has no real implementation. Tracks every
// instance constructed (so a test can assert a bounded count - "no retry
// storm") and exposes __open/__detect/__error so a test can drive it by
// hand instead of needing a real HTTP server.
function makeStubES() {
  class StubES {
    constructor(url) {
      this.url = url;
      this._listeners = {};
      this.onopen = null;
      this.onerror = null;
      this.closed = false;
      StubES.instances.push(this);
    }
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    close() { this.closed = true; }
    __open() { if (this.onopen) this.onopen(); }
    __detect() { (this._listeners.detection || []).forEach((fn) => fn({})); }
    __error() { if (this.onerror) this.onerror(); }
  }
  StubES.instances = [];
  return StubES;
}

// A stub that behaves like BirdNET-Go returning 404 (old server) or 401
// (Private Mode): EventSource can't read the HTTP status itself, so both
// surface identically - the connection fails before onopen ever fires.
function makeImmediateFailES() {
  class FailES {
    constructor(url) {
      this.url = url;
      this._listeners = {};
      this.onopen = null;
      this.onerror = null;
      FailES.instances.push(this);
      // Real EventSource failures are async (network round-trip); a
      // setTimeout keeps this stub honest about that instead of firing
      // synchronously inside the constructor.
      setTimeout(() => { if (this.onerror) this.onerror(); }, 0);
    }
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    close() {}
  }
  FailES.instances = [];
  return FailES;
}

function boot(config, ESClass) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', (e) => errors.push((e.error && e.error.stack) || e.message));
  let summaryCalls = 0;
  window.fetch = (url) => {
    const p = String(url).replace('http://ha.local:8080', '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (p.startsWith('/api/v2/analytics/species/summary')) { summaryCalls++; return ok(summary); }
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections')) return ok({ data: [] });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.EventSource = ESClass;
  window.eval(CARD);

  const card = window.document.createElement('habird-card');
  card.setConfig(config);
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  return { window, card, errors, getSummaryCalls: () => summaryCalls };
}

const assert = require('assert');
let remaining = 3;
function scenarioDone(label) {
  console.log(label);
  if (--remaining === 0) { console.log('\nLIVE SSE TESTS PASSED'); process.exit(0); }
}

// --- Scenario A: detection event -> debounced push-refresh ---
{
  const StubES = makeStubES();
  const { errors, getSummaryCalls } = boot({}, StubES); // default config: live defaults true
  setTimeout(() => {
    try {
      assert.strictEqual(StubES.instances.length, 1, 'one EventSource opened after first load: ' + StubES.instances.length);
      const es = StubES.instances[0];
      assert.strictEqual(es.url, 'http://ha.local:8080/api/v2/detections/stream', 'stream URL: ' + es.url);
      es.__open();
      const before = getSummaryCalls();
      es.__detect();
      // Immediately after the event nothing has fetched yet - it's debounced.
      assert.strictEqual(getSummaryCalls(), before, 'refresh is debounced, not immediate');
      setTimeout(() => {
        try {
          assert.ok(getSummaryCalls() > before, 'detection event triggered a refresh: ' + before + ' -> ' + getSummaryCalls());
          assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
          scenarioDone('A: detection event -> push refresh OK');
        } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
      }, 2300); // > the 2s debounce
    } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
  }, 1700);
}

// --- Scenario B: immediate failure (404/401) -> no reconnect storm ---
{
  const FailES = makeImmediateFailES();
  const { errors } = boot({}, FailES); // default config: live defaults true
  setTimeout(() => {
    try {
      // First backoff attempt would land at 5s; wait well past it and
      // confirm nothing retried - a connection that fails before ever
      // opening is treated as permanent for this boot (old BirdNET-Go /
      // Private Mode), not a transient drop.
      assert.strictEqual(FailES.instances.length, 1, 'exactly one attempt, no retry storm: ' + FailES.instances.length);
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      scenarioDone('B: immediate 404/401 -> no reconnect OK');
    } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
  }, 7000);
}

// --- Scenario C: live:false -> EventSource never constructed ---
{
  const StubES = makeStubES();
  const { errors } = boot({ live: false }, StubES);
  setTimeout(() => {
    try {
      assert.strictEqual(StubES.instances.length, 0, 'live:false must never open a stream: ' + StubES.instances.length);
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      scenarioDone('C: live:false -> no EventSource OK');
    } catch (e) { console.error('C FAIL:', e.message); process.exit(1); }
  }, 1700);
}
