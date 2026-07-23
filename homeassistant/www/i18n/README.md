# Translations

The Bird Card's UI chrome (headings, tooltips, modal labels, buttons, empty
states, …) is translatable. Bird **common names** are supplied by BirdNET-Go in
its own locale and are intentionally *not* translated here; scientific names
never are.

## How it works

- One file per language in this folder: `en.js`, `da.js`, … Each self-registers
  into a global table:

  ```js
  (window.HABIRD_I18N = window.HABIRD_I18N || {}).da = {
    'view.collage': 'collage',
    'window.today': 'i dag',
    // …
  };
  ```

- **`en.js` is the reference set** — it holds *every* key and is the fallback
  for all other languages. At runtime the app looks up a key in the active
  language and, if it's absent, falls back to the English value (and finally to
  the key name). So a language file only needs the keys it actually translates;
  **anything it omits safely shows in English.**

- The active language is resolved once at startup from, in order: the card's
  `language:` config override → Home Assistant's UI language → `navigator.language`
  (standalone page) → `en`. Only the base subtag matters (`pt-BR` → `pt`).

- Both consumers pick languages up automatically: the card build
  (`homeassistant/card/build.js`) globs and inlines every `*.js` here, and the
  standalone page loads `en.js` + the detected language. **Adding a new language
  is a single new file in this folder — no other edits.**

## Add a language

Scaffold the file:

```sh
npm run i18n:new           # prompts for the code, e.g. da
npm run i18n:new -- de     # or pass it directly
```

This copies `en.js` to `<code>.js` with the registration line rewritten (and
refuses if the file already exists). Then:

1. Translate the **values** in the new file. Keep the **keys** exactly as in
   `en.js`, and keep every `{placeholder}` (see rules below).
2. You may delete keys you don't want to translate yet — they fall back to
   English. (Or translate incrementally; see the report below.)
3. Rebuild and test:

   ```sh
   npm run build && npm test
   ```

Nothing else needs editing — the card build globs this folder and the standalone
page loads `en` + the detected language automatically.

## Rules translators must follow

- **Never change keys** — only values. Keys are the contract with the code.
- **Keep every `{placeholder}` intact.** If the English value has `{n}`,
  `{window}`, `{code}`, etc., the translation must contain the same tokens
  (order is free). Dropping one silently loses the interpolated value — the
  coverage test **fails** on a placeholder mismatch.
- **Don't translate stable codes.** Rarity/label *codes* (`common`, `rare`, …)
  are compared in code; only their display keys (`rarity.common`, …) are
  translated. If unsure, translate only keys that already exist in `en.js`.
- **Preserve markup** in rich values like `about.body` — translate the prose,
  keep the `<a href="…">…</a>` tags as-is.

## See what's missing

Missing translations never break the build (they just show in English), so use
the report to find them:

```sh
npm run i18n:report
```

Example:

```
i18n coverage — reference: en (170 keys)

da  99%  (169/170 translated)
  missing (1): modal.scrub
```

To get the untranslated keys pre-filled with their English value, ready to
paste into the language file and translate:

```sh
npm run i18n:report -- --stub da
```

```
  // —— UNTRANSLATED (1 keys, currently fall back to English) ——
  "modal.scrub": "scrub",
```

## The coverage test

`npm test` runs `tests/test-i18n-coverage.js`, which **reports** missing keys
(never fails on them) but **fails** on structural bugs:

- **Extra keys** — a key present in a language file but not in `en.js` (a typo,
  or a key renamed in `en` and not updated here). These are unreachable dead
  entries.
- **Placeholder mismatches** — see the rule above.

So the workflow for a developer adding a new English string is simply: add the
key to `en.js`. CI will then *report* it as untranslated for every other
language (no failure), and a translator can pick it up later via
`npm run i18n:report`.
