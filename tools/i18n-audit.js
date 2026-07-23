'use strict';
// Shared i18n audit: load every homeassistant/www/i18n/<lang>.js and compare
// each language against `en` (the reference key set). Used by both the test
// (tests/test-i18n-coverage.js) and the on-demand report (tools/i18n-report.js).
//
// Design: `en` carries every key; other languages are sparse - any key they
// omit falls back to `en` at runtime (see tt() in apt.js). So MISSING keys are
// expected and only reported, never failed. EXTRA keys (in a language but not
// en) and PLACEHOLDER mismatches ({n}, {window}, ...) are real bugs.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const I18N_DIR = path.resolve(__dirname, '..', 'homeassistant', 'www', 'i18n');

// Evaluate each i18n/*.js the way the browser does: the files self-register
// into window.HABIRD_I18N. A single shared sandbox mirrors load order.
function loadTables() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);

  const languageFiles = fs.readdirSync(I18N_DIR)
    .filter(function (fileName) { return fileName.endsWith('.js'); })
    .sort();

  languageFiles.forEach(function (fileName) {
    const source = fs.readFileSync(path.join(I18N_DIR, fileName), 'utf8');

    vm.runInContext(source, sandbox, { filename: fileName });
  });

  return sandbox.window.HABIRD_I18N || {};
}

// Sorted, unique {placeholder} token names in a string.
function placeholders(value) {
  const tokens = new Set();

  String(value == null ? '' : value).replace(/\{(\w+)\}/g, function (_match, name) {
    tokens.add(name);
    return '';
  });

  return Array.from(tokens).sort();
}

// Audit every non-en language against en. Returns per-language:
//   missing             - en keys absent here (reported, not a failure)
//   extra               - keys here that en lacks (a bug)
//   placeholderMismatch - shared keys whose {..} tokens differ from en (a bug)
function audit() {
  const tables = loadTables();
  const reference = tables.en || {};
  const referenceKeys = Object.keys(reference);

  const languageCodes = Object.keys(tables)
    .filter(function (code) { return code !== 'en'; })
    .sort();

  const languages = languageCodes.map(function (code) {
    const table = tables[code] || {};
    const missing = referenceKeys.filter(function (key) { return !(key in table); }).sort();
    const extra = Object.keys(table).filter(function (key) { return !(key in reference); }).sort();
    const placeholderMismatch = [];

    referenceKeys.forEach(function (key) {
      if (!(key in table)) {
        return;
      }

      const referenceTokens = placeholders(reference[key]).join(',');
      const translatedTokens = placeholders(table[key]).join(',');

      if (referenceTokens !== translatedTokens) {
        placeholderMismatch.push({
          key: key,
          enTokens: referenceTokens || '(none)',
          langTokens: translatedTokens || '(none)',
        });
      }
    });

    const translatedCount = referenceKeys.length - missing.length;

    return {
      lang: code,
      total: referenceKeys.length,
      translated: translatedCount,
      coverage: referenceKeys.length ? Math.round((translatedCount / referenceKeys.length) * 100) : 100,
      missing: missing,
      extra: extra,
      placeholderMismatch: placeholderMismatch,
    };
  });

  return { enKeyCount: referenceKeys.length, languages: languages };
}

module.exports = { loadTables: loadTables, placeholders: placeholders, audit: audit };
