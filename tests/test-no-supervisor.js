// HACS review (hacs/default#11399): the card must never open Supervisor
// ingress sessions or otherwise call the Supervisor API to reach the
// BirdNET-Go add-on. On an https dashboard without Bird Card Proxy the
// plain-http LAN API is blocked (mixed content), so the card falls back to
// MQTT history - but it must not touch hassio/* or supervisor/api, or set
// an ingress_session / csrf cookie, along the way.
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

const urls = [];
window.fetch = (url) => {
  urls.push(String(url));
  // Every BirdNET-Go route fails like a real mixed-content block.
  return Promise.reject(new TypeError('Failed to fetch'));
};
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

const supervisor = [];
const hass = {
  themes: {}, states: {},
  callApi: (method, p) => {
    if (/^hassio\//.test(p)) supervisor.push(method + ' ' + p);
    return Promise.reject(404);
  },
  callWS: (msg) => {
    if (msg && msg.type === 'supervisor/api') supervisor.push('WS ' + msg.endpoint);
    return Promise.resolve([]);
  },
};

const card = window.document.createElement('habird-card');
card.setConfig({});
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  try {
    assert.deepStrictEqual(supervisor, [], 'no Supervisor API calls: ' + supervisor.join(', '));
    assert.ok(!urls.some(u => u.includes('hassio_ingress')), 'no ingress URLs fetched');
    assert.ok(!/ingress_session=|(^|; )csrf=/.test(window.document.cookie), 'no cookies minted: ' + window.document.cookie);
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    console.log('NO-SUPERVISOR TEST PASSED');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1900);
