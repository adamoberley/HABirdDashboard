// Name captions beside each bird (issue #97). Standalone page: off by
// default; common and scientific render; the ?labels URL override beats
// config.js; in a packed layout (cluster and ring + flow) no caption
// overlaps another bird's silhouette, another caption, an obstacle or the
// box edge, and tapping a caption opens its bird. Card build: labels
// plumbs through setConfig, bad values are rejected. Review of #107: a
// recentred ring + flow flock draws each bird at its packed angle (no
// caption on its own bird), and a 100-species plate packs with captions in
// about the captions-off time without losing a bird.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const WWW = ROOT + '/homeassistant/www';
const html = fs.readFileSync(WWW + '/index.html', 'utf8');
const MASKS_SRC = fs.readFileSync(WWW + '/masks.js', 'utf8');

// A busy day: fourteen species at mixed counts, so the flock really packs.
const SPECIES = [
  ['Calypte anna', "Anna's Hummingbird", 500, 0.99],
  ['Corvus corax', 'Common Raven', 220, 0.71],
  ['Turdus migratorius', 'American Robin', 160, 0.99],
  ['Cardinalis cardinalis', 'Northern Cardinal', 120, 0.6],
  ['Poecile atricapillus', 'Black-capped Chickadee', 90, 0.99],
  ['Cyanocitta cristata', 'Blue Jay', 70, 0.8],
  ['Zenaida macroura', 'Mourning Dove', 55, 0.99],
  ['Haemorhous mexicanus', 'House Finch', 40, 0.7],
  ['Melospiza melodia', 'Song Sparrow', 30, 0.99],
  ['Sitta carolinensis', 'White-breasted Nuthatch', 22, 0.65],
  ['Agelaius phoeniceus', 'Red-winged Blackbird', 15, 0.99],
  ['Spinus tristis', 'American Goldfinch', 10, 0.5],
  ['Sturnus vulgaris', 'European Starling', 6, 0.99],
  ['Dryobates pubescens', 'Downy Woodpecker', 3, 0.55],
];
const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
const nf = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
function fetcher(species) {
  const summary = species.map(([sci, com, count, conf]) => ({
    scientific_name: sci, common_name: com, count,
    first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: conf,
  }));
  const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
  return function (url) {
    const p = String(url).replace('http://ha.local:8080', '');
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections')) return ok({ data: [] });
    return nf();
  };
}
const bgFetch = fetcher(SPECIES);

