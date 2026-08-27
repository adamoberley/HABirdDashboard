#!/usr/bin/env node
'use strict';
// Scaffold a new language file by copying en.js (the reference set) and
// rewriting its registration line. Interactive:
//
//   npm run i18n:new            prompts for the language code
//   npm run i18n:new -- de      non-interactive (code as an argument)
//
// The new file starts as a copy of en.js with English values - translate the
// VALUES in place (keys and {placeholders} stay). Run `npm run i18n:report`
// afterwards to track keys added to en.js later.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const I18N_DIR = path.resolve(__dirname, '..', 'homeassistant', 'www', 'i18n');
const EN_FILE = path.join(I18N_DIR, 'en.js');

// Lowercase base subtag (da, de, fr), optionally a region (pt-br).
function isValidCode(code) {
  return /^[a-z]{2,3}(-[a-z0-9]+)?$/.test(code);
}

function create(rawCode) {
  const code = String(rawCode || '').trim().toLowerCase();

  if (!isValidCode(code)) {
    console.error('Invalid code "' + code + '". Use a lowercase subtag like "da", "de", "fr" (optionally a region, "pt-br").');
    process.exit(1);
  }

  if (code === 'en') {
    console.error('"en" is the reference set (en.js), not a translation.');
    process.exit(1);
  }

  const destPath = path.join(I18N_DIR, code + '.js');

  if (fs.existsSync(destPath)) {
    console.error(code + '.js already exists (homeassistant/www/i18n/' + code + '.js) - nothing created.');
    process.exit(1);
  }

  // A property access: `.da` for identifier-safe codes, `['pt-br']` otherwise
  // (a hyphen would parse as subtraction in dot form).
  const accessor = /^[a-z]{2,3}$/.test(code) ? '.' + code : "['" + code + "']";

  const contents = fs.readFileSync(EN_FILE, 'utf8')
    .replace('English UI strings (the complete reference set).',
      code.toUpperCase() + ' translation of en.js - translate the values (keep the keys and every {placeholder}).')
    .replace(/\)\.en(\s*)=(\s*)\{/, ')' + accessor + '$1=$2{');

  fs.writeFileSync(destPath, contents);

  console.log('Created homeassistant/www/i18n/' + code + '.js (copied from en.js).\n');
  console.log('Next:');
  console.log('  1. Translate the values in that file - keep the keys and every {placeholder} unchanged.');
  console.log('     (Any key you delete or leave in English still renders; untranslated keys fall back to en.)');
  console.log('  2. npm run build && npm test');
  console.log('  3. npm run i18n:report   (tracks coverage as keys are added to en.js over time)');
}

function promptForCode() {
  const rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });

  function ask() {
    rlInterface.question('New language code (e.g. da, de, fr): ', function (answer) {
      const code = String(answer || '').trim().toLowerCase();

      if (!isValidCode(code) || code === 'en') {
        console.log('  -> enter a lowercase code like "da", "de", "fr" (not "en").');
        return ask();
      }

      rlInterface.close();
      create(code);
    });
  }

  ask();
}

const argCode = process.argv[2];

if (argCode) {
  create(argCode);
} else if (!process.stdin.isTTY) {
  console.error('No language code given and no interactive terminal. Try: npm run i18n:new -- <code>');
  process.exit(1);
} else {
  promptForCode();
}
