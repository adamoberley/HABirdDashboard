#!/usr/bin/env node
'use strict';
// On-demand translation coverage report.
//
//   npm run i18n:report              per-language coverage + missing/extra keys
//   npm run i18n:report -- --stub da print da's missing keys, English value as
//                                    a placeholder, ready to paste into da.js
//
// Reads the source i18n/*.js files (no build needed).

const { audit, loadTables } = require('./i18n-audit');

const args = process.argv.slice(2);
const stubIdx = args.indexOf('--stub');
const stubLang = stubIdx >= 0 ? args[stubIdx + 1] : null;

const { enKeyCount, languages } = audit();

if (stubLang) {
  const r = languages.find(function (l) { return l.lang === stubLang; });
  if (!r) {
    console.error('unknown language "' + stubLang + '". Known: ' + languages.map(function (l) { return l.lang; }).join(', '));
    process.exit(1);
  }
  const en = loadTables().en || {};
  if (!r.missing.length) {
    console.log('// ' + stubLang + '.js is fully translated - nothing to stub.');
    process.exit(0);
  }
  console.log('  // —— UNTRANSLATED (' + r.missing.length + ' keys, currently fall back to English) ——');
  r.missing.forEach(function (k) {
    console.log('  ' + JSON.stringify(k) + ': ' + JSON.stringify(en[k]) + ',');
  });
  process.exit(0);
}

console.log('i18n coverage — reference: en (' + enKeyCount + ' keys)\n');
languages.forEach(function (r) {
  console.log(r.lang + '  ' + r.coverage + '%  (' + r.translated + '/' + r.total + ' translated)');
  if (r.missing.length) console.log('  missing (' + r.missing.length + '): ' + r.missing.join(', '));
  if (r.extra.length) console.log('  EXTRA keys not in en (' + r.extra.length + '): ' + r.extra.join(', '));
  r.placeholderMismatch.forEach(function (m) {
    console.log('  placeholder mismatch ' + m.key + ': en={' + m.enTokens + '} ' + r.lang + '={' + m.langTokens + '}');
  });
  console.log('');
});
console.log('Tip: `npm run i18n:report -- --stub <lang>` prints the missing keys ready to paste in.');
