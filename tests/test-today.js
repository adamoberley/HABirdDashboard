// "Today" time window (#85): window: today shows the calendar day so far,
// reset at local midnight - not the rolling 24 hours, which keeps showing
// yesterday evening's birds all morning. And the rolling window's label no
// longer claims to be "today".
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const now = new Date();
const TODAY = dateStr(now);
const YESTERDAY = dateStr(new Date(now.getTime() - 86400000));
const late = Array(24).fill(0); late[23] = 4;          // heard 23:00-24:00 yesterday
const allDay = Array(24).fill(1);
const daily = {
  [YESTERDAY]: [{ scientific_name: 'Strix aluco', common_name: 'Tawny Owl', count: 4,
    hourly_counts: late, latest_heard: '23:40:00', max_confidence: 0.95 }],
  [TODAY]: [{ scientific_name: 'Erithacus rubecula', common_name: 'European Robin', count: 24,
    hourly_counts: allDay, latest_heard: '00:10:00', max_confidence: 0.97 }],
};
const summary = [
  { scientific_name: 'Strix aluco', common_name: 'Tawny Owl', count: 4, first_heard: '2026-01-02 08:00:00', last_heard: YESTERDAY + ' 23:40:00', max_confidence: 0.95 },
  { scientific_name: 'Erithacus rubecula', common_name: 'European Robin', count: 24, first_heard: '2026-01-02 08:00:00', last_heard: TODAY + ' 00:10:00', max_confidence: 0.97 },
];

function mount(config) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://ha.local:8123/lovelace/birds', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  const fetched = [];
  window.fetch = (url) => {
    const p = String(url).replace('http://ha.local:8080', '');
    fetched.push(p);
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    const m = /\/analytics\/species\/daily\?date=([\d-]+)/.exec(p);
    if (m) return ok(daily[m[1]] || []);
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
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
  card.setConfig(Object.assign({ birdnet_url: 'http://ha.local:8080', live: false }, config));
  window.document.body.appendChild(card);
  return { window, card, fetched };
}

function birds(card) {
  return [...card.shadowRoot.querySelectorAll('.gtile img')].map(i => i.getAttribute('src'));
}

const rolling = mount({ window: '24' });
const today = mount({ window: 'today' });

setTimeout(() => {
  try {
    // Rolling 24h: yesterday's late owl is still in the window.
    const r = birds(rolling.card);
    assert.ok(r.some(s => s.includes('strix-aluco')), 'rolling 24h keeps yesterday evening: ' + r);
    assert.ok(r.some(s => s.includes('erithacus-rubecula')), 'rolling 24h has today: ' + r);

    // Today: only birds since local midnight - and yesterday is never fetched.
    const t = birds(today.card);
    assert.ok(t.some(s => s.includes('erithacus-rubecula')), 'today has the robin: ' + t);
    assert.ok(!t.some(s => s.includes('strix-aluco')), "today drops yesterday's owl: " + t);
    assert.ok(!today.fetched.some(p => p.includes('daily?date=' + YESTERDAY)),
      'today window never asks for yesterday');

    // Labels: "today" for the calendar day, "past 24h" for the rolling window.
    const lbl = (card) => [...card.shadowRoot.querySelectorAll('.bird-card .lbl-inline')].map(e => e.textContent);
    assert.ok(lbl(today.card).includes('today'), 'today label: ' + lbl(today.card));
    assert.ok(lbl(rolling.card).includes('past 24h'), 'rolling label: ' + lbl(rolling.card));
    assert.ok(!lbl(rolling.card).includes('today'), 'rolling window no longer says today');

    // Config validation accepts it; the editor offers it.
    assert.doesNotThrow(() => today.card.setConfig({ window: 'today' }));
    assert.throws(() => today.card.setConfig({ window: 'tomorrow' }), /today/);

    console.log('TODAY WINDOW TEST PASSED');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
}, 2500);
