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
const stubFlagIndex = args.indexOf('--stub');
const stubLang = stubFlagIndex >= 0 ? args[stubFlagIndex + 1] : null;

const { enKeyCount, languages } = audit();

if (stubLang) {
  const target = languages.find(function (language) { return language.lang === stubLang; });

  if (!target) {
    const knownCodes = languages.map(function (language) { return language.lang; }).join(', ');

    console.error('unknown language "' + stubLang + '". Known: ' + knownCodes);
    process.exit(1);
  }

  if (!target.missing.length) {
    console.log('// ' + stubLang + '.js is fully translated - nothing to stub.');
    process.exit(0);
  }

  const reference = loadTables().en || {};

  console.log('  // —— UNTRANSLATED (' + target.missing.length + ' keys, currently fall back to English) ——');

  target.missing.forEach(function (key) {
    console.log('  ' + JSON.stringify(key) + ': ' + JSON.stringify(reference[key]) + ',');
  });

  process.exit(0);
}

console.log('i18n coverage — reference: en (' + enKeyCount + ' keys)\n');

languages.forEach(function (language) {
  console.log(language.lang + '  ' + language.coverage + '%  (' + language.translated + '/' + language.total + ' translated)');

  if (language.missing.length) {
    console.log('  missing (' + language.missing.length + '): ' + language.missing.join(', '));
  }

  if (language.extra.length) {
    console.log('  EXTRA keys not in en (' + language.extra.length + '): ' + language.extra.join(', '));
  }

  language.placeholderMismatch.forEach(function (mismatch) {
    console.log('  placeholder mismatch ' + mismatch.key + ': en={' + mismatch.enTokens + '} ' + language.lang + '={' + mismatch.langTokens + '}');
  });

  console.log('');
});

console.log('Tip: `npm run i18n:report -- --stub <lang>` prints the missing keys ready to paste in.');
