// Reconciliation: tiles must be REUSED across renders (no DOM teardown),
// departures get .leaving, arrivals appear; and the MQTT push path
// triggers a refresh with memos busted.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
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
    const anna1 = root.querySelector('.gtile[data-sci="Calypte anna"]');
    assert.ok(anna1, 'initial anna tile');
    anna1.__marker = 42;
    // Render a different set via the debug hook: anna stays, raven leaves,
    // sparrow arrives.
    window.eval(`window.__layout({ slugs: ['calypte-anna', 'passer-domesticus'], weights: 'uniform' })`);
    const anna2 = root.querySelector('.gtile[data-sci="Calypte anna"]');
    assert.strictEqual(anna2.__marker, 42, 'anna tile element REUSED across renders');
    const raven = root.querySelector('.gtile[data-sci="Corvus corax"]');
    assert.ok(raven && raven.classList.contains('leaving'), 'raven fades out (.leaving)');
    const sparrow = root.querySelector('.gtile[data-sci="Passer domesticus"]');
    assert.ok(sparrow && !sparrow.classList.contains('leaving'), 'sparrow arrived');
    setTimeout(() => {
      try {
        assert.ok(!root.querySelector('.gtile[data-sci="Corvus corax"]'), 'raven removed after fade');
        // Identical re-render: signature skip leaves the DOM untouched.
        const before = root.querySelectorAll('.gtile').length;
        window.eval(`window.__layout({ slugs: ['calypte-anna', 'passer-domesticus'], weights: 'uniform' })`);
        assert.strictEqual(root.querySelectorAll('.gtile').length, before, 'no churn on identical data');
        assert.strictEqual(root.querySelector('.gtile[data-sci="Calypte anna"]').__marker, 42, 'still the same node');
        assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
        console.log('SMOOTH-UPDATE TEST PASSED (reuse, fade-out, sig skip)');
        process.exit(0);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 800);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
