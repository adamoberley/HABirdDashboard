// Hardening against BirdNET-Go >=20260615 API/auth changes:
//   - api_token rides an Authorization: Bearer header on every BirdNET-Go
//     call (and ONLY BirdNET-Go calls - never Wikipedia/Xeno-Canto/HA).
//   - a 401 on the primary summary/daily fetches (Private Mode with no
//     token configured) surfaces a specific message instead of a silent
//     blank atlas.
//   - a detection's `source` field is accepted as either a plain string
//     or the {id,type,displayName} object BirdNET-Go's Aug 2026 release
//     sends, preferring displayName.
//   - an extended-capture clip's 503 + Retry-After is retried once before
//     falling through to the existing error path.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const assert = require('assert');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function baseBoot(fetchImpl, opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fetch = fetchImpl;
  window.Audio = class { constructor(){ this.crossOrigin=null; } addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 600; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  if (opts.windowSetup) opts.windowSetup(window);
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  card.setConfig(Object.assign({ data_source: 'api' }, opts.config || {}));
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  return { window, card };
}

const summary = [
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.95 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));

let done = 0;
const TOTAL = 4;
function pass(name) { console.log(name + ' OK'); if (++done === TOTAL) console.log('\nAPI HARDENING TESTS PASSED'); }
function fail(name, e) { console.error(name + ' FAIL:', e.message); process.exit(1); }

// --- A: Bearer header on BirdNET-Go calls, absent from Wikipedia ---
(function () {
  const calls = [];
  const fetchImpl = (url, opts) => {
    calls.push({ url: String(url), headers: (opts && opts.headers) || null });
    const u = String(url);
    const p = u.replace('http://ha.local:8080', '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (u.startsWith('https://en.wikipedia.org/')) return ok({ extract: 'A large corvid.' });
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections')) return ok({ data: [] });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  const { window, card } = baseBoot(fetchImpl, { config: { api_token: 'tok-secret-123' } });
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      // Open the detail modal so the Wikipedia fetch actually fires.
      root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
      setTimeout(() => {
        try {
          const bg = calls.filter(c => c.url.includes('/api/v2/'));
          assert.ok(bg.length > 0, 'at least one BirdNET-Go call made');
          bg.forEach(c => {
            assert.ok(c.headers && c.headers.Authorization === 'Bearer tok-secret-123',
              'missing/wrong bearer on ' + c.url + ': ' + JSON.stringify(c.headers));
          });
          const wiki = calls.filter(c => c.url.startsWith('https://en.wikipedia.org/'));
          assert.ok(wiki.length > 0, 'wikipedia call made');
          wiki.forEach(c => {
            assert.ok(!c.headers || !c.headers.Authorization,
              'bearer leaked onto wikipedia call: ' + JSON.stringify(c.headers));
          });
          pass('A: bearer attached to BirdNET-Go only');
        } catch (e) { fail('A', e); }
      }, 500);
    } catch (e) { fail('A', e); }
  }, 1700);
})();

// --- B: 401 on the primary summary/daily fetches -> Private Mode message ---
(function () {
  const fetchImpl = (url) => {
    const p = String(url).replace('http://ha.local:8080', '');
    const unauth = () => Promise.resolve({ ok: false, status: 401, json: () => Promise.reject(401) });
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (p.startsWith('/api/v2/analytics/species/summary')) return unauth();
    if (p.startsWith('/api/v2/analytics/species/daily')) return unauth();
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections')) return ok({ data: [] });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  const { card } = baseBoot(fetchImpl);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      const grid = root.getElementById('atlasGrid');
      assert.ok(grid.textContent.indexOf('Private Mode') >= 0,
        'private-mode message shown: ' + grid.textContent);
      assert.ok(grid.textContent.indexOf('No birds detected yet') < 0,
        'generic empty copy suppressed: ' + grid.textContent);
      pass('B: 401 surfaces the Private Mode message');
    } catch (e) { fail('B', e); }
  }, 1700);
})();

// --- C: detection source as a string vs {id,type,displayName} object ---
(function () {
  const fetchImpl = (url) => {
    const p = String(url).replace('http://ha.local:8080', '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections?queryType=search')) return ok({ data: [
      { id: 101, date: '2026-06-10', time: '08:20:00', scientificName: 'Corvus corax', commonName: 'Common Raven', confidence: 0.71, source: { id: 'mic-1', type: 'rtsp', displayName: 'Backyard Mic' } },
      { id: 102, date: '2026-06-09', time: '07:10:00', scientificName: 'Corvus corax', commonName: 'Common Raven', confidence: 0.65, source: 'Balcony Mic' },
    ] });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  const { window, card } = baseBoot(fetchImpl);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
      setTimeout(() => {
        try {
          const rows = [...root.querySelectorAll('#modalRecordings .rec-row')];
          const objectSourced = rows.find(r => r.getAttribute('data-file') === '101');
          const stringSourced = rows.find(r => r.getAttribute('data-file') === '102');
          assert.ok(objectSourced, 'row 101 rendered');
          assert.ok(stringSourced, 'row 102 rendered');
          assert.strictEqual(objectSourced.getAttribute('data-source'), 'Backyard Mic', 'object source -> displayName');
          assert.strictEqual(stringSourced.getAttribute('data-source'), 'Balcony Mic', 'string source passes through');
          pass('C: source string/object both render');
        } catch (e) { fail('C', e); }
      }, 900);
    } catch (e) { fail('C', e); }
  }, 1700);
})();

// --- D: audio clip 503 + Retry-After retries once, then succeeds ---
(function () {
  let audioCalls = 0;
  const fetchImpl = (url) => {
    const p = String(url).replace('http://ha.local:8080', '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections?queryType=search')) return ok({ data: [
      { id: 103, date: '2026-06-10', time: '08:20:00', scientificName: 'Corvus corax', commonName: 'Common Raven', confidence: 0.71 },
    ] });
    if (p.startsWith('/api/v2/audio/')) {
      audioCalls++;
      if (audioCalls === 1) {
        return Promise.resolve({ ok: false, status: 503, headers: { get: (h) => (h === 'Retry-After' ? '1' : null) } });
      }
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  const { window, card } = baseBoot(fetchImpl, { config: {} });
  // Spectrogram decode needs a WebAudio context; the actual pixel paint is
  // scheduled via requestAnimationFrame - no-op it so this test only
  // exercises the fetch/retry/decode chain, not canvas rendering.
  window.AudioContext = class {
    decodeAudioData() { return Promise.resolve({ sampleRate: 44100, getChannelData: () => new Float32Array(2048) }); }
  };
  window.requestAnimationFrame = function () {};
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
      setTimeout(() => {
        try {
          const row = root.querySelector('#modalRecordings .rec-row[data-file="103"]');
          assert.ok(row, 'recording row rendered');
          row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
          setTimeout(() => {
            try {
              assert.strictEqual(audioCalls, 2, 'exactly one retry after the 503: ' + audioCalls);
              const loadingEl = row.querySelector('.rec-spectro-loading');
              assert.strictEqual(loadingEl.style.display, 'none', 'decode succeeded after retry (loading indicator cleared)');
              pass('D: 503 + Retry-After retried once then succeeded');
              setTimeout(() => process.exit(0), 100);
            } catch (e) { fail('D', e); }
          }, 2200);
        } catch (e) { fail('D', e); }
      }, 900);
    } catch (e) { fail('D', e); }
  }, 1700);
})();
