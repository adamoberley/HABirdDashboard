// Nabu Casa scenario: page served over https. The card must discover the
// birdnet-go add-on's ingress, open a session (cookie via HA API), and
// route every BirdNET-Go API call through the ingress base - making the
// full API (audio included) work remotely.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://example.ui.nabu.casa/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));

const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 50, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
const INGRESS = '/api/hassio_ingress/TOKEN123';
const apiHits = [];
window.fetch = (url) => {
  const u = String(url);
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (u.startsWith(INGRESS + '/api/v2')) {
    apiHits.push(u);
    const p = u.slice(INGRESS.length);
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections')) return ok({ data: [] });
  }
  // Anything trying the blocked LAN route fails like a real mixed-content block.
  return Promise.reject(new TypeError('Failed to fetch'));
};
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

let sessions = 0;
const hass = {
  themes: {}, states: {},
  callApi: (method, path, data) => {
    if (path === 'hassio/addons') return Promise.resolve({ data: { addons: [
      { slug: 'core_ssh', name: 'Terminal & SSH' },
      { slug: 'db21ed7f_birdnet-go', name: 'Birdnet-go' },
    ] } });
    if (path === 'hassio/addons/db21ed7f_birdnet-go/info') return Promise.resolve({ data: { ingress: true, ingress_url: INGRESS + '/' } });
    if (path === 'hassio/ingress/session' && method === 'POST') { sessions++; return Promise.resolve({ data: { session: 'SESSIONX' } }); }
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
  try {
    assert.ok(sessions >= 1, 'ingress session created');
    // (cookie is path-scoped to /api/hassio_ingress/ - not readable from the dashboard path, by design)
    assert.ok(apiHits.length > 0, 'API calls routed through ingress: ' + apiHits.length);
    assert.ok(apiHits[0].startsWith('/api/hassio_ingress/TOKEN123/api/v2/'), 'ingress base used: ' + apiHits[0]);
    const tile = root.querySelector('.gtile[data-sci="Calypte anna"]');
    assert.ok(tile, 'collage rendered from ingress-routed API');
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    console.log('INGRESS ROUTING TEST PASSED (' + apiHits.length + ' API calls via ingress)');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1900);
