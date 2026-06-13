#!/usr/bin/env node
// HABirdDashboard - build the custom Lovelace card from the shared source.
//
// The static page under homeassistant/www/ stays the single source of
// truth; this script transforms it into dist/habird-card.js, a
// self-contained <habird-card> web component:
//
//   - the app runs inside a shadow root (document.* -> shadow root,
//     position:fixed -> absolute within the card, body -> an .av-shell
//     wrapper div)
//   - URL-hash routing becomes internal state (a card must not own the
//     browser URL)
//   - configuration comes from the card's setConfig() instead of
//     config.js, and weather reads the hass object HA injects - no token
//   - bird artwork lazy-loads from a CDN view of this repo (or any
//     image_base the user configures), so nothing is copied to /config/www
//
// Run:  node homeassistant/card/build.js
// Out:  dist/habird-card.js  (committed - HACS serves it from the repo)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WWW = path.join(ROOT, 'homeassistant', 'www');
const OUT = path.join(ROOT, 'dist', 'habird-card.js');

const appSrc = fs.readFileSync(path.join(WWW, 'apt.js'), 'utf8');
// Generated silhouette tables (DIMS/MASKS) live in their own file so the
// app source stays reviewable; the card build inlines them - the shipped
// artifact remains a single self-contained .js for HACS.
const masksSrc = fs.readFileSync(path.join(WWW, 'masks.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(WWW, 'styles.css'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');

// ---------- Template: <body> contents, scripts stripped, in a shell div ----------
const bodyMatch = htmlSrc.match(/<body[^>]*>([\s\S]*)<\/body>/);
if (!bodyMatch) throw new Error('no <body> in index.html');
const template = '<div class="av-shell av-local">'
  + bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '')
  + '</div>';

