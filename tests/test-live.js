// Live detections (SSE): the card opens one EventSource to BirdNET-Go's
// detections/stream endpoint after the first successful load and treats
// each 'detection' event as a pure "something changed, refetch" signal -
// same push-refresh path the MQTT sensor watcher uses (test-mqtt.js).
// Four scenarios: a detection event triggers a debounced refresh; an
// endpoint that fails before ever opening (404/401) gets exactly one
// retry (a startup race looks identical to a real 404/401 - EventSource
// exposes no HTTP status) and then gives up, no unbounded retry storm;
// config live:false never constructs an EventSource at all; and a second
// setConfig call while the card stays connected tears down the previous
// instance's live stream instead of leaking it.
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
let remaining = 4;
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

// --- Scenario B: immediate failure (404/401) -> one retry, then gives up ---
{
  const FailES = makeImmediateFailES();
  const { errors } = boot({}, FailES); // default config: live defaults true
  setTimeout(() => {
    try {
      // A failure before the very first onopen is indistinguishable from a
      // one-off startup race (BirdNET-Go/HA still coming up), so it gets
      // exactly one retry (first backoff ~5s) before being treated as
      // permanent. Wait past that retry and confirm there were exactly two
      // attempts total, then confirm no third ever follows (no unbounded
      // retry storm).
      assert.strictEqual(FailES.instances.length, 2, 'exactly one retry after the first pre-open failure: ' + FailES.instances.length);
      setTimeout(() => {
        try {
          assert.strictEqual(FailES.instances.length, 2, 'gives up after the second pre-open failure, no further attempts: ' + FailES.instances.length);
          assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
          scenarioDone('B: immediate 404/401 -> one retry then gives up OK');
        } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
      }, 15000);
    } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
  }, 9000);
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

// --- Scenario D: setConfig while connected tears down the old live stream ---
// Regression test for the setConfig reboot path leaking the previous
// instance's EventSource (it only ever closed on disconnectedCallback,
// never on a reconfigure-while-connected - the dashboard editor's live
// preview calls setConfig on every keystroke).
{
  const StubES = makeStubES();
  const { card, errors } = boot({}, StubES); // default config: live defaults true
  setTimeout(() => {
    try {
      assert.strictEqual(StubES.instances.length, 1, 'one EventSource opened after first boot: ' + StubES.instances.length);
      const first = StubES.instances[0];
      first.__open();
      card.setConfig({ title: 'renamed' });
      assert.strictEqual(first.closed, true, 'previous EventSource closed by the reconfigure, not orphaned');
      setTimeout(() => {
        try {
          assert.strictEqual(StubES.instances.length, 2, 'the rebooted instance opens its own EventSource: ' + StubES.instances.length);
          assert.notStrictEqual(StubES.instances[1], first, 'a fresh EventSource, not the old one reused');
          assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
          scenarioDone('D: setConfig reconfigure closes the previous live stream OK');
        } catch (e) { console.error('D FAIL:', e.message); process.exit(1); }
      }, 1700);
    } catch (e) { console.error('D FAIL:', e.message); process.exit(1); }
  }, 1700);
}
