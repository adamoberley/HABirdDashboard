// Mount the built <habird-card> in jsdom with a stub hass object and a
// stubbed BirdNET-Go API. Assert: app boots in the shadow root, collage
// tiles render with CDN image URLs, poses follow confidence, clock +
// hass-sourced weather render, theme follows hass dark mode, and the
// editor emits config-changed.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));

const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
];
const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
window.fetch = (url) => {
  const p = String(url).replace('http://ha.local:8080', '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
  if (p.includes('/analytics/')) return ok({ data: [] });
  if (p.includes('/detections')) return ok({ data: [] });
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
};
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };

window.eval(CARD);

const hass = {
  themes: { darkMode: true },
  states: {
    'weather.forecast_home': { state: 'partlycloudy', attributes: { temperature: 64.2, temperature_unit: '°F' } },
    'sun.sun': { attributes: { next_rising: '2026-06-11T05:42:00Z', next_setting: '2026-06-10T20:31:00Z' } },
  },
};

const card = window.document.createElement('habird-card');
card.setConfig({ clock: true, weather: true, corner: 'top-left', sit_confidence: 0.96 });
card.hass = hass;
window.document.body.appendChild(card);

setTimeout(() => {
  const assert = require('assert');
  try {
    const root = card.shadowRoot;
    assert.ok(root, 'shadow root attached');
    // The inlined CSS must survive template processing as a real <style>
    // in the shadow root (regression: a comment containing "<script>" prose
    // once mangled the template into an unterminated <!-- that swallowed it).
    const styleEl = root.querySelector('style');
    assert.ok(styleEl && styleEl.textContent.length > 1000,
      'shadow <style> present with CSS (len ' + (styleEl ? styleEl.textContent.length : 'none') + ')');
    // Collage rendered with CDN-based artwork and confidence poses.
    const tiles = [...root.querySelectorAll('.gtile img')];
    assert.strictEqual(tiles.length, 2, 'tiles: ' + tiles.length);
    const srcs = tiles.map(t => t.getAttribute('src'));
    assert.ok(srcs.some(s => s.startsWith('https://cdn.jsdelivr.net/gh/adamoberley/HABirdDashboard@HABirdDashboard/avian/assets/illustrations/calypte-anna.png')), 'CDN perched: ' + srcs);
    assert.ok(srcs.some(s => s.includes('illustrations/corvus-corax-2.png')), 'flight pose: ' + srcs);
    // Atlas + stats live too.
    assert.ok(root.querySelectorAll('.bird-card').length === 2, 'atlas cards');
    assert.ok(root.getElementById('statsTopSpec').textContent.includes('Hummingbird'), 'stats render');
    // Clock + hass weather (no fetch to HA - read from the hass object).
    assert.ok(/\d/.test(root.getElementById('wwTime').textContent), 'clock');
    assert.strictEqual(root.getElementById('wwTemp').textContent, '64°', 'hass temp: ' + root.getElementById('wwTemp').textContent);
    assert.strictEqual(root.getElementById('wwCond').textContent, 'partly cloudy', 'hass condition');
    assert.strictEqual(root.getElementById('wallWidgets').getAttribute('data-corner'), 'top-left', 'corner config');
    // Theme followed hass dark mode.
    assert.strictEqual(card.getAttribute('data-theme'), 'dark', 'dark theme from hass');
    // Card URL untouched by the internal router.
    assert.strictEqual(window.location.hash, '', 'browser hash untouched');
    // Editor round-trip.
    const ed = window.document.createElement('habird-card-editor');
    let emitted = null;
    ed.addEventListener('config-changed', (ev) => { emitted = ev.detail.config; });
    ed.setConfig({ clock: true });
    const form = ed.querySelector('ha-form');
    assert.ok(form, 'editor created ha-form');
    form.dispatchEvent(new window.CustomEvent('value-changed', { detail: { value: { weather: true } } }));
    assert.strictEqual(JSON.stringify(emitted), '{"clock":true,"weather":true}', 'editor emits merged config: ' + JSON.stringify(emitted));
    // customCards registration for the card picker.
    assert.ok(window.customCards.some(c => c.type === 'habird-card'), 'customCards registered');
    assert.deepStrictEqual(errors, [], 'errors: ' + errors.join('; '));
    
    // --- Look-and-feel defaults + overrides ---
    // Default config: no title block, window picker hidden, system font, transparent bg.
    const card2 = window.document.createElement('habird-card');
    card2.setConfig({});
    card2.hass = hass;
    window.document.body.appendChild(card2);
    const r2 = card2.shadowRoot;
    const shell2 = r2.querySelector('.av-shell');
    assert.ok(shell2.classList.contains('av-font-system'), 'system font default');
    assert.ok(!shell2.classList.contains('av-bg-paper'), 'transparent bg default');
    assert.strictEqual(r2.querySelector('.static-head').style.display, 'none', 'title hidden by default');
    assert.strictEqual(r2.getElementById('winPick').style.display, 'none', 'window picker hidden');
    // Overrides: custom title, serif font, paper bg, 7-day window.
    const card3 = window.document.createElement('habird-card');
    card3.setConfig({ title: 'Garden Birds', font: 'serif', background: 'paper', window: '168' });
    card3.hass = hass;
    window.document.body.appendChild(card3);
    const r3 = card3.shadowRoot;
    const shell3 = r3.querySelector('.av-shell');
    assert.ok(!shell3.classList.contains('av-font-system'), 'serif keeps editorial font');
    assert.ok(shell3.classList.contains('av-bg-paper'), 'paper bg class');
    assert.strictEqual(r3.getElementById('staticTitle').textContent, 'Garden Birds', 'custom title');
    assert.strictEqual(r3.querySelector('.static-head .pre').style.display, 'none', 'eyebrow hidden with custom title');
    setTimeout(() => {
      try {
        const t3 = r3.querySelector('.gtile');
        assert.ok(t3 && t3.title.includes('this week'), '7d window from config: ' + (t3 && t3.title));
        console.log('LOOK CONFIG TEST PASSED');
        process.exit(0);
      } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
    }, 1500);
    console.log('CARD TEST PASSED: boots in shadow DOM, CDN art, poses, hass weather, theme, editor');
  } catch (e) { console.error('FAIL:', e.message); errors.length && console.error(errors.join('\n')); process.exit(1); }
}, 1700);
