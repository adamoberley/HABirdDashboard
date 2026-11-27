// HA history join (issue #104): two detections published < 2 s apart -
// BirdNET-Go finding two species in one audio chunk - must keep their own
// common names and count once each. The old "latest value up to t + 2 s"
// join gave the first bird the second one's name (reported as "Mottled Owl -
// Baryphthengus martii") and counted the second bird twice. Species here
// are swapped for illustrated ones; only illustrated birds get a tile.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));   // HA history only
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

const now = Date.now();
const at = (msAgo) => new Date(now - msAgo).toISOString();
function entityRows(id, rows) {
  return rows.map((r, i) => i === 0
    ? { entity_id: id, state: r[0], last_changed: r[1] }
    : { state: r[0], last_changed: r[1] });
}
const E = 'sensor.birdnet_go_backyard';
const T = 60 * 60000;             // the chunk with two species, an hour ago
const history = [
  entityRows(E + '_scientific_name', [
    ['Calypte anna', at(3 * T)],
    ['Corvus corax', at(T)],          // 23:36:21.94
    ['Turdus migratorius', at(T - 1000)],          // 23:36:22.94, 1 s later
    // Fan-out jitter: this species change lands 600 ms AFTER its
    // confidence and name, which must still pair with it.
    ['Calypte anna', at(20 * 60000 - 600)],
  ]),
  entityRows(E + '_confidence', [
    ['92', at(3 * T)],
    ['86', at(T)],
    ['89', at(T - 1000)],
    ['95', at(20 * 60000)],
    ['97', at(5 * 60000)],                    // repeat Anna, species unchanged
  ]),
  entityRows(E + '_last_species', [
    ["Anna's Hummingbird", at(3 * T)],
    ['Common Raven', at(T)],
    ['American Robin', at(T - 1000)],
    ["Anna's Hummingbird", at(20 * 60000)],
  ]),
];
const hass = {
  themes: { darkMode: false },
  states: {
    [E + '_scientific_name']: { state: 'Calypte anna' },
    [E + '_confidence']: { state: '97' },
    [E + '_last_species']: { state: "Anna's Hummingbird" },
    'sun.sun': { attributes: {} },
  },
  callApi: (method, p) => {
    if (p.startsWith('history/period/')) return Promise.resolve(JSON.parse(JSON.stringify(history)));
    return Promise.reject(404);
  },
};

const card = window.document.createElement('habird-card');
card.setConfig({});
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  try {
    const root = card.shadowRoot;
    const tiles = [...root.querySelectorAll('.gtile')];
    const tile = sci => tiles.find(t => t.dataset.sci === sci);
    const raven = tile('Corvus corax');
    const robin = tile('Turdus migratorius');
    const anna = tile('Calypte anna');
    assert.strictEqual(tiles.length, 3, 'three species: ' + tiles.map(t => t.dataset.sci));
    // Before the fix: the raven showed as "American Robin" and the robin
    // was counted twice.
    assert.ok(raven && raven.title.includes('Common Raven') && !raven.title.includes('Robin'),
      'raven keeps its own name: ' + (raven && raven.title));
    assert.ok(robin && robin.title.includes('American Robin'), 'robin named: ' + (robin && robin.title));
    assert.ok(/\b1 call\b/.test(raven.title), 'raven counted once: ' + raven.title);
    assert.ok(/\b1 call\b/.test(robin.title), 'robin counted once, not twice: ' + robin.title);
    // Anna: the first detection, the jittered one, and the repeat.
    assert.ok(anna && /\b3 calls\b/.test(anna.title), 'anna 3 calls: ' + (anna && anna.title));
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    console.log('HISTORY JOIN TEST PASSED');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
