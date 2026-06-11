// Security regression: species names are external data (API / MQTT). A
// hostile name containing markup must render as TEXT everywhere - never
// as elements, never executing.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const EVIL_SCI = 'Corvus <img src=x onerror=window.__pwned1=1>';
const EVIL_COM = '"><svg onload=window.__pwned2=1> Crow';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
const summary = [
  { scientific_name: EVIL_SCI, common_name: EVIL_COM, count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.95 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
window.fetch = (url) => {
  const p = String(url).replace('http://ha.local:8080', '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
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
window.eval(CARD);

const card = window.document.createElement('habird-card');
card.setConfig({});
card.hass = { themes: {}, states: {} };
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  const root = card.shadowRoot;
  try {
    assert.strictEqual(window.__pwned1, undefined, 'no onerror execution');
    assert.strictEqual(window.__pwned2, undefined, 'no onload execution');
    assert.strictEqual(root.querySelectorAll('img[src="x"]').length, 0, 'no injected <img>');
    assert.strictEqual(root.querySelectorAll('svg[onload]').length, 0, 'no injected <svg>');
    // The hostile strings still display - as inert text - in atlas + stats.
    const h3 = root.querySelector('.bird-card h3');
    assert.ok(h3 && h3.textContent === EVIL_COM, 'atlas shows the name as text: ' + (h3 && h3.textContent));
    assert.ok(root.getElementById('statsTopSpec').textContent.includes('Crow'), 'stats list shows it');
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    console.log('XSS REGRESSION TEST PASSED (hostile species name rendered inert)');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
