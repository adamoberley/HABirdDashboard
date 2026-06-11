// Ingress discovery resilience: when the REST supervisor proxy fails,
// the WebSocket supervisor/api channel takes over; when the add-on list
// is unavailable, the known alexbelgium slug is probed directly. The
// review write then succeeds.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const summary = [
  { scientific_name: 'Meleagris gallopavo', common_name: 'Wild Turkey', count: 4, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.66 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
const posts = [];
const INGRESS = '/api/hassio_ingress/WSTOK';
window.fetch = (url, opts) => {
  const u = String(url);
  const p = u.replace('http://ha.local:8080', '').replace(INGRESS, '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (u.startsWith('https://en.wikipedia.org/')) return ok({ extract: 'x' });
  if (opts && opts.method === 'POST' && p.includes('/review')) { posts.push(u); return ok({ ok: true }); }
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
  if (p.includes('/analytics/')) return ok({ data: [] });
  if (p.includes('/detections?queryType=search')) return ok({ data: [
    { id: 42, date: '2026-06-10', time: '08:20:00', scientificName: 'Meleagris gallopavo', commonName: 'Wild Turkey', confidence: 0.66 },
  ] });
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
};
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 600; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

const wsCalls = [];
const hass = {
  themes: {}, states: {},
  // REST proxy is broken on this install:
  callApi: () => Promise.reject('Unauthorized'),
  // ...but the WS supervisor channel works. Also: the addons LIST fails
  // even over WS, forcing the known-slug probe.
  callWS: (msg) => {
    wsCalls.push(msg.endpoint);
    if (msg.endpoint === '/addons') return Promise.reject('forbidden');
    if (msg.endpoint === '/addons/db21ed7f_birdnet-go/info') return Promise.resolve({ data: { ingress: true, ingress_url: INGRESS + '/ui/dashboard' } });
    if (msg.endpoint === '/ingress/session') return Promise.resolve({ data: { session: 'WS-SESSION' } });
    return Promise.reject(404);
  },
};
const card = window.document.createElement('habird-card');
card.setConfig({});
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  const root = card.shadowRoot;
  root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
  setTimeout(() => {
    const flag = root.querySelector('#modalRecordings .rec-row .flag');
    flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        assert.ok(wsCalls.includes('/addons/db21ed7f_birdnet-go/info'), 'known slug probed over WS: ' + wsCalls.join(','));
        assert.strictEqual(posts.length, 1, 'review posted');
        assert.ok(posts[0].startsWith(INGRESS + '/api/v2/detections/42/review'), 'via WS-discovered ingress: ' + posts[0]);
        assert.strictEqual(flag.textContent, '✓', 'flag succeeded');
        console.log('WS/KNOWN-SLUG INGRESS TEST PASSED');
        process.exit(0);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 600);
  }, 900);
}, 1700);
