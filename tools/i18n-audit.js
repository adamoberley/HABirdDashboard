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
  fs.readdirSync(I18N_DIR)
    .filter(function (f) { return f.endsWith('.js'); })
    .sort()
    .forEach(function (f) {
      vm.runInContext(fs.readFileSync(path.join(I18N_DIR, f), 'utf8'), sandbox, { filename: f });
    });
  return sandbox.window.HABIRD_I18N || {};
}

// Sorted, unique {placeholder} token names in a string.
function placeholders(s) {
  const out = new Set();
  String(s == null ? '' : s).replace(/\{(\w+)\}/g, function (_, k) { out.add(k); return ''; });
  return Array.from(out).sort();
}

// Audit every non-en language against en. Returns per-language:
//   missing            - en keys absent here (reported, not a failure)
//   extra              - keys here that en lacks (a bug)
//   placeholderMismatch- shared keys whose {..} tokens differ from en (a bug)
function audit() {
  const tables = loadTables();
  const en = tables.en || {};
  const enKeys = Object.keys(en);
  const languages = Object.keys(tables)
    .filter(function (l) { return l !== 'en'; })
    .sort()
    .map(function (lang) {
      const t = tables[lang] || {};
      const missing = enKeys.filter(function (k) { return !(k in t); }).sort();
      const extra = Object.keys(t).filter(function (k) { return !(k in en); }).sort();
      const placeholderMismatch = [];
      enKeys.forEach(function (k) {
        if (!(k in t)) return;
        const enTokens = placeholders(en[k]).join(',');
        const langTokens = placeholders(t[k]).join(',');
        if (enTokens !== langTokens) {
          placeholderMismatch.push({ key: k, enTokens: enTokens || '(none)', langTokens: langTokens || '(none)' });
        }
      });
      const translated = enKeys.length - missing.length;
      return {
        lang: lang,
        total: enKeys.length,
        translated: translated,
        coverage: enKeys.length ? Math.round((translated / enKeys.length) * 100) : 100,
        missing: missing,
        extra: extra,
        placeholderMismatch: placeholderMismatch,
      };
    });
  return { enKeyCount: enKeys.length, languages: languages };
}

module.exports = { loadTables: loadTables, placeholders: placeholders, audit: audit };