const W = 1200, H = 800;
const STRIP_TOP = 700;
function boot({ search, config, species, noFetch, w = W, h = H }) {
  const dom = new JSDOM(html, { url: 'http://ha.local:8123/local/habird/index.html' + search, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  window.fetch = noFetch ? nf : fetcher(species || SPECIES);
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? w : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? h : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.eval(`window.AV_CONFIG = ${JSON.stringify(config)};`);
  window.eval(fs.readFileSync(WWW + '/i18n/en.js', 'utf8'));
  window.eval(MASKS_SRC);
  window.eval(fs.readFileSync(WWW + '/apt.js', 'utf8'));
  const doc = window.document;
  doc.getElementById('collage').getBoundingClientRect = () => ({ left: 0, top: 0, right: w, bottom: h, width: w, height: h });
  const strip = doc.getElementById('nameStrip');
  strip.getBoundingClientRect = () => strip.hidden
    ? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
    : { left: 0, top: STRIP_TOP, right: W, bottom: H, width: W, height: H - STRIP_TOP };
  return { window, errors };
}

// Silhouette of a rendered tile, in collage px: one rect per opaque mask
// cell, decoded the same way apt.js's loadMask does. The tile's mask slug
// is the illustration file name its <img> loads (pose included).
function silhouette(window, tile) {
  const img = tile.querySelector('img');
  const slug = img.getAttribute('src').match(/illustrations\/([^/?]+)\.png/)[1];
  const rec = window.eval('MASKS')[slug];
  assert.ok(rec, 'mask for ' + slug);
  const x = parseFloat(tile.style.left), y = parseFloat(tile.style.top);
  const sx = parseFloat(tile.style.width) / rec.w, sy = parseFloat(tile.style.height) / rec.h;
  // Ring flow draws the <img> rotated (and maybe mirrored) about the tile
  // centre: 'rotate(Ndeg)[ scaleX(-1)]'. Apply the same to each cell's
  // corners and keep the bounding rect of the rotated cell.
  const tf = img.style.transform || '';
  const rm = tf.match(/rotate\((-?[\d.]+)deg\)/);
  const rad = rm ? parseFloat(rm[1]) * Math.PI / 180 : 0;
  const fx = /scaleX\(-1\)/.test(tf) ? -1 : 1;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hw = rec.w * sx / 2, hh = rec.h * sy / 2, ox = x + hw, oy = y + hh;
  const bytes = Buffer.from(rec.bits, 'base64');
  const rects = [];
  for (let i = 0; i < rec.w * rec.h; i++) {
    if ((bytes[i >> 3] >> (7 - (i & 7))) & 1) {
      const cx = i % rec.w, cy = (i / rec.w) | 0;
      if (!rad && fx === 1) { rects.push({ x: x + cx * sx, y: y + cy * sy, w: sx, h: sy }); continue; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < 4; k++) {
        const lx = ((cx + (k & 1)) * sx - hw) * fx, ly = (cy + (k >> 1)) * sy - hh;
        const px = ox + lx * cos - ly * sin, py = oy + lx * sin + ly * cos;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return rects;
}
function captionRect(tile) {
  const cap = tile.querySelector('.gtile-label');
  return {
    x: parseFloat(tile.style.left) + parseFloat(cap.style.left),
    y: parseFloat(tile.style.top) + parseFloat(cap.style.top),
    w: parseFloat(cap.style.width), h: parseFloat(cap.style.height),
  };
}
const hits = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;

// Every caption: inside the box, clear of every bird's silhouette as
// actually rendered (its own bird's included - the drawn outline, at the
// angle the renderer drew it), every other caption and the name strip.
function assertNoOverlap(window, label, minTiles = 10) {
  const doc = window.document;
  const tiles = [...doc.querySelectorAll('.gtile')].filter(t => parseFloat(t.style.left) > -1000);
  assert.ok(tiles.length >= minTiles, label + ': most birds placed: ' + tiles.length);
  const caps = tiles.map(t => {
    assert.ok(t.querySelector('.gtile-label'), label + ': caption on ' + t.getAttribute('data-sci'));
    return captionRect(t);
  });
  const sils = tiles.map(t => silhouette(window, t));
  caps.forEach((c, i) => {
    const who = tiles[i].getAttribute('data-sci');
    assert.ok(c.w > 0 && c.h > 0, label + ': caption has a size: ' + who);
    assert.ok(c.x >= -0.01 && c.y >= -0.01 && c.x + c.w <= W + 0.01 && c.y + c.h <= H + 0.01,
      `${label}: caption inside the box: ${who} ${JSON.stringify(c)}`);
    tiles.forEach((t, j) => {
      const other = t.getAttribute('data-sci');
      assert.ok(!sils[j].some(r => hits(c, r)), `${label}: caption of ${who} lies on ${j === i ? 'its own' : other + "'s"} bird`);
      if (j === i) return;
      assert.ok(!hits(c, caps[j]), `${label}: caption of ${who} overlaps caption of ${other}`);
    });
  });
  return { tiles, caps };
}

let done = 0;
const TOTAL = 7;
function finish(label) {
  console.log(label);
  if (++done === TOTAL) { console.log('\nNAME LABEL TESTS PASSED'); process.exit(0); }
}
function fail(tag, e) { console.error(tag + ' FAIL:', e && e.stack || e); process.exit(1); }

// --- A: default config -> no captions at all ---
{
  const { window, errors } = boot({ search: '', config: { birdnetGoUrl: '' } });
  setTimeout(() => {
    try {
      const doc = window.document;
      assert.ok(doc.querySelectorAll('.gtile').length >= 10, 'collage renders');
      assert.strictEqual(doc.querySelectorAll('.gtile-label').length, 0, 'no captions by default');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('A: off by default');
    } catch (e) { fail('A', e); }
  }, 2500);
}

// --- B: labels:'common' + names strip on: captions render, pack clear of
//     every other bird, caption and the strip; tap a caption -> its bird ---
{
  const { window, errors } = boot({ search: '', config: { birdnetGoUrl: '', labels: 'common', names: 'common', namesSize: 15 } });
  setTimeout(() => {
    try {
      const doc = window.document;
      const { tiles, caps } = assertNoOverlap(window, 'B');
      const anna = tiles.find(t => t.getAttribute('data-sci') === 'Calypte anna');
      const cap = anna.querySelector('.gtile-label');
      assert.strictEqual(cap.textContent, "Anna's Hummingbird", 'common name');
      assert.strictEqual(cap.getAttribute('data-mode'), 'common', 'mode attr');
      assert.strictEqual(cap.getAttribute('aria-hidden'), 'true', 'caption hidden from AT (tile has the aria-label)');
      assert.strictEqual(cap.getAttribute('dir'), 'auto', 'caption keeps its own text direction');
      assert.strictEqual(doc.getElementById('collage').style.getPropertyValue('--gl-size'), '15px', 'shared names size');
      // Clear of the names strip (stamped as an obstacle with 12px air).
      caps.forEach(c => assert.ok(c.y + c.h <= STRIP_TOP - 12 + 0.01, 'caption overlaps the name strip: ' + JSON.stringify(c)));
      // Every caption sits under its own bird's box (hangs below the drawing).
      tiles.forEach((t, i) => assert.ok(caps[i].y >= parseFloat(t.style.top) + 1, 'caption below its bird'));
      // Tapping a caption opens its bird, like tapping the bird.
      const raven = tiles.find(t => t.getAttribute('data-sci') === 'Corvus corax');
      const rc = captionRect(raven);
      doc.getElementById('collage').dispatchEvent(new window.MouseEvent('click', {
        bubbles: true, clientX: rc.x + rc.w / 2, clientY: rc.y + rc.h / 2 }));
      assert.strictEqual(doc.getElementById('detail-modal').getAttribute('aria-hidden'), 'false', 'tap on a caption opens the detail modal');
      setTimeout(() => {
        try {
          assert.strictEqual(doc.getElementById('modalCommon').textContent, 'Common Raven', 'modal shows the captioned species');
          assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
          finish('B: labels=common render, pack clear of birds/captions/strip, tap OK');
        } catch (e) { fail('B', e); }
      }, 400);
    } catch (e) { fail('B', e); }
  }, 2500);
}

// --- C: ?labels=scientific overrides config, in a ring + flow layout where
//     the birds are rotated: captions still clear every other bird ---
{
  const { window, errors } = boot({ search: '?labels=scientific&ring&flow=cw', config: { birdnetGoUrl: '', labels: 'common' } });
  setTimeout(() => {
    try {
      const doc = window.document;
      const { tiles } = assertNoOverlap(window, 'C');
      tiles.forEach(t => {
        const cap = t.querySelector('.gtile-label');
        assert.strictEqual(cap.getAttribute('data-mode'), 'scientific', 'URL mode wins');
        assert.strictEqual(cap.textContent, t.getAttribute('data-sci'), 'scientific name');
      });
      assert.ok(tiles.some(t => /rotate/.test(t.querySelector('img').style.transform)), 'flow rotated some birds');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('C: ?labels=scientific beats config; ring + flow captions clear');
    } catch (e) { fail('C', e); }
  }, 2500);
}

// --- D: ?labels=off turns config captions off for this display ---
{
  const { window, errors } = boot({ search: '?labels=off', config: { birdnetGoUrl: '', labels: 'common' } });
  setTimeout(() => {
    try {
      const doc = window.document;
      assert.ok(doc.querySelectorAll('.gtile').length >= 10, 'collage renders');
      assert.strictEqual(doc.querySelectorAll('.gtile-label').length, 0, '?labels=off wins over config');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('D: ?labels=off overrides config');
    } catch (e) { fail('D', e); }
  }, 2500);
}

// --- E: card build - labels via setConfig; bad value rejected ---
{
  const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
  window.fetch = bgFetch;
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? W : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? H : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  assert.throws(() => card.setConfig({ labels: 'both' }), /labels must be/, 'bad labels value rejected');
  card.setConfig({ labels: 'scientific', names_size: 16 });
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  setTimeout(() => {
    try {
      const root = card.shadowRoot;
      const caps = [...root.querySelectorAll('.gtile .gtile-label')];
      assert.ok(caps.length >= 10, 'card captions rendered: ' + caps.length);
      assert.ok(caps.every(c => c.getAttribute('data-mode') === 'scientific'), 'card mode');
      assert.strictEqual(root.getElementById('collage').style.getPropertyValue('--gl-size'), '16px', 'card size');
      const css = root.querySelector('style').textContent;
      assert.ok(css.includes('.gtile-label {'), 'caption CSS inlined');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('E: card labels plumb through setConfig');
    } catch (e) { fail('E', e); }
  }, 2500);
}

// --- F: ring + flow, two birds, recentred (review of #107). The flock is
//     shifted to the middle of the box after packing; each bird must be
//     drawn at the angle it was packed at, or a re-angled wing dips into
//     its own caption. 1200x800, 0.1 hole, 0.5 strength, 0.25 fill, 24px
//     scientific captions: Saxicola stejnegeri's mask used to land ~10px
//     into its own caption box. ---
{
  const { window, errors } = boot({
    search: '?ring&hole=0.1&flow=cw&strength=0.5&labels=scientific',
    config: { birdnetGoUrl: '', collageFill: 0.25, namesSize: 24 },
    species: [
      ['Ptilinopus regina', 'Rose-crowned Fruit-Dove', 40, 0.5],
      ['Saxicola stejnegeri', 'Amur Stonechat', 12, 0.5],
    ],
  });
  setTimeout(() => {
    try {
      const { tiles } = assertNoOverlap(window, 'F', 2);
      assert.strictEqual(tiles.length, 2, 'both birds placed');
      assert.ok(tiles.every(t => /rotate/.test(t.querySelector('img').style.transform)), 'both birds banked');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      finish('F: recentred ring + flow - no caption on its own (re-angled) bird');
    } catch (e) { fail('F', e); }
  }, 2500);
}

// --- G: 100 species on a 1920x1080 layout (review of #107). Captions must
//     not turn a repack into a multi-second freeze (it was ~16x and ~28x the
//     captions-off time at 24px and 40px), and must never cost a bird the
//     captions-off layout places. The bound is generous so a slow CI box
//     doesn't flake; the target is ~2x. ---
{
  const BW = 1920, BH = 1080;
  function layout100(config) {
    const { window, errors } = boot({ search: '', config: Object.assign({ birdnetGoUrl: '' }, config), noFetch: true, w: BW, h: BH });
    const t0 = process.hrtime.bigint();
    window.__layout({ n: 100 });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const tiles = [...window.document.querySelectorAll('.gtile')];
    const placed = tiles.filter(t => parseFloat(t.style.left) > -1000);
    const caps = placed.filter(t => t.querySelector('.gtile-label')).length;
    const who = placed.map(t => t.getAttribute('data-sci'));
    return { ms, tiles: tiles.length, placed: placed.length, who, caps, errors };
  }
  try {
    const off = layout100({});
    const c24 = layout100({ labels: 'common', namesSize: 24 });
    const c40 = layout100({ labels: 'common', namesSize: 40 });
    const fmt = r => `${Math.round(r.ms)}ms placed ${r.placed}/${r.tiles}, ${r.caps} captions`;
    console.log(`G timings: off ${fmt(off)}; 24px ${fmt(c24)}; 40px ${fmt(c40)}`);
    assert.strictEqual(off.tiles, 100, '100 tiles');
    [c24, c40].forEach((r, i) => {
      const tag = i ? '40px' : '24px';
      const lost = off.who.filter(sci => !r.who.includes(sci));
      assert.deepStrictEqual(lost, [], `${tag}: captions cost birds the captions-off layout places`);
      assert.ok(r.caps > 0, `${tag}: some captions drawn`);
      assert.ok(r.ms <= Math.max(4 * off.ms, off.ms + 3000),
        `${tag}: captioned pack took ${Math.round(r.ms)}ms vs ${Math.round(off.ms)}ms with captions off`);
      assert.deepStrictEqual(r.errors, [], tag + ' errors: ' + r.errors.join('; '));
    });
    finish('G: 100 species - captions stay cheap and lose no bird');
  } catch (e) { fail('G', e); }
}

// --- H: the bird-only fallback keeps every bird (second review of #107).
//     Caption passes sort the tiles in place; the fallback restored their
//     sizes but kept the reordered ties, and on a crowded plate (340x300, 40
//     equal birds, fill 0.8, widest spacing, 40px captions) it then placed
//     one bird fewer than captions-off. ---
{
  function crowded(config) {
    const { window, errors } = boot({ search: '', noFetch: true, w: 340, h: 300,
      config: Object.assign({ birdnetGoUrl: '', collageFill: 0.8, collageSpacing: 1 }, config) });
    window.__layout({ n: 40, weights: 'uniform' });
    const placed = [...window.document.querySelectorAll('.gtile')]
      .filter(t => parseFloat(t.style.left) > -1000).map(t => t.getAttribute('data-sci'));
    return { placed, errors };
  }
  try {
    const off = crowded({});
    const on = crowded({ labels: 'common', namesSize: 40 });
    const lost = off.placed.filter(sci => !on.placed.includes(sci));
    assert.deepStrictEqual(lost, [], 'captions cost birds the captions-off layout places');
    assert.deepStrictEqual(on.errors, [], 'errors: ' + on.errors.join('; '));
    finish(`H: crowded fallback keeps all ${off.placed.length} birds`);
  } catch (e) { fail('H', e); }
}
