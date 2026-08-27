// Private Mode clip playback: a bare `<audio src=...>` can never carry the
// Authorization: Bearer header BirdNET-Go's Private Mode requires (unlike
// the spectrogram decode path, which already fetches through bgFetch), so
// tapping "play" on a detection would silently 401 even with a correctly
// configured api_token. makeAudio() now routes playback through a fetched
// blob (reusing bgAudioFetch, same as the spectrogram) when a token is
// configured, and only then. This test drives the modal's play button and
// asserts the audio clip request carried the bearer header and the <audio>
// element ended up pointed at a blob: URL, never the raw (401-prone) API
// URL.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const assert = require('assert');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const summary = [
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.95 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));

// A fuller <audio> stub than the other suites need: makeAudio() sets .src
// asynchronously (after the authorized blob fetch resolves) and dispatches
// a synthetic 'error' event on failure, so the stub has to actually track
// listeners and the assigned src instead of no-op'ing everything.
class StubAudio {
  constructor() {
    this._src = '';
    this._listeners = {};
    this.crossOrigin = null;
    this.currentTime = 0;
    this.duration = 0;
    this.paused = true;
    StubAudio.instances.push(this);
  }
  set src(v) { this._src = v; }
  get src() { return this._src; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  dispatchEvent(evt) { (this._listeners[evt.type] || []).forEach((fn) => fn(evt)); return true; }
  load() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
StubAudio.instances = [];

function boot(fetchImpl, config) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fetch = fetchImpl;
  window.Audio = StubAudio;
  // jsdom has no createObjectURL/revokeObjectURL implementation.
  window.URL.createObjectURL = (blob) => 'blob:stub/' + (blob && blob.__id || 'x');
  window.URL.revokeObjectURL = () => {};
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 600; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  card.setConfig(Object.assign({ data_source: 'api', api_token: 'tok-secret-123' }, config || {}));
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  return { window, card };
}

const calls = [];
const fetchImpl = (url, opts) => {
  const u = String(url);
  calls.push({ url: u, headers: (opts && opts.headers) || null });
  const p = u.replace('http://ha.local:8080', '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
  if (p.includes('/analytics/')) return ok({ data: [] });
  if (p.includes('/detections?queryType=search')) return ok({ data: [
    { id: 201, date: '2026-06-10', time: '08:20:00', scientificName: 'Corvus corax', commonName: 'Common Raven', confidence: 0.71 },
  ] });
  if (p.startsWith('/api/v2/audio/')) {
    const blob = { __id: '201', size: 8, type: 'audio/wav' };
    return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(blob) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
};

const { window, card } = boot(fetchImpl);

setTimeout(() => {
  try {
    const root = card.shadowRoot;
    root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const row = root.querySelector('#modalRecordings .rec-row[data-file="201"]');
        assert.ok(row, 'recording row rendered');
        const playBtn = row.querySelector('.play');
        assert.ok(playBtn, 'play button rendered');
        playBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        setTimeout(() => {
          try {
            const audioCalls = calls.filter((c) => c.url.includes('/api/v2/audio/'));
            assert.ok(audioCalls.length > 0, 'clip audio was fetched (not left to a bare <audio src>)');
            audioCalls.forEach((c) => {
              assert.ok(c.headers && c.headers.Authorization === 'Bearer tok-secret-123',
                'clip fetch carried the bearer header: ' + JSON.stringify(c.headers));
            });
            const clipAudio = StubAudio.instances[StubAudio.instances.length - 1];
            assert.ok(clipAudio, 'an <audio> element was created for the clip');
            assert.ok(/^blob:/.test(clipAudio.src),
              'audio element points at a fetched blob, not the raw (401-prone) API URL: ' + clipAudio.src);
            console.log('AUTHORIZED CLIP PLAYBACK TEST PASSED');
            process.exit(0);
          } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
        }, 600);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 900);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
