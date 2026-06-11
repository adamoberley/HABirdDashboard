// Wall mode v2: widgets live in a collage corner and act as a packing
// obstacle. Load with ?wall, stub a BIG widget box covering the right
// half of the collage, and assert no bird tile lands on it. Also check
// the HA-token weather path (Bearer header, entity auto-discovery,
// sun.sun) and the BirdNET-Go fallback.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const WWW = ROOT + '/homeassistant/www';
const html = fs.readFileSync(WWW + '/index.html', 'utf8');

function boot({ search, config, onFetch }) {
  const dom = new JSDOM(html, { url: 'http://ha.local:8123/local/habird/index.html' + search, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push(e.error && e.error.stack || e.message));
  window.fetch = onFetch(window);
  window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.eval(`window.AV_CONFIG = ${JSON.stringify(config)};`);
  window.eval(fs.readFileSync(WWW + '/masks.js', 'utf8'));
  window.eval(fs.readFileSync(WWW + '/apt.js', 'utf8'));
  // jsdom has no layout: stub rects AFTER boot so the wall block can measure.
  const collage = window.document.getElementById('collage');
  collage.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 });
  const wrap = window.document.getElementById('wallWidgets');
  // Obstacle: the entire right half of the collage.
  wrap.getBoundingClientRect = () => wrap.hidden
    ? { left: 0, top: 0, width: 0, height: 0 }
    : { left: 600, top: 0, right: 1200, bottom: 800, width: 600, height: 800 };
  return { window, errors };
}

const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
const nf = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });

function bgData(p) {
  if (p === '/api/v2/analytics/species/summary') return ok(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
  if (p.includes('/analytics/')) return ok({ data: [] });
  if (p.includes('/detections')) return ok({ data: [] });
  return null;
}

const assert = require('assert');
let done = 0;

// --- Scenario A: ?wall + BirdNET-Go weather + obstacle avoidance ---
{
  const { window, errors } = boot({
    search: '?wall&corner=top-right',
    config: { birdnetGoUrl: '', sitConfidence: 0.96, wall: {} },
    onFetch: () => (url) => {
      const p = String(url).replace('http://ha.local:8080', '');
      if (p === '/api/v2/weather/latest') return ok({
        daily: { sunrise: '2026-06-10T05:42:00Z', sunset: '2026-06-10T20:31:00Z' },
        hourly: { temperature: 18.4, weather_desc: 'Partly cloudy' },
      });
      return bgData(p) || nf();
    },
  });
  setTimeout(() => {
    const doc = window.document;
    try {
      assert.strictEqual(doc.getElementById('wallWidgets').getAttribute('data-corner'), 'top-right', 'corner from URL');
      assert.strictEqual(doc.getElementById('wwTemp').textContent, '18°', 'BG temp');
      // Every placed bird must sit entirely left of x=600 (obstacle = right half,
      // less the 12px breathing margin the collage adds).
      const tiles = [...doc.querySelectorAll('.gtile')];
      assert.ok(tiles.length === 2, 'tiles rendered: ' + tiles.length);
      for (const t of tiles) {
        const x = parseFloat(t.style.left), w = parseFloat(t.style.width);
        assert.ok(x + w < 600, `bird overlaps obstacle: left=${x} w=${w}`);
      }
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      console.log('A: obstacle packing + BG weather OK (tiles all left of the clock zone)');
      if (++done === 2) { console.log('\nWALL V2 TESTS PASSED'); process.exit(0); }
    } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
  }, 1600);
}

// --- Scenario B: HA-token weather (auto-discovered entity + sun.sun + Bearer) ---
{
  let sawBearer = false;
  const { window, errors } = boot({
    search: '',
    config: { birdnetGoUrl: '', sitConfidence: 0.96,
      wall: { clock: true, weather: true, haToken: 'TESTTOKEN' } },
    onFetch: () => (url, opts) => {
      const u = String(url);
      const p = u.replace('http://ha.local:8080', '');
      if (u.startsWith('/api/') || u.includes('ha.local:8123/api/')) {
        if ((opts && opts.headers && opts.headers.Authorization) === 'Bearer TESTTOKEN') sawBearer = true;
        const ap = u.slice(u.indexOf('/api/') + 4);
        if (ap === '/states') return ok([
          { entity_id: 'sensor.x', state: '1' },
          { entity_id: 'weather.forecast_home', state: 'partlycloudy' },
        ]);
        if (ap === '/states/weather.forecast_home') return ok({
          state: 'partlycloudy',
          attributes: { temperature: 64.2, temperature_unit: '°F' },
        });
        if (ap === '/states/sun.sun') return ok({
          attributes: { next_rising: '2026-06-11T05:42:00Z', next_setting: '2026-06-10T20:31:00Z' },
        });
        return nf();
      }
      return bgData(p) || nf();
    },
  });
  setTimeout(() => {
    const doc = window.document;
    try {
      assert.ok(sawBearer, 'sent Bearer token to HA');
      assert.strictEqual(doc.getElementById('wwTemp').textContent, '64°', 'HA temp as-is (HA units): ' + doc.getElementById('wwTemp').textContent);
      assert.strictEqual(doc.getElementById('wwCond').textContent, 'partly cloudy', 'HA condition prettified');
      assert.ok(doc.getElementById('wwSun').textContent.startsWith('sun '), 'sun.sun rendered');
      assert.ok(/\d/.test(doc.getElementById('wwTime').textContent), 'clock rendered');
      assert.strictEqual(doc.getElementById('wallWidgets').getAttribute('data-corner'), 'bottom-right', 'default corner');
      assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
      console.log('B: HA weather via token OK (auto-discovery, units, sun.sun)');
      if (++done === 2) { console.log('\nWALL V2 TESTS PASSED'); process.exit(0); }
    } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
  }, 1600);
}