// ---------- CSS: scope to the shadow root / card box ----------
let css = cssSrc
  .replace(/:root\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
  .replace(/:root \{/g, ':host {')
  // the html/body page rules become the shell wrapper's
  .replace(/html, body \{/g, '.av-shell {')
  .replace(/(^|\n)(\s*)body \{/g, '$1$2.av-shell {')
  .replace(/body\.av-local/g, '.av-shell.av-local')
  .replace(/body\.admin-on/g, '.av-shell.admin-on')
  .replace(/body\.ww-cursor-hidden/g, '.av-shell.ww-cursor-hidden')
  .replace(/body\.av-title-overlay/g, '.av-shell.av-title-overlay')
  .replace(/body\.av-picker-top/g, '.av-shell.av-picker-top')
  .replace(/body\.av-no-picker/g, '.av-shell.av-no-picker')
  // app chrome pinned to the app frame, not the browser viewport
  .replace(/position: fixed/g, 'position: absolute')
  // Responsiveness must track the CARD's box, not the browser window: a
  // narrow card on a wide desktop needs the compact layouts. The :host
  // is declared a size container below; width media queries become
  // container queries and viewport units become container units.
  .replace(/@media \(max-width: (\d+)px\)/g, '@container av-card (max-width: $1px)')
  .replace(/@media \(min-width: (\d+)px\)/g, '@container av-card (min-width: $1px)')
  .replace(/(\d+(?:\.\d+)?)vh/g, '$1cqh')
  .replace(/(\d+(?:\.\d+)?)vw/g, '$1cqw');

css += `
/* ---- card-build additions ---- */
:host {
  display: block; position: relative;
  width: 100%; height: 100%; min-height: 560px;
  overflow: hidden;
  border-radius: var(--ha-card-border-radius, 12px);
  /* The card box is the responsive container all @container rules and
     cq units resolve against. */
  container: av-card / size;
}
.av-shell { position: absolute; inset: 0; overflow: hidden; }
/* Card default: transparent, so the collage sits directly on the HA
   dashboard. background: paper restores the page's warm ground. */
.av-shell { background: transparent; }
.av-shell.av-bg-paper { background: var(--paper); }
/* font: system swaps the editorial serif/mono pairing for HA's own
   typeface (set per-theme by HA; Roboto stock). */
.av-shell.av-font-system {
  --av-font-display: var(--ha-font-family-body, var(--mdc-typography-font-family, Roboto, "Segoe UI", sans-serif));
  --av-font-mono: var(--ha-font-family-body, var(--mdc-typography-font-family, Roboto, "Segoe UI", sans-serif));
}
/* The view picker hugs the card's bottom edge (the page floats it higher). */
.slider { bottom: 10px; }
/* The collage owns the WHOLE card - no reserved band for the picker
   (it's stamped into the packing grid as an obstacle instead), so the
   flock centres in the true middle of the card. */
.view#v0 { padding: 12px 14px; }
/* Clock/weather sit a finger's width off the card's true corners. */
.wall-widgets[data-corner$="right"] { right: 16px; }
.wall-widgets[data-corner$="left"]  { left: 16px; }
.wall-widgets[data-corner^="top"]   { top: 12px; }
.wall-widgets[data-corner^="bottom"] { bottom: 14px; }
/* In system-font mode the empty state reads as a normal sentence in the
   configured font instead of editorial letterspaced small-caps. */
.av-shell.av-font-system .empty {
  font: 14px/1.5 var(--av-font-mono);
  text-transform: none; letter-spacing: 0;
}
/* In system-font mode the picker drops the editorial small-caps treatment
   and reads like native HA tabs. */
.av-shell.av-font-system .slider button {
  font: 500 13px/1 var(--av-font-mono);
  letter-spacing: 0; text-transform: capitalize;
  padding: 9px 16px;
}
/* BirdNET-Pi admin chrome has no backend here (same as the static HA build). */
#menuBtn, #menu-dd, #returnToAtlas, #adminScreen { display: none !important; }
`;

// ---------- JS: rebase the app onto the shadow root ----------
let app = appSrc;
function must(s, from, to, minCount) {
  const n = s.split(from).length - 1;
  if (n < (minCount == null ? 1 : minCount)) {
    throw new Error('transform expected >=' + (minCount == null ? 1 : minCount) +
      ' of ' + JSON.stringify(from) + ', found ' + n);
  }
  return s.split(from).join(to);
}

// Validate the IIFE shape up front; the actual wrap happens AFTER the
// text transforms so the shim preamble (which legitimately contains
// patterns like window.addEventListener('resize', ...)) is never
// rewritten by its own transforms.
if (!app.startsWith('(function () {')) throw new Error('unexpected app header');
if (!app.trimEnd().endsWith('})();')) throw new Error('unexpected app footer');

const PREAMBLE = `function runHABirdApp(__root, __shell, __cardConfig, __imgBase) {
  // ---- card-build shims (see homeassistant/card/build.js) ----
  var __realdoc = document;
  var __host = __root.host;
  // Internal stand-in for location.hash: a card must not rewrite the
  // browser URL. Writes fire the app's router on the next tick, like a
  // real hashchange.
  var __route = {
    _h: '', onchange: null,
    get hash() { return this._h; },
    set hash(v) {
      v = v ? (String(v).charAt(0) === '#' ? String(v) : '#' + v) : '';
      if (v === this._h) return;
      this._h = v;
      var self = this;
      setTimeout(function () { if (self.onchange) self.onchange(); }, 0);
    },
  };
  // Resize plumbing: handlers registered here run on window resizes AND
  // card-box resizes (the wrapper wires a ResizeObserver to __fireResize).
  var __resizeFns = [];
  function __onResize(fn) {
    __resizeFns.push(fn);
    window.addEventListener('resize', fn);
  }
  __root.__fireResize = function () {
    __resizeFns.forEach(function (fn) { try { fn(); } catch (e) {} });
  };
`;

// Keep page-visibility on the real document (shadow roots have none),
// then move every other document-level hook into the shadow root.
app = must(app, "document.addEventListener('visibilitychange'", "__realdoc.addEventListener('visibilitychange'");
app = must(app, 'document.addEventListener(', '__root.addEventListener(', 5);
app = must(app, 'document.getElementById(', '__root.getElementById(', 50);
app = must(app, 'document.querySelector', '__root.querySelector', 3);
app = must(app, 'document.contains(', '__root.contains(');
app = must(app, 'document.body', '__shell', 2);
app = must(app, 'document.documentElement', '__host', 3);
app = must(app, "window.addEventListener('hashchange', syncRouter);", '__route.onchange = syncRouter;');
app = must(app, 'location.hash', '__route.hash', 8);
app = must(app, "window.addEventListener('resize',", '__onResize(', 2);
app = must(app, 'var AV_CFG = window.AV_CONFIG || {};', 'var AV_CFG = __cardConfig || {};');
app = must(app, "'./assets/illustrations/'", "(__imgBase + 'illustrations/')", 2);
app = must(app, "'./assets/cutouts/'", "(__imgBase + 'cutouts/')");

// Now wrap: IIFE -> named function taking the card's plumbing.
app = app.replace('(function () {', PREAMBLE);
app = app.replace(/\}\)\(\);\s*$/, '}\n');

// Anything still touching `document.` must be on the whitelist.
const leftover = [...app.matchAll(/document\.(\w+)/g)].map((m) => m[1]);
const allowed = new Set(['createElement', 'fonts', 'hidden', 'cookie']);
const bad = leftover.filter((name) => !allowed.has(name));
if (bad.length) throw new Error('unscoped document usage: ' + [...new Set(bad)].join(', '));

// ---------- Card wrapper ----------
const wrapper = `
// Default artwork source: this repo via jsDelivr. Only species you have
// actually heard are ever fetched (one PNG per species+pose, cached by
// the browser). Point image_base at '/local/habird/assets/' instead if
// you copied the artwork locally (homeassistant/install.sh layout).
var HABIRD_CDN_ASSETS = 'https://cdn.jsdelivr.net/gh/adamoberley/HABirdDashboard@HABirdDashboard/avian/assets/';

var HABIRD_VERSION = '1.1.0';

var HABIRD_EDITOR_SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: '', type: 'grid', schema: [
    { name: 'background', selector: { select: { mode: 'dropdown', options: [
      { value: 'transparent', label: 'Transparent' },
      { value: 'paper', label: 'Paper' },
    ] } } },
    { name: 'font', selector: { select: { mode: 'dropdown', options: [
      { value: 'system', label: 'Home Assistant' },
      { value: 'serif', label: 'Editorial serif' },
    ] } } },
  ] },
  { name: 'dashboard', type: 'expandable', flatten: true, title: 'Dashboard', schema: [
    { name: '', type: 'grid', schema: [
      { name: 'view', selector: { select: { mode: 'dropdown', options: [
        { value: 'collage', label: 'Collage' },
        { value: 'stats', label: 'Stats' },
        { value: 'atlas', label: 'Atlas' },
      ] } } },
      { name: 'window', selector: { select: { mode: 'dropdown', options: [
        { value: '1', label: 'Last hour' },
        { value: '12', label: 'Last 12 hours' },
        { value: '24', label: 'Last 24 hours' },
        { value: '72', label: 'Last 3 days' },
        { value: '168', label: 'Last 7 days' },
        { value: '336', label: 'Last 14 days' },
        { value: '720', label: 'Last 30 days' },
        { value: 'all', label: 'All time' },
      ] } } },
    ] },
    { name: '', type: 'grid', schema: [
      { name: 'view_selector', selector: { boolean: {} } },
      { name: 'selector_position', selector: { select: { mode: 'dropdown', options: [
        { value: 'bottom', label: 'Bottom' },
        { value: 'top', label: 'Top' },
      ] } } },
    ] },
    { name: 'collage_scale', selector: { number: { min: 0.5, max: 3, step: 0.1, mode: 'slider' } } },
    { name: '', type: 'grid', schema: [
      { name: 'clock', selector: { boolean: {} } },
      { name: 'weather', selector: { boolean: {} } },
    ] },
    { name: 'weather_entity', selector: { entity: { domain: 'weather' } } },
    { name: '', type: 'grid', schema: [
      { name: 'corner', selector: { select: { mode: 'dropdown', options: [
        { value: 'bottom-right', label: 'Bottom right' },
        { value: 'bottom-left', label: 'Bottom left' },
        { value: 'top-right', label: 'Top right' },
        { value: 'top-left', label: 'Top left' },
      ] } } },
      { name: 'hide_cursor', selector: { boolean: {} } },
    ] },
  ] },
  { name: 'birds', type: 'expandable', flatten: true, title: 'Birds & audio', schema: [
    { name: 'tap_action', selector: { select: { mode: 'dropdown', options: [
      { value: 'both', label: 'Open info + play call (default)' },
      { value: 'info', label: 'Open info only' },
      { value: 'call', label: 'Play reference call only' },
    ] } } },
    { name: 'xeno_canto_key', selector: { text: {} } },
    { name: 'sit_confidence', selector: { number: { min: 0, max: 1.01, step: 0.01, mode: 'slider' } } },
    { name: 'audio_boost', selector: { number: { min: 0, max: 24, step: 6, mode: 'slider', unit_of_measurement: 'dB' } } },
    { name: 'image_base', selector: { text: {} } },
  ] },
  { name: 'connection', type: 'expandable', flatten: true, title: 'Connection & data', schema: [
    { name: 'data_source', selector: { select: { mode: 'dropdown', options: [
      { value: 'auto', label: 'Automatic' },
      { value: 'api', label: 'BirdNET-Go API only' },
      { value: 'ha', label: 'MQTT history only' },
    ] } } },
    { name: 'birdnet_url', selector: { text: {} } },
    { name: '', type: 'grid', schema: [
      { name: 'history_days', selector: { number: { min: 1, max: 365, step: 1, mode: 'box', unit_of_measurement: 'days' } } },
      { name: 'poll_seconds', selector: { number: { min: 10, max: 3600, step: 10, mode: 'box', unit_of_measurement: 's' } } },
    ] },
  ] },
];
var HABIRD_LABELS = {
  view: 'View',
  window: 'Time window',
  title: 'Title',
  view_selector: 'Show the view switcher',
  selector_position: 'Switcher position',
  background: 'Background',
  font: 'Font',
  clock: 'Clock',
  weather: 'Weather',
  weather_entity: 'Weather entity',
  corner: 'Corner',
  hide_cursor: 'Hide idle cursor',
  sit_confidence: 'Sit confidence',
  audio_boost: 'Recording volume boost',
  tap_action: 'Tap on a bird',
  xeno_canto_key: 'Xeno-Canto API key',
  collage_scale: 'Collage scale',
  image_base: 'Artwork base URL',
  birdnet_url: 'BirdNET-Go URL',
  data_source: 'Data source',
  history_days: 'History span',
  poll_seconds: 'Refresh interval',
};
var HABIRD_HELPERS = {
  title: 'Default (blank): no heading. Any text adds a title the birds pack around, clock-style.',
  view_selector: 'Turn off to lock this card to one view.',
  selector_position: 'Top pairs poorly with a title - both sit centred up top.',
  weather_entity: 'Default (blank): the first weather.* entity found.',
  hide_cursor: 'For wall displays: pointer disappears after 8 s idle.',
  sit_confidence: 'Birds perch at or above this detection confidence and fly below it. 0 = always perched, 1.01 = always flying.',
  audio_boost: "Detection clips are quiet; the boost is compressed so louder doesn't clip. 0 dB = off.",
  tap_action: "What tapping a bird does. Default opens the info modal and plays the reference call. Call/both need a Xeno-Canto key; without one they fall back to just opening info.",
  xeno_canto_key: "Default (blank): reference calls off. A free key from xeno-canto.org/account turns them on - a clean example call to compare against your station's own captures.",
  collage_scale: 'How much of the card the flock claims. Birds always shrink to fit, so bigger is safe.',
  image_base: 'Default (blank): artwork from the CDN. Use /local/habird-art/ for an offline copy.',
  birdnet_url: 'Default (blank): this host on port 8080, or HA ingress when remote.',
  data_source: 'Automatic uses the API and falls back to the MQTT sensors.',
  history_days: 'How far MQTT history reaches; bounded by recorder retention.',
  poll_seconds: 'Safety-net refresh. MQTT pushes new detections instantly.',
};

class HABirdCard extends HTMLElement {
  setConfig(config) {
    config = config || {};
    if (config.view && ['collage', 'stats', 'atlas'].indexOf(config.view) < 0) {
      throw new Error("view must be 'collage', 'stats' or 'atlas'");
    }
    if (config.window && config.window !== 'all' && !(+config.window > 0)) {
      throw new Error("window must be a positive number of hours or 'all'");
    }
    if (config.sit_confidence != null &&
        (typeof config.sit_confidence !== 'number' || config.sit_confidence < 0 || config.sit_confidence > 1.01)) {
      throw new Error('sit_confidence must be a number from 0 to 1.01');
    }
    this._config = config;
    // Height follows HA's own card sizing (getGridOptions); theme always
    // follows Home Assistant (see _applyHassTheme) - neither is configurable.
    // Config changes after boot (dashboard editor live preview) need a
    // fresh app instance - cheapest correct thing is a full re-boot.
    if (this._booted) {
      this._booted = false;
      if (this.shadowRoot) this.shadowRoot.innerHTML = '';
      if (this.isConnected) this._boot();
    }
  }
  set hass(hass) {
    this._hass = hass;
    this._applyHassTheme();
    this._watchDetections(hass);
  }
  // Push-driven data: HA hands the card a fresh hass object on every
  // state change. When a BirdNET-Go MQTT sensor (scientific name /
  // confidence) advances, refresh the collage right away (debounced for
  // the burst of sibling sensor updates) instead of waiting for the
  // safety-net poll.
  _watchDetections(hass) {
    if (!hass || !hass.states || !this._refresh) return;
    if (!this._watchIds) {
      var ids = [];
      Object.keys(hass.states).forEach(function (id) {
        if (/_scientific_name$/.test(id)) {
          ids.push(id, id.replace(/_scientific_name$/, '_confidence'));
        }
      });
      this._watchIds = ids;
    }
    if (!this._watchIds.length) return;
    var stamp = this._watchIds.map(function (id) {
      var st = hass.states[id];
      return st ? (st.last_updated || st.last_changed || st.state) : '';
    }).join('|');
    if (this._lastStamp != null && stamp !== this._lastStamp) {
      clearTimeout(this._refreshT);
      var self = this;
      this._refreshT = setTimeout(function () {
        if (self._refresh) self._refresh();
      }, 1200);
    }
    this._lastStamp = stamp;
  }
  // Always follow Home Assistant's light/dark mode. Re-applied after boot
  // too: the app applies its own saved theme while initialising, which
  // would otherwise clobber the hass-driven choice.
  _applyHassTheme() {
    if (this._hass && this._hass.themes) {
      if (this._hass.themes.darkMode) this.setAttribute('data-theme', 'dark');
      else this.removeAttribute('data-theme');
    }
  }
  connectedCallback() { this._boot(); }
  _boot() {
    if (this._booted) return;
    this._booted = true;
    var c = this._config || {};
    var root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    root.innerHTML = HABIRD_TEMPLATE + '<style>' + HABIRD_CSS + '</style>';
    var shell = root.querySelector('.av-shell');
    if ((c.font || 'system') !== 'serif') shell.classList.add('av-font-system');
    if ((c.background || 'transparent') === 'paper') shell.classList.add('av-bg-paper');
    var self = this;
    var avConfig = {
      title: c.title || '',                  // '' = no title block
      view: c.view || 'collage',             // which view this card shows
      viewSelector: c.view_selector !== false,
      selectorPosition: c.selector_position || 'bottom',
      windowHours: c.window || 24,           // hours, or 'all'
      birdnetGoUrl: c.birdnet_url || '',
      dataSource: c.data_source || 'auto',
      historyDays: c.history_days,
      haSensors: c.ha_sensors,   // YAML-only: explicit *_scientific_name entity ids
      // MQTT sensor updates push refreshes (see _watchDetections), so the
      // timer is just a safety net - much longer than the page's 30s.
      pollSeconds: c.poll_seconds || 60,
      __budgetScale: (typeof c.collage_scale === 'number' && c.collage_scale > 0)
        ? c.collage_scale
        : 1.5,   // birds command a card harder than a full page
      audioBoostDb: (c.audio_boost == null ? 24 : +c.audio_boost),
      tapAction: c.tap_action || 'both',          // both | info | call
      xenoCantoKey: c.xeno_canto_key || '',        // enables reference calls
      __exposeRefresh: function (fn) { self._refresh = fn; },
      sitConfidence: (typeof c.sit_confidence === 'number') ? c.sit_confidence : 0.90,
      wall: {
        clock: !!c.clock,
        weather: !!c.weather,
        corner: c.corner || 'bottom-right',
        hideCursor: !!c.hide_cursor,
        weatherEntity: c.weather_entity || '',
        fahrenheit: !!c.fahrenheit,   // BirdNET-Go fallback only; hass uses HA units
      },
      __getHass: function () { return self._hass; },
    };
    var imgBase = (c.image_base || HABIRD_CDN_ASSETS).replace(/\\/?$/, '/');
    runHABirdApp(root, shell, avConfig, imgBase);
    this._applyHassTheme();
    // Prime the MQTT watch against the current hass so the very next
    // sensor update (not the one after) triggers a push refresh.
    this._watchIds = null;
    this._lastStamp = null;
    this._watchDetections(this._hass);
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        if (root.__fireResize) root.__fireResize();
      });
      this._ro.observe(this);
    }
  }
  disconnectedCallback() {
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  }
  getCardSize() { return 8; }
  // Sections-view sizing: full width, tall by default, never crushed.
  getGridOptions() {
    return { columns: 'full', rows: 8, min_rows: 4 };
  }
  static getStubConfig() {
    return { clock: true, weather: true, corner: 'bottom-right' };
  }
  static getConfigElement() {
    return document.createElement('habird-card-editor');
  }
}

class HABirdCardEditor extends HTMLElement {
  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._config) return;
    if (!this._form) {
      // ha-form ships with the dashboard editor; if a future HA build
      // hasn't defined it yet the visual editor stays empty and HA's
      // YAML editor still works.
      this._form = document.createElement('ha-form');
      this._form.computeLabel = function (s) { return HABIRD_LABELS[s.name] || s.name; };
      this._form.computeHelper = function (s) { return HABIRD_HELPERS[s.name]; };
      var self = this;
      this._form.addEventListener('value-changed', function (ev) {
        var config = Object.assign({}, self._config, ev.detail.value);
        self.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: config }, bubbles: true, composed: true,
        }));
      });
      this.appendChild(this._form);
    }
    this._form.schema = HABIRD_EDITOR_SCHEMA;
    this._form.data = Object.assign({ corner: 'bottom-right', sit_confidence: 0.90, window: '24', background: 'transparent', font: 'system', data_source: 'auto', view: 'collage', view_selector: true, selector_position: 'bottom', collage_scale: 1.5, audio_boost: 24 }, this._config);
    this._form.hass = this._hass;
  }
}

console.info(
  '%c BIRD CARD %c v' + HABIRD_VERSION + ' ',
  'background:#1a1612;color:#ece8e1;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px',
  'background:#4a3f31;color:#ece8e1;border-radius:0 4px 4px 0;padding:2px 6px'
);
if (!customElements.get('habird-card')) customElements.define('habird-card', HABirdCard);
if (!customElements.get('habird-card-editor')) customElements.define('habird-card-editor', HABirdCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(function (c) { return c.type === 'habird-card'; })) {
  window.customCards.push({
    type: 'habird-card',
    name: 'Bird Card',
    description: 'Live bird collage from your BirdNET-Go detections, with optional clock and weather.',
    documentationURL: 'https://github.com/adamoberley/HABirdDashboard',
  });
}
`;

const out = `/* habird-card.js - generated by homeassistant/card/build.js. DO NOT EDIT.
 * Source of truth: homeassistant/www/{apt.js,styles.css,index.html}. */
(function () {
'use strict';
var HABIRD_TEMPLATE = ${JSON.stringify(template)};
var HABIRD_CSS = ${JSON.stringify(css)};

${masksSrc}
${app}
${wrapper}
})();
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + (out.length / 1024 | 0) + ' KB)');
