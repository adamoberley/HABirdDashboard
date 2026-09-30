// Card with the BirdNET-Go REST API unreachable: data must come from HA
// history of the MQTT sensors via hass.callApi. Two mics' history stubs;
// assert collage species/counts, confidence poses, stats, and the modal
// data path (species action) all derive from MQTT history.
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
// Every direct fetch (BirdNET-Go API on :8080) fails - connection refused.
window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
// History rows: per entity, first row carries entity_id; minimal after.
function entityRows(id, rows) {
  return rows.map((r, i) => i === 0
    ? { entity_id: id, state: r[0], last_changed: r[1] }
    : { state: r[0], last_changed: r[1] });
}
const E = 'sensor.birdnet_go_door_bell';
const history = [
  // Anna's Hummingbird: 3 detections (one is a same-species repeat caught
  // only by the confidence change), high confidence -> perched.
  entityRows(E + '_scientific_name', [
    ['Calypte anna', iso(3 * 3600000)],
    ['Corvus corax', iso(2 * 3600000)],
    ['Calypte anna', iso(30 * 60000)],
  ]),
  entityRows(E + '_confidence', [
    ['99.0', iso(3 * 3600000)],
    ['71.0', iso(2 * 3600000)],
    ['98.0', iso(30 * 60000)],
    ['97.5', iso(10 * 60000)],   // repeat detection, species state unchanged
  ]),
  entityRows(E + '_last_species', [
    ["Anna's Hummingbird", iso(3 * 3600000)],
    ['Common Raven', iso(2 * 3600000)],
    ["Anna's Hummingbird", iso(30 * 60000)],
  ]),
];
let historyCalls = 0;
const hass = {
  themes: { darkMode: false },
  states: {
    [E + '_scientific_name']: { state: 'Calypte anna' },
    [E + '_confidence']: { state: '97.5' },
    [E + '_last_species']: { state: "Anna's Hummingbird" },
    'sun.sun': { attributes: {} },
  },
  callApi: (method, path) => {
    if (path.startsWith('history/period/')) { historyCalls++; return Promise.resolve(JSON.parse(JSON.stringify(history))); }
    return Promise.reject(404);
  },
};

const card = window.document.createElement('habird-card');
card.setConfig({});   // defaults: data_source auto
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  try {
    const root = card.shadowRoot;
    const tiles = [...root.querySelectorAll('.gtile')];
    assert.strictEqual(tiles.length, 2, 'two species from MQTT history: ' + tiles.length);
    // Counts: Anna = 3 (incl. the confidence-only repeat), Raven = 1.
    const anna = tiles.find(t => t.dataset.sci === 'Calypte anna');
    const raven = tiles.find(t => t.dataset.sci === 'Corvus corax');
    assert.ok(anna && anna.title.includes('3 calls'), 'anna count from history: ' + (anna && anna.title));
    assert.ok(raven && raven.title.includes('1 call'), 'raven count: ' + (raven && raven.title));
    // Poses: anna 0.99 -> perched, raven 0.71 -> flight.
    assert.ok(anna.querySelector('img').src.includes('calypte-anna.png'), 'anna perched');
    assert.ok(raven.querySelector('img').src.includes('corvus-corax-2.png'), 'raven flying');
    // Common names came from the Last Species sensor.
    assert.strictEqual(anna.getAttribute('aria-label'), "Anna's Hummingbird", 'common name joined');
    // Stats side panel built from the same events.
    assert.ok(root.getElementById('statsByPeriod').textContent.includes('4'), 'total detections 4');
    assert.ok(root.getElementById('statsFirstSeen').textContent.includes('Raven'), 'firstseen rendered');
    // History endpoint was actually used; memoization kept it sane.
    assert.ok(historyCalls >= 1 && historyCalls <= 4, 'history calls: ' + historyCalls);
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    console.log('MQTT-HISTORY FALLBACK TEST PASSED (' + historyCalls + ' history fetches)');
    // --- No audio over MQTT (#73): play chips disabled, detail view explains ---
    const plays = [...root.querySelectorAll('.bird-card .chip.play')];
    assert.ok(plays.length === 2 && plays.every(b => b.disabled), 'atlas play chips disabled over MQTT');
    assert.ok(/direct connection/.test(plays[0].title), 'play chip says why: ' + plays[0].title);
    root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const recs = root.getElementById('modalRecordings');
        assert.ok(recs.querySelector('.rec-no-audio'), 'recordings note shown');
        assert.ok(recs.querySelectorAll('.rec-row').length >= 1, 'detections still listed');
        assert.strictEqual(recs.querySelectorAll('.rec-row .play, .rec-row .rec-spectro').length, 0, 'no play buttons / spectrogram strips');
        console.log('MQTT NO-AUDIO TEST PASSED');
        pushTest();
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 600);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);

function pushTest() {
  const assert = require('assert');
  try {
    // --- MQTT push: a sensor update must trigger a refresh (debounced) ---
    const callsBefore = historyCalls;
    const hass2 = JSON.parse(JSON.stringify(hass));
    hass2.callApi = hass.callApi;
    hass2.states[E + '_confidence'] = { state: '88.0', last_updated: new Date().toISOString() };
    card.hass = hass2;
    setTimeout(() => {
      try {
        assert.ok(historyCalls > callsBefore, 'push refresh fetched fresh history: ' + callsBefore + ' -> ' + historyCalls);
        console.log('MQTT PUSH TEST PASSED (' + (historyCalls - callsBefore) + ' fresh fetches)');
        process.exit(0);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 2300);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}
