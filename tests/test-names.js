// Species-name strip (issue #69): the optional line of names along the
// bottom of the collage. Standalone page: config + URL overrides, contents
// and order (most-heard first), font size, i18n aria-label, obstacle
// packing (no bird overlaps the strip), hover lights the bird, tap opens
// the detail modal. Card build: names / names_size plumb through
// setConfig, invalid values are rejected.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const WWW = ROOT + '/homeassistant/www';
const html = fs.readFileSync(WWW + '/index.html', 'utf8');

const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
const nf = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
function bgFetch(url) {
  const p = String(url).replace('http://ha.local:8080', '');
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
  if (p.includes('/analytics/')) return ok({ data: [] });
  if (p.includes('/detections')) return ok({ data: [] });
  return nf();
}

// Strip occupies the bottom 100px of the 1200x800 collage box when shown.
const STRIP_TOP = 700;
function boot({ search, config }) {
  const dom = new JSDOM(html, { url: 'http://ha.local:8123/local/habird/index.html' + search, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  window.fetch = bgFetch;
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.eval(`window.AV_CONFIG = ${JSON.stringify(config)};`);
  window.eval(fs.readFileSync(WWW + '/i18n/en.js', 'utf8'));
  window.eval(fs.readFileSync(WWW + '/masks.js', 'utf8'));
  window.eval(fs.readFileSync(WWW + '/apt.js', 'utf8'));
  // jsdom has no layout: stub the rects renderCollage measures.
  const doc = window.document;
  doc.getElementById('collage').getBoundingClientRect = () => ({ left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 });
  const strip = doc.getElementById('nameStrip');
  strip.getBoundingClientRect = () => strip.hidden
    ? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
    : { left: 0, top: STRIP_TOP, right: 1200, bottom: 800, width: 1200, height: 800 - STRIP_TOP };
  return { window, errors };
}

let done = 0;
const TOTAL = 4;
function finish(label) {
  console.log(label);
  if (++done === TOTAL) { console.log('\nNAME STRIP TESTS PASSED'); process.exit(0); }
}

// --- A: config names:'both' + size; contents, order, obstacle, hover, tap ---
{
  const { window, errors } = boot({ search: '', config: { birdnetGoUrl: '', names: 'both', namesSize: 18 } });
  setTimeout(() => {
    const doc = window.document;
    try {
      const strip = doc.getElementById('nameStrip');
      assert.strictEqual(strip.hidden, false, 'strip shown');
      assert.strictEqual(strip.getAttribute('data-mode'), 'both', 'mode attr');
      assert.strictEqual(strip.style.getPropertyValue('--ns-size'), '18px', 'font size var');
      assert.strictEqual(strip.getAttribute('aria-label'), 'Species heard', 'i18n aria-label applied');
      const items = [...strip.querySelectorAll('.ns-item')];
      assert.strictEqual(items.length, 2, 'one name per species: ' + items.length);
      // Most-heard first, same order as the collage sizes birds.
      assert.strictEqual(items[0].getAttribute('data-sci'), 'Calypte anna', 'order: loudest first');
      assert.strictEqual(items[0].querySelector('.ns-com').textContent, "Anna's Hummingbird", 'common name');
      assert.strictEqual(items[0].querySelector('.ns-sci').textContent, 'Calypte anna', 'scientific name');
      assert.strictEqual(strip.querySelectorAll('.ns-sep').length, 1, 'separators between names only');
      // Obstacle: every bird sits above the strip (less the 12px air margin).
      const tiles = [...doc.querySelectorAll('.gtile')];
      assert.strictEqual(tiles.length, 2, 'tiles rendered: ' + tiles.length);
      for (const t of tiles) {
        const y = parseFloat(t.style.top), h = parseFloat(t.style.height);
        assert.ok(y + h <= STRIP_TOP - 12 + 0.01, `bird overlaps the name strip: top=${y} h=${h}`);
      }
      // Hover a name -> its bird lights up; leave -> it goes dark.
      const anna = tiles.find(t => t.getAttribute('data-sci') === 'Calypte anna');
      items[0].dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
      assert.ok(anna.classList.contains('is-hover'), 'hover lights the bird');
      strip.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: false }));
      assert.ok(!anna.classList.contains('is-hover'), 'leave unlights the bird');
      // Tap a name -> detail modal for that species. The modal opens
      // synchronously; its heading fills once the species fetch resolves.
      items[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      assert.strictEqual(doc.getElementById('detail-modal').getAttribute('aria-hidden'), 'false', 'tap opens the detail modal');
      setTimeout(() => {
        try {
          assert.strictEqual(doc.getElementById('modalCommon').textContent, 'Common Raven', 'modal shows the tapped species');
          assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
          finish('A: names=both renders, packs as an obstacle, hover + tap OK');
        } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
      }, 400);
    } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
  }, 1600);
}

