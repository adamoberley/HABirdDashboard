// selector_position: top adds the av-picker-top class; default bottom does not.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');
function boot(cfg) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 600; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  card.setConfig(cfg);
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  return card;
}
const assert = require('assert');
const top = boot({ selector_position: 'top' });
const def = boot({});
setTimeout(() => {
  try {
    assert.ok(top.shadowRoot.querySelector('.av-shell').classList.contains('av-picker-top'), 'top class applied');
    assert.ok(!def.shadowRoot.querySelector('.av-shell').classList.contains('av-picker-top'), 'default stays bottom');
    console.log('PICKER POSITION TEST PASSED');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 900);
