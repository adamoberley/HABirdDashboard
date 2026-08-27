// BirdNET-Go's native HA MQTT auto-discovery (shipped Jan 2026, e.g. via
// the alexbelgium add-on's mqtt_auto_config) publishes the same
// *_scientific_name / *_confidence / *_last_species trio the card already
// discovers, but backed by a device availability topic: entities flip to
// state 'unavailable' when their source drops. Assert that an offline mic
// (a) doesn't break aggregation or drop its prior history, and (b) drives
// a small "N microphone(s) offline" note - present only while >=1 mic is
// offline, absent when every discovered mic is online.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function boot() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  // Every direct fetch (BirdNET-Go API on :8080) fails - data must come
  // from HA history of the MQTT sensors, same as test-mqtt.js.
  window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  return { window, errors };
}

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
function entityRows(id, rows) {
  return rows.map((r, i) => i === 0
    ? { entity_id: id, state: r[0], last_changed: r[1] }
    : { state: r[0], last_changed: r[1] });
}

const A = 'sensor.birdnet_go_door_bell';   // stays online
const B = 'sensor.birdnet_go_garden';      // goes offline (native discovery availability)

// Both mics have prior history - B's must survive being marked offline.
// hist shape: one array per entity, first row carries entity_id.
const historyByEntity = [
  entityRows(A + '_scientific_name', [['Calypte anna', iso(3 * 3600000)]]),
  entityRows(A + '_confidence', [['99.0', iso(3 * 3600000)]]),
  entityRows(A + '_last_species', [["Anna's Hummingbird", iso(3 * 3600000)]]),
  entityRows(B + '_scientific_name', [['Corvus corax', iso(2 * 3600000)]]),
  entityRows(B + '_confidence', [['71.0', iso(2 * 3600000)]]),
  entityRows(B + '_last_species', [['Common Raven', iso(2 * 3600000)]]),
];

function makeHass(bOffline, opts) {
  opts = opts || {};
  const hass = {
    themes: { darkMode: false },
    states: {
      [A + '_scientific_name']: { entity_id: A + '_scientific_name', state: 'Calypte anna' },
      [A + '_confidence']: { entity_id: A + '_confidence', state: '99.0' },
      [A + '_last_species']: { entity_id: A + '_last_species', state: "Anna's Hummingbird" },
      [B + '_scientific_name']: { entity_id: B + '_scientific_name', state: bOffline ? 'unavailable' : 'Corvus corax' },
      [B + '_confidence']: { entity_id: B + '_confidence', state: bOffline ? 'unavailable' : '71.0' },
      [B + '_last_species']: { entity_id: B + '_last_species', state: bOffline ? 'unavailable' : 'Common Raven' },
      'sun.sun': { attributes: {} },
    },
    callApi: (method, p) => {
      if (p.startsWith('history/period/')) return Promise.resolve(JSON.parse(JSON.stringify(historyByEntity)));
      return Promise.reject(404);
    },
  };
  if (opts.formatEntityName) hass.formatEntityName = opts.formatEntityName;
  return hass;
}

const assert = require('assert');

function runOfflineCase(done) {
  const { window, errors } = boot();
  const hass = makeHass(true);
  const card = window.document.createElement('habird-card');
  card.setConfig({});
  card.hass = hass;
  window.document.body.appendChild(card);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      const tiles = [...root.querySelectorAll('.gtile')];
      // Aggregation didn't break, and B's prior history wasn't dropped:
      // both species still render from history despite B currently
      // reading 'unavailable'.
      assert.strictEqual(tiles.length, 2, 'both mics history-derived species render: ' + tiles.length);
      const anna = tiles.find(t => t.dataset.sci === 'Calypte anna');
      const raven = tiles.find(t => t.dataset.sci === 'Corvus corax');
      assert.ok(anna && anna.title.includes('1 call'), 'online mic call counted: ' + (anna && anna.title));
      assert.ok(raven && raven.title.includes('1 call'), 'offline mic keeps its prior history: ' + (raven && raven.title));

      const note = root.getElementById('statsMicNote');
      assert.ok(note, 'mic note element present');
      assert.strictEqual(note.hidden, false, 'note shown with 1 mic offline');
      assert.strictEqual(note.textContent, '1 microphone(s) offline', 'note text: ' + note.textContent);
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      console.log('MIC OFFLINE NOTE TEST PASSED');
      done();
    } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
  }, 2000);
}

// hass.formatEntityName (HA 2026.6+) is defined and exactly one mic is
// offline - the note must name that mic (stats.micOfflineNamed), not fall
// back to the plain count. Regression test: the mock hass never used to
// define formatEntityName, so this branch (haEntityLabel's "no formatter"
// fallback vs. its actual formatter path) had zero coverage - a wrong
// entity id, an inverted offline.length===1 check, or a typo'd tt() key
// would all still render fine and slip through.
function runNamedOfflineCase(done) {
  const { window, errors } = boot();
  const hass = makeHass(true, {
    formatEntityName: (st) => (st.entity_id === B + '_scientific_name' ? 'Garden Mic' : null),
  });
  const card = window.document.createElement('habird-card');
  card.setConfig({});
  card.hass = hass;
  window.document.body.appendChild(card);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      const note = root.getElementById('statsMicNote');
      assert.ok(note, 'mic note element present');
      assert.strictEqual(note.hidden, false, 'note shown with 1 mic offline');
      assert.strictEqual(note.textContent, 'Garden Mic is offline',
        'note names the offline mic via formatEntityName: ' + note.textContent);
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      console.log('NAMED MIC OFFLINE NOTE TEST PASSED');
      done();
    } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
  }, 2000);
}

function runAllOnlineCase() {
  const { window, errors } = boot();
  const hass = makeHass(false);
  const card = window.document.createElement('habird-card');
  card.setConfig({});
  card.hass = hass;
  window.document.body.appendChild(card);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      const note = root.getElementById('statsMicNote');
      assert.ok(note, 'mic note element present');
      assert.strictEqual(note.hidden, true, 'note hidden when every mic is online');
      assert.strictEqual(note.textContent, '', 'note text empty when hidden');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      console.log('ALL-ONLINE NO-NOTE TEST PASSED');
      process.exit(0);
    } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
  }, 2000);
}

runOfflineCase(() => runNamedOfflineCase(runAllOnlineCase));