// --- B: default config -> no strip, no obstacle ---
{
  const { window, errors } = boot({ search: '', config: { birdnetGoUrl: '' } });
  setTimeout(() => {
    const doc = window.document;
    try {
      const strip = doc.getElementById('nameStrip');
      assert.strictEqual(strip.hidden, true, 'strip hidden by default');
      assert.strictEqual(strip.innerHTML, '', 'strip empty by default');
      assert.strictEqual(doc.querySelectorAll('.gtile').length, 2, 'collage still renders');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('B: off by default');
    } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
  }, 1600);
}

// --- C: URL overrides beat config (static page): ?names=scientific&names_size=22 ---
{
  const { window, errors } = boot({ search: '?names=scientific&names_size=22', config: { birdnetGoUrl: '', names: 'off' } });
  setTimeout(() => {
    const doc = window.document;
    try {
      const strip = doc.getElementById('nameStrip');
      assert.strictEqual(strip.hidden, false, 'URL turns the strip on');
      assert.strictEqual(strip.getAttribute('data-mode'), 'scientific', 'URL mode');
      assert.strictEqual(strip.style.getPropertyValue('--ns-size'), '22px', 'URL size');
      assert.strictEqual(strip.querySelectorAll('.ns-com').length, 0, 'no common names in scientific mode');
      assert.strictEqual(strip.querySelectorAll('.ns-sci').length, 2, 'scientific names only');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('C: ?names=scientific&names_size=22 overrides config');
    } catch (e) { console.error('C FAIL:', e.message); process.exit(1); }
  }, 1600);
}

// --- D: card build - names / names_size via setConfig; bad values rejected ---
{
  const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  window.fetch = bgFetch;
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  assert.throws(() => card.setConfig({ names: 'latin' }), /names must be/, 'bad names value rejected');
  assert.throws(() => card.setConfig({ names_size: -3 }), /names_size/, 'bad names_size rejected');
  card.setConfig({ names: 'common', names_size: 16 });
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      const strip = root.getElementById('nameStrip');
      assert.ok(strip && !strip.hidden, 'card strip shown');
      assert.strictEqual(strip.getAttribute('data-mode'), 'common', 'card mode');
      assert.strictEqual(strip.style.getPropertyValue('--ns-size'), '16px', 'card size');
      assert.strictEqual(strip.querySelectorAll('.ns-item').length, 2, 'card items');
      assert.strictEqual(strip.querySelectorAll('.ns-sci').length, 0, 'common-only in the card');
      // The card CSS (inlined into the shadow root) carries the strip's rules.
      const css = root.querySelector('style').textContent;
      assert.ok(css.includes('.name-strip {'), 'strip CSS inlined');
      assert.ok(css.includes('.av-shell.av-no-picker .name-strip'), 'card-build bottom offsets present');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('D: card names/names_size plumb through setConfig');
    } catch (e) { console.error('D FAIL:', e.message); process.exit(1); }
  }, 1600);
}
