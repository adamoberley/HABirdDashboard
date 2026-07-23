// i18n foundation (Step 1) + Danish translation (Step 4).
//
// English boot: NO hass.language set. Asserts the English reference table
// registered, resolveLocale() falls back to 'en', and known chrome still
// renders in English. This locks the "behaviour stays 100% English by
// default" guarantee the rest of the suite (e.g. test-card.js's "this week"
// tooltip) relies on.
//
// Danish boot (its own fresh jsdom, stub hass.language = 'da'): asserts the
// da table registered, resolveLocale()/WIKI_LANG pick 'da', chrome renders
// in Danish, and a key omitted from da.js falls back to the English value.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

// Boot a <habird-card> in a fresh jsdom. `hassLang` (optional) becomes
// hass.language, resolved once at card boot (LOCALE/BCP47/WIKI_LANG). The
// built card inlines every i18n/*.js file, so en + da self-register at eval.
function boot(hassLang, done) {
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

  const hass = { states: {} };
  if (hassLang) hass.language = hassLang;
  const card = window.document.createElement('habird-card');
  card.setConfig({});
  card.hass = hass;
  window.document.body.appendChild(card);

  setTimeout(() => done(window, card, errors), 1700);
}

function fail(e, errors) {
  console.error('FAIL:', e.message);
  if (errors && errors.length) console.error(errors.join('\n'));
  process.exit(1);
}

// ---- English boot (fallback anchor) ----
boot(null, (window, card, errors) => {
  try {
    // The English table self-registered at eval time (inlined by build.js).
    assert.ok(window.HABIRD_I18N && window.HABIRD_I18N.en, 'HABIRD_I18N.en registered');
    assert.strictEqual(window.HABIRD_I18N.en['view.collage'], 'collage', 'en reference key present');

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
    console.log('I18N TEST (en): en table registered, resolveLocale() -> en, chrome renders in English');
  } catch (e) { return fail(e, errors); }

  // ---- Danish boot (stub hass.language = 'da') ----
  boot('da', (window, card, errors) => {
    try {
      // The da table self-registered too (inlined alongside en by build.js).
      assert.ok(window.HABIRD_I18N && window.HABIRD_I18N.da, 'HABIRD_I18N.da registered');

      const root = card.shadowRoot;
      assert.ok(root, 'shadow root attached');

      const dbg = window.__habirdI18n;
      assert.ok(dbg, 'i18n debug hook exposed');
      assert.strictEqual(dbg.resolveLocale(), 'da', 'resolveLocale() picks da from hass.language');
      assert.strictEqual(dbg.locale, 'da', 'active LOCALE is da');
      // Step-3 Wikipedia-language mapping: da -> da.
      assert.strictEqual(dbg.wikiLang, 'da', 'WIKI_LANG maps da -> da');

      // t() returns the Danish string...
      assert.strictEqual(dbg.t('view.aria'), 'Visning', 't() returns da string');
      assert.strictEqual(dbg.t('stats.byPeriod'), 'Efter periode', 't() returns da string');
      // ...and a key omitted from da.js falls back to the English value.
      assert.strictEqual(dbg.t('modal.scrub'), 'scrub', 'omitted da key falls back to en');
      // Placeholders survive translation.
      assert.strictEqual(dbg.t('stats.daysAgo', { n: 3 }), 'for 3d siden', 'da placeholder interpolated');

      // localizeStaticDom ran: tagged chrome renders in Danish in the shadow DOM.
      assert.strictEqual(root.querySelector('[data-i18n="stats.byPeriod"]').textContent, 'Efter periode', 'stats heading localized (da)');
      assert.strictEqual(root.querySelector('[data-i18n="modal.recordings"]').textContent, 'Optagelser', 'modal heading localized (da)');
      // Rich (innerHTML) string kept its inline links, prose in Danish.
      const aboutHtml = root.querySelector('[data-i18n-html="about.body"]').innerHTML;
      assert.ok(/<a [^>]*birdnet-go/.test(aboutHtml), 'about body rich html kept links (da)');
      assert.ok(/forbipasserende fugl/.test(aboutHtml), 'about body prose in Danish');

      assert.deepStrictEqual(errors, [], 'no boot errors (da): ' + errors.join('; '));
      console.log('I18N TEST (da): da table registered, resolveLocale()/WIKI_LANG -> da, chrome renders in Danish, en fallback works');
      console.log('I18N TEST PASSED');
      process.exit(0);
    } catch (e) { return fail(e, errors); }
  });
});
