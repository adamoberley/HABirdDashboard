// Bird Card Proxy (#73): with the habird_proxy integration loaded, every
// BirdNET-Go call goes through HA's origin with HA's login - reads and
// audio via hass.fetchWithAuth, the live stream via a signed URL, review
// writes as a plain POST (the proxy does CSRF) - and nothing is fetched
// from BirdNET-Go directly. proxy: false restores the direct connection.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const summary = [
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.95 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '08:20:00' }));
function answer(p, opts) {
  const json = (b) => ({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))),
    blob: () => Promise.resolve({ size: 3 }), arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)), headers: { get: () => null } });
  if (p.startsWith('/api/v2/analytics/species/summary')) return json(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return json(daily);
  if (p.includes('/analytics/')) return json({ data: [] });
  if (p.includes('/detections?queryType=search')) return json({ data: [
    { id: 42, date: '2026-06-10', time: '08:20:00', scientificName: 'Corvus corax', commonName: 'Common Raven', confidence: 0.95 },
  ], total: 1 });
  if (p.includes('/audio/')) return json({});
  if (p.endsWith('/review') && opts && opts.method === 'POST') return json({ ok: true });
  return { ok: false, status: 404, json: () => Promise.reject(404), headers: { get: () => null } };
}

function boot(config) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.ui.nabu.casa/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  const log = { direct: [], viaHa: [], signed: [], streams: [] };
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  window.fetch = (url, opts) => { log.direct.push(String(url)); return Promise.resolve(answer(String(url).replace(/^https?:\/\/[^/]+/, ''), opts)); };
  window.EventSource = class { constructor(u) { log.streams.push(u); } addEventListener() {} close() {} };
  window.URL.createObjectURL = () => 'blob:clip';
  window.Audio = class { addEventListener() {} load() {} play() { return Promise.resolve(); } pause() {} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe() {} disconnect() {} };
  window.eval(CARD);
  const hass = {
    themes: { darkMode: false },
    states: {},
    user: { is_admin: true },
    config: { components: ['http', 'habird_proxy'] },
    fetchWithAuth: (url, opts) => {
      log.viaHa.push({ url, opts: opts || {} });
      assert.ok(url.startsWith('/api/habird_proxy/api/v2/'), 'proxy path: ' + url);
      return Promise.resolve(answer(url.replace('/api/habird_proxy', ''), opts));
    },
    callWS: (msg) => {
      if (msg.type === 'auth/sign_path') { log.signed.push(msg); return Promise.resolve({ path: msg.path + '?authSig=SIG' }); }
      return Promise.reject(new Error('unexpected ' + msg.type));
    },
  };
  const card = window.document.createElement('habird-card');
  card.setConfig(Object.assign({ api_token: 'bng-token-should-stay-server-side' }, config));
  card.hass = hass;
  window.document.body.appendChild(card);
  return { window, card, log, errors };
}

const click = (window, el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));

const A = boot({});
const B = boot({ proxy: false, birdnet_url: 'http://birdnet.lan:8080' });

setTimeout(() => {
  try {
    const { window, card, log } = A;
    const root = card.shadowRoot;
    assert.strictEqual(root.querySelectorAll('.gtile').length, 1, 'collage rendered from proxied data');
    assert.ok(log.viaHa.length >= 2, 'reads went through hass.fetchWithAuth: ' + log.viaHa.length);
    assert.deepStrictEqual(log.direct.filter(u => /\/api\/v2\//.test(u)), [], 'no direct BirdNET-Go fetches: ' + log.direct);
    assert.ok(log.viaHa.every(c => !JSON.stringify(c.opts.headers || {}).includes('bng-token')), 'api_token never sent from the browser');
    // Live stream: signed URL, then EventSource on it.
    assert.strictEqual(log.signed.length, 1, 'one sign_path request');
    assert.strictEqual(log.signed[0].path, '/api/habird_proxy/api/v2/detections/stream');
    assert.deepStrictEqual(log.streams, ['/api/habird_proxy/api/v2/detections/stream?authSig=SIG'], 'stream opened on the signed URL');
    // Play is enabled (the API is reachable) and fetches the clip through HA.
    const play = root.querySelector('.bird-card .chip.play');
    assert.ok(play && !play.disabled, 'play enabled through the proxy');
    click(window, play);
    setTimeout(() => {
      try {
        assert.ok(log.viaHa.some(c => c.url === '/api/habird_proxy/api/v2/audio/42'), 'clip fetched through HA: ' + log.viaHa.map(c => c.url));
        // Review write-back: plain POST through the proxy, no ingress, no CSRF from the browser.
        click(window, root.querySelector('.bird-card'));
        setTimeout(() => {
          try {
            const flag = root.querySelector('#modalRecordings .rec-row .flag');
            assert.ok(flag, 'flag rendered');
            click(window, flag); click(window, flag);
            setTimeout(() => {
              try {
                const post = log.viaHa.find(c => c.opts.method === 'POST');
                assert.ok(post, 'review POSTed');
                assert.strictEqual(post.url, '/api/habird_proxy/api/v2/detections/42/review');
                assert.strictEqual(JSON.parse(post.opts.body).verified, 'false_positive');
                assert.strictEqual(flag.getAttribute('data-state'), 'done', 'flag done: ' + flag.getAttribute('data-state'));
                // proxy: false -> talks to BirdNET-Go directly, as before.
                assert.strictEqual(B.log.viaHa.length, 0, 'proxy: false never uses the proxy');
                assert.ok(B.log.direct.some(u => u.startsWith('http://birdnet.lan:8080/api/v2/')), 'proxy: false fetches directly');
                assert.deepStrictEqual(A.errors.concat(B.errors), [], 'no page errors');
                console.log('PROXY TEST PASSED');
                process.exit(0);
              } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
            }, 400);
          } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
        }, 900);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 400);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1800);
