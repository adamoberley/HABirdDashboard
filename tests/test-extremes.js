// sit_confidence extremes: 1.01 = every bird flies (even 0.99 conf),
// 0 = every bird perches (even 0.55 conf).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function boot(sit) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const summary = [
    { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 50, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
    { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.55 },
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
  const card = window.document.createElement('habird-card');
  card.setConfig({ sit_confidence: sit });
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  return card;
}

const assert = require('assert');
const cardFly = boot(1.01);
const cardSit = boot(0);
setTimeout(() => {
  try {
    const rF = cardFly.shadowRoot;
    const annaF = rF.querySelector('.gtile[data-sci="Calypte anna"] img');
    const ravenF = rF.querySelector('.gtile[data-sci="Corvus corax"] img');
    assert.ok(annaF.src.includes('calypte-anna-2.png'), '1.01: anna (0.99) flies');
    assert.ok(ravenF.src.includes('corvus-corax-2.png'), '1.01: raven (0.55) flies');
    const rS = cardSit.shadowRoot;
    assert.ok(rS.querySelector('.gtile[data-sci="Calypte anna"] img').src.includes('calypte-anna.png'), '0: anna perches');
    assert.ok(rS.querySelector('.gtile[data-sci="Corvus corax"] img').src.includes('corvus-corax.png'), '0: raven (0.55) perches');
    console.log('EXTREMES TEST PASSED (1.01 all flying, 0 all perched)');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 1700);
