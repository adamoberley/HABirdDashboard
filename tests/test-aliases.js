// Issues #76 and #74, against the built card.
// #76: BirdNET-Go reports some species under their current name (its
// OpenFauna aliases), not the BirdNET V2.4 label the artwork is filed
// under. Those birds must still get their illustration + mask, in either
// direction, and a name with art of its own must be left alone.
// #74: in a sections view the card must drop its 560px masonry floor so it
// fits its grid slot instead of spilling the picker onto the next section.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));

const row = (sci, com, count) => ({ scientific_name: sci, common_name: com, count, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 });
const summary = [
  row('Coloeus monedula', 'Eurasian Jackdaw', 40),      // art under Corvus monedula
  row('Accipiter fasciatus', 'Brown Goshawk', 20),      // art under Tachyspiza fasciata
  row('Tachyspiza fasciata', 'Brown Goshawk (new)', 10), // has its own art - unchanged
  row('Corvus corax', 'Common Raven', 5),               // no alias at all
  row('Corthylio calendula', 'Ruby-crowned Kinglet', 3), // art under Regulus calendula (#90)
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

const hass = { themes: { darkMode: false }, states: {} };
const card = window.document.createElement('habird-card');
card.setConfig({ birdnet_url: 'http://ha.local:8080', data_source: 'api' });
card.hass = hass;
window.document.body.appendChild(card);

// #74 - sizing: masonry keeps the floor; layout = 'grid' or a sections
// ancestor (older HA builds that don't pass layout) drops it.
const css = card.shadowRoot.querySelector('style').textContent;
assert.ok(/:host\(\[av-grid\]\)\s*\{\s*min-height:\s*0/.test(css), 'grid min-height override in CSS');
assert.ok(!card.hasAttribute('av-grid'), 'masonry card keeps the 560px floor');
card.layout = 'grid';
assert.ok(card.hasAttribute('av-grid'), "layout = 'grid' marks the card");
card.layout = undefined;
assert.ok(!card.hasAttribute('av-grid'), 'clearing layout restores the floor');
const section = window.document.createElement('hui-grid-section');
const wrap = section.attachShadow({ mode: 'open' });
window.document.body.appendChild(section);
const inGrid = window.document.createElement('habird-card');
inGrid.setConfig({ birdnet_url: 'http://ha.local:8080', data_source: 'api' });
inGrid.hass = hass;
wrap.appendChild(inGrid);
assert.ok(inGrid.hasAttribute('av-grid'), 'sections ancestor found across a shadow root');

setTimeout(() => {
  try {
    const root = card.shadowRoot;
    const tiles = [...root.querySelectorAll('.gtile img')];
    const src = (slug) => tiles.map(t => t.getAttribute('src')).find(s => s.includes('/illustrations/' + slug + '.png') || s.includes('/illustrations/' + slug + '-2.png'));
    assert.strictEqual(tiles.length, 5, 'all five birds in the collage: ' + tiles.length);
    assert.ok(src('corvus-monedula'), 'Coloeus monedula -> corvus-monedula art');
    assert.ok(!src('coloeus-monedula'), 'no request for the missing coloeus-monedula art');
    const goshawks = tiles.filter(t => t.getAttribute('src').includes('/illustrations/tachyspiza-fasciata'));
    assert.strictEqual(goshawks.length, 2, 'old + new goshawk names both land on tachyspiza-fasciata');
    assert.ok(src('corvus-corax'), 'unaliased species unchanged');
    assert.ok(src('regulus-calendula'), 'Corthylio calendula -> regulus-calendula art (#90)');
    // Masks resolved too: every tile's slug is one the library has.
    root.querySelectorAll('.gtile img[data-slug]').forEach(img => {
      assert.ok(!/coloeus|accipiter-fasciatus|corthylio/.test(img.getAttribute('data-slug')), 'tile slug aliased: ' + img.getAttribute('data-slug'));
    });
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log('aliases + grid sizing OK');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}, 1500);
