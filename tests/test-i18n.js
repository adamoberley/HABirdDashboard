// i18n foundation (Step 1) — the English fallback anchor.
//
// Boots the built <habird-card> in jsdom with NO hass.language set and
// asserts: the English reference table registered, resolveLocale() falls
// back to 'en', and a known chrome string still renders in English. This
// locks the "behaviour stays 100% English by default" guarantee that the
// rest of the suite (e.g. test-card.js's "this week" tooltip) relies on.
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

// Minimal stubs so the app boots cleanly (mirrors test-card.js).
window.fetch = (url) => {
  const p = String(url).replace('http://ha.local:8080', '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok([]);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok([]);
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

// The English table self-registered at eval time (inlined by build.js).
assert.ok(window.HABIRD_I18N && window.HABIRD_I18N.en, 'HABIRD_I18N.en registered');
assert.strictEqual(window.HABIRD_I18N.en['view.collage'], 'collage', 'en reference key present');

// Boot a card with a hass that has NO language field.
const hass = { states: {} };
const card = window.document.createElement('habird-card');
card.setConfig({});
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  try {
    const root = card.shadowRoot;
    assert.ok(root, 'shadow root attached');

    // Fallback anchor: no config.language, no hass.language, jsdom
    // navigator.language is en-US -> resolveLocale() must be 'en'.
    const dbg = window.__habirdI18n;
    assert.ok(dbg, 'i18n debug hook exposed');
    assert.strictEqual(dbg.resolveLocale(), 'en', 'resolveLocale() falls back to en');
    assert.strictEqual(dbg.locale, 'en', 'active LOCALE is en');

    // t() returns the English string, and unknown keys fall back to the key.
    assert.strictEqual(dbg.t('view.stats'), 'stats', 't() returns en string');
    assert.strictEqual(dbg.t('made.up.key'), 'made.up.key', 'unknown key falls back to itself');

    // localizeStaticDom ran: tagged chrome renders in English in the shadow DOM.
    assert.strictEqual(root.querySelector('#slider button[data-i="0"]').textContent, 'collage', 'slider localized');
    assert.strictEqual(root.querySelector('[data-i18n="stats.byPeriod"]').textContent, 'By Period', 'stats heading localized');
    assert.strictEqual(root.querySelector('[data-i18n="modal.recordings"]').textContent, 'Recordings', 'modal heading localized');
    // Rich (innerHTML) string kept its inline links.
    assert.ok(/<a [^>]*birdnet-go/.test(root.querySelector('[data-i18n-html="about.body"]').innerHTML), 'about body rich html localized');

    assert.deepStrictEqual(errors, [], 'no boot errors: ' + errors.join('; '));
    console.log('I18N TEST PASSED: en table registered, resolveLocale() -> en, chrome renders in English');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); errors.length && console.error(errors.join('\n')); process.exit(1); }
}, 1700);
