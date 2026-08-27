// Feeder-visit blending (issue #61): visits_sensors names a second,
// BirdNET-style MQTT sensor trio published by a feeder camera (e.g. an
// LLM Vision automation). Its HA history must blend windowed per-species
// "visits" into the collage tooltips, atlas cards and detail modal -
// without the camera sensors being double-counted as microphone calls,
// and without a feeder-only species joining the collage.
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
// Every direct fetch (BirdNET-Go API on :8080) fails - both the call and
// the visit streams must come from HA history.
window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
function entityRows(id, rows) {
  return rows.map((r, i) => i === 0
    ? { entity_id: id, state: r[0], last_changed: r[1] }
    : { state: r[0], last_changed: r[1] });
}
const E = 'sensor.birdnet_go_door_bell';   // microphone trio
const F = 'sensor.feeder_cam';             // feeder-camera trio (visits)
const history = [
  // Microphone: Anna's Hummingbird 3 calls, Common Raven 1 call.
  entityRows(E + '_scientific_name', [
    ['Calypte anna', iso(3 * 3600000)],
    ['Corvus corax', iso(2 * 3600000)],
    ['Calypte anna', iso(30 * 60000)],
  ]),
  entityRows(E + '_confidence', [
    ['99.0', iso(3 * 3600000)],
    ['71.0', iso(2 * 3600000)],
    ['98.0', iso(30 * 60000)],
    ['97.5', iso(10 * 60000)],
  ]),
  entityRows(E + '_last_species', [
    ["Anna's Hummingbird", iso(3 * 3600000)],
    ['Common Raven', iso(2 * 3600000)],
    ["Anna's Hummingbird", iso(30 * 60000)],
  ]),
  // Feeder camera: Anna 2 visits + an American Robin visit. The robin was
  // never HEARD, so it must stay out of the collage/atlas entirely.
  entityRows(F + '_scientific_name', [
    ['Calypte anna', iso(2 * 3600000)],
    ['Turdus migratorius', iso(1 * 3600000)],
    ['Calypte anna', iso(40 * 60000)],
  ]),
  entityRows(F + '_confidence', [
    ['90.0', iso(2 * 3600000)],
    ['88.0', iso(1 * 3600000)],
    ['91.0', iso(40 * 60000)],
  ]),
  entityRows(F + '_last_species', [
    ["Anna's Hummingbird", iso(2 * 3600000)],
    ['American Robin', iso(1 * 3600000)],
    ["Anna's Hummingbird", iso(40 * 60000)],
  ]),
];
const hass = {
  themes: { darkMode: false },
  states: {
    [E + '_scientific_name']: { state: 'Calypte anna' },
    [E + '_confidence']: { state: '97.5' },
    [E + '_last_species']: { state: "Anna's Hummingbird" },
    [F + '_scientific_name']: { state: 'Calypte anna' },
    [F + '_confidence']: { state: '91.0' },
    [F + '_last_species']: { state: "Anna's Hummingbird" },
    'sun.sun': { attributes: {} },
  },
  callApi: (method, p) => {
    if (p.startsWith('history/period/')) return Promise.resolve(JSON.parse(JSON.stringify(history)));
    return Promise.reject(404);
  },
};

const card = window.document.createElement('habird-card');
card.setConfig({ visits_sensors: ['sensor.feeder_cam_scientific_name'] });
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  try {
    const root = card.shadowRoot;
    const tiles = [...root.querySelectorAll('.gtile')];
    // The feeder-only robin must not add a tile, and the feeder sensors
    // must not have been discovered as a second microphone.
    assert.strictEqual(tiles.length, 2, 'two species (visits never add birds): ' + tiles.length);
    const anna = tiles.find(t => t.dataset.sci === 'Calypte anna');
    const raven = tiles.find(t => t.dataset.sci === 'Corvus corax');
    assert.ok(anna && anna.title.includes('3 calls'), 'anna calls exclude feeder events: ' + (anna && anna.title));
    assert.ok(anna.title.includes('2 visits'), 'anna visits blended into tooltip: ' + anna.title);
    assert.ok(raven && raven.title.includes('1 call') && !raven.title.includes('visit'),
      'raven has no visits: ' + (raven && raven.title));
    // Atlas: a "visits" stat line only on the visited species.
    const annaCard = root.querySelector('.bird-card[data-sci="Calypte anna"]');
    const ravenCard = root.querySelector('.bird-card[data-sci="Corvus corax"]');
    assert.ok(annaCard && /2\s*visits/.test(annaCard.querySelector('.stat').textContent),
      'atlas visits row: ' + (annaCard && annaCard.querySelector('.stat').textContent));
    assert.ok(ravenCard && !/visit/.test(ravenCard.querySelector('.stat').textContent),
      'no visits row on unvisited species');
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    console.log('VISITS BLEND TEST PASSED (collage + atlas)');
    // Detail modal: the visits stat cell shows, labelled with the window.
    annaCard.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const stat = root.getElementById('modalVisitsStat');
        assert.notStrictEqual(stat.style.display, 'none', 'modal visits stat visible');
        assert.strictEqual(root.getElementById('modalVisits').textContent, '2', 'modal visit count');
        assert.strictEqual(root.getElementById('modalVisitsLbl').textContent, 'visits today', 'modal visit label');
        assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
        console.log('VISITS MODAL TEST PASSED');
        process.exit(0);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 900);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
