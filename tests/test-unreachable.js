// Issue #73: a BirdNET-Go host that never answers (VPN without internal
// DNS, dead LAN route) used to leave the card blank indefinitely, with only
// a console.warn. The API calls must now time out and the collage + atlas
// must say the API can't be reached. A card that simply has no detections
// yet must stay blank, as before. With data_source: auto and a Home
// Assistant that has no BirdNET-Go MQTT sensors, the message says so.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function mount(fetchImpl, hass) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  window.fetch = fetchImpl;
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  card.setConfig({ birdnet_url: 'http://birdnet.lan:8080', live: false });
  card.hass = hass || { themes: { darkMode: false }, states: {} };
  window.document.body.appendChild(card);
  return { card, errors };
}

// 1. Every BirdNET-Go request hangs forever.
const hung = mount((url) => new Promise(() => {}));
// 2. BirdNET-Go answers, just with nothing heard yet.
const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b) });
const quiet = mount((url) => {
  const u = String(url);
  if (u.includes('/analytics/species/')) return ok([]);
  if (u.includes('/analytics/')) return ok({ data: [] });
  return ok({ data: [], total: 0 });
});

// 3. BirdNET-Go hangs and HA (reachable, via callApi) has no BirdNET-Go sensors.
const noMqtt = mount((url) => new Promise(() => {}), {
  themes: { darkMode: false },
  states: { 'sensor.outdoor_temp': { entity_id: 'sensor.outdoor_temp', state: '12', attributes: {} } },
  callApi: () => Promise.resolve([]),
  callWS: () => Promise.resolve([]),
});

setTimeout(() => {
  try {
    const root = hung.card.shadowRoot;
    const msg = root.querySelector('#collage .collage-error');
    assert.ok(msg, 'collage shows an error instead of staying blank');
    assert.ok(/reach BirdNET-Go/.test(msg.textContent), 'collage message: ' + msg.textContent);
    assert.ok(/reach BirdNET-Go/.test(root.querySelector('.atlas-empty').textContent), 'atlas message');
    assert.ok(!/MQTT sensors/.test(msg.textContent), 'no HA fallback -> generic message');
    const nm = noMqtt.card.shadowRoot.querySelector('#collage .collage-error');
    assert.ok(nm && /no BirdNET-Go MQTT sensors/.test(nm.textContent), 'no-MQTT reason shown: ' + (nm && nm.textContent));
    const q = quiet.card.shadowRoot;
    assert.strictEqual(q.getElementById('collage').innerHTML, '', 'no detections yet -> still blank');
    assert.ok(!/reach BirdNET-Go/.test(q.querySelector('.atlas-empty').textContent), 'no error when the API answered');
    assert.deepStrictEqual(hung.errors.concat(quiet.errors, noMqtt.errors), [], 'no page errors');
    console.log('unreachable API OK');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}, 17000);
