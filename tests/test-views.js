// Per-view cards + in-place modal: a stats-only card hides the view
// switcher and starts on stats; clicking a species row opens the detail
// modal OVER the current view (no navigation to the atlas).
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
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
window.fetch = (url) => {
  const u = String(url);
  const p = u.replace('http://ha.local:8080', '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (u.startsWith('https://en.wikipedia.org/')) return ok({ extract: 'A hummingbird.' });
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
card.setConfig({ view: 'stats', view_selector: false });
card.hass = { themes: {}, states: {} };
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  const root = card.shadowRoot;
  try {
    // Stats-only card: switcher hidden, stats view current.
    assert.strictEqual(root.getElementById('slider').style.display, 'none', 'view switcher hidden');
    const statsBtn = root.querySelector('#slider button[data-i="1"]');
    assert.strictEqual(statsBtn.getAttribute('aria-current'), 'true', 'starts on stats view');
    // Click a species row in Top Species -> modal opens IN PLACE.
    const row = root.querySelector('#statsTopSpec li[data-sci]');
    assert.ok(row, 'top species row exists');
    row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const modal = root.getElementById('detail-modal');
        assert.strictEqual(modal.getAttribute('aria-hidden'), 'false', 'modal opened');
        assert.strictEqual(root.getElementById('modalSci').textContent, 'Calypte anna', 'modal shows the species');
        assert.strictEqual(statsBtn.getAttribute('aria-current'), 'true', 'STILL on stats view (no atlas jump)');
        assert.strictEqual(window.location.hash, '', 'browser hash untouched');
        assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
        console.log('PER-VIEW + IN-PLACE MODAL TEST PASSED');
        process.exit(0);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 700);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
