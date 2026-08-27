// HA 2026.6+ card-picker entity suggestions: window.customCards' habird-card
// entry exposes getEntitySuggestion(hass, entityId). It should suggest this
// card for BirdNET-Go's MQTT sensor trio (and native discovery's sound-level
// sensor) and stay silent for anything else, per
// https://developers.home-assistant.io/blog/2026/05/27/custom-card-suggestions/
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 600; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.eval(CARD);

const assert = require('assert');
try {
  const entry = window.customCards.find((c) => c.type === 'habird-card');
  assert.ok(entry, 'habird-card registered in window.customCards');
  assert.strictEqual(typeof entry.getEntitySuggestion, 'function', 'getEntitySuggestion present');

  const hass = { states: {} };
  const yes = entry.getEntitySuggestion(hass, 'sensor.back_yard_scientific_name');
  assert.ok(yes && yes.config && yes.config.type === 'custom:habird-card',
    'suggests custom:habird-card for a BirdNET-Go sensor: ' + JSON.stringify(yes));

  // Every documented BirdNET-Go suffix, and case-insensitively.
  ['sensor.back_yard_confidence',
   'sensor.back_yard_last_species', 'sensor.back_yard_sound_level',
   'sensor.BACK_YARD_SCIENTIFIC_NAME'].forEach((id) => {
    const s = entry.getEntitySuggestion(hass, id);
    assert.ok(s && s.config && s.config.type === 'custom:habird-card', 'suggests for ' + id + ': ' + JSON.stringify(s));
  });

  const no = entry.getEntitySuggestion(hass, 'sensor.kitchen_temperature');
  assert.ok(no === null || no === undefined, 'no suggestion for an unrelated sensor: ' + JSON.stringify(no));

  // The bare '_species' suffix was dropped (too generic - matched any
  // unrelated sensor ending in "_species", not just BirdNET-Go's own).
  const bareSpecies = entry.getEntitySuggestion(hass, 'sensor.back_yard_species');
  assert.ok(bareSpecies === null || bareSpecies === undefined,
    'bare _species suffix no longer suggested: ' + JSON.stringify(bareSpecies));

  // A non-sensor domain sharing the suffix text shouldn't match either.
  const otherDomain = entry.getEntitySuggestion(hass, 'binary_sensor.back_yard_scientific_name');
  assert.ok(otherDomain === null || otherDomain === undefined, 'sensor domain required: ' + JSON.stringify(otherDomain));

  console.log('ENTITY SUGGESTION TEST PASSED');
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
