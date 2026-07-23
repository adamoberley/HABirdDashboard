// i18n key-parity audit (reads the source i18n/*.js, not the build).
//
// Reports translation coverage per language but does NOT fail on missing keys:
// omissions fall back to English by design (see tt() in apt.js), so a lagging
// translation is acceptable, not a build breaker. It DOES fail on structural
// bugs that break the runtime:
//   - EXTRA keys (present in a language, absent from en) - stale/typo'd, never
//     reachable, usually a key renamed in en and not here.
//   - PLACEHOLDER mismatches - a translated value whose {..} tokens differ from
//     en's (e.g. dropping {n}/{window}) would silently lose interpolated data.
'use strict';
const assert = require('assert');
const { audit } = require('../tools/i18n-audit');

const { enKeyCount, languages } = audit();
let hardFail = false;

console.log('i18n coverage (reference: en, ' + enKeyCount + ' keys)');
languages.forEach(function (r) {
  console.log('  ' + r.lang + ': ' + r.coverage + '% (' + r.translated + '/' + r.total + ' translated)'
    + (r.missing.length ? ' - ' + r.missing.length + ' fall back to en' : ''));
  if (r.missing.length) console.log('      missing: ' + r.missing.join(', '));
  if (r.extra.length) {
    hardFail = true;
    console.log('      EXTRA keys not in en: ' + r.extra.join(', '));
  }
  r.placeholderMismatch.forEach(function (m) {
    hardFail = true;
    console.log('      PLACEHOLDER MISMATCH ' + m.key + ': en={' + m.enTokens + '} ' + r.lang + '={' + m.langTokens + '}');
  });
});

assert.ok(!hardFail,
  'i18n structural error: extra keys or placeholder mismatches above must be fixed ' +
  '(missing keys are fine - they fall back to English).');
console.log('I18N COVERAGE TEST PASSED (missing keys reported, not failed)');
