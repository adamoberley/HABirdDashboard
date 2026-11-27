// Latest-bird view (#94): off by default (no fourth view, three switcher
// tabs); when enabled it shows only the newest detection - perched art,
// names, "5m ago", that detection's confidence - moves on to a newer bird
// after a push refresh, opens the details modal in place on tap, and has
// an empty state when nothing was heard. Also checks the static page's
// ?view=latest URL switch.
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const WWW = ROOT + '/homeassistant/www';
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

// Local "YYYY-MM-DD HH:MM:SS", minutes before now (BirdNET-Go's format).
function stamp(minsAgo) {
  const d = new Date(Date.now() - minsAgo * 60000);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// Mutable fake station: the window is 'all', so the card reads the
// all-time species summary (last_heard = newest detection per species).
function station() {
  const st = {
    summary: [
      { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9,
        first_heard: stamp(600), last_heard: stamp(120), max_confidence: 0.71 },
      { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500,
        first_heard: stamp(900), last_heard: stamp(5), max_confidence: 0.99 },
    ],
    detections: {},   // sci -> [{date, time, confidence}]
  };
  const annaLast = st.summary[1].last_heard;
  st.detections['Calypte anna'] = [
    { id: 7, scientificName: 'Calypte anna', date: annaLast.slice(0, 10), time: annaLast.slice(11), confidence: 0.934 },
  ];
  st.fetch = (url) => {
    const u = String(url);
    const p = u.replace(/^https?:\/\/[^/]+(:\d+)?/, '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (u.startsWith('https://en.wikipedia.org/')) return ok({ extract: 'A bird.' });
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(st.summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok([]);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections?queryType=search')) {
      const sci = decodeURIComponent((/search=([^&]+)/.exec(p) || [])[1] || '');
      return ok({ data: st.detections[sci] || [], total: 0 });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  return st;
}

function makeWindow(url, html) {
  const dom = new JSDOM(html || '<!doctype html><html><body></body></html>',
    { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push((e.error && e.error.stack) || e.message));
  window.Audio = class { addEventListener(){} load(){} play(){ return Promise.resolve(); } pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  return window;
}

function mountCard(config, st) {
  const window = makeWindow('http://ha.local:8123/x');
  window.fetch = st.fetch;
  window.eval(CARD);
  const card = window.document.createElement('habird-card');
  card.setConfig(Object.assign({ birdnet_url: 'http://ha.local:8080', live: false }, config));
  card.hass = { themes: {}, states: {} };
  window.document.body.appendChild(card);
  return { window, card, root: card.shadowRoot };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Default card: no latest view, three tabs, setConfig accepts/rejects.
  {
    const { window, root } = mountCard({ window: 'all' }, station());
    await wait(1200);
    assert.strictEqual(root.getElementById('v3'), null, 'latest view absent by default');
    assert.strictEqual(root.getElementById('latestBird'), null, 'latest container absent by default');
    assert.strictEqual(root.querySelectorAll('#slider button').length, 3, 'switcher keeps three tabs');
    const probe = window.document.createElement('habird-card');
    assert.throws(() => probe.setConfig({ view: 'nope' }), /latest/, 'error names latest as a valid view');
    assert.throws(() => probe.setConfig({ latest_view: 'yes' }), /latest_view/, 'latest_view must be boolean');
    assert.deepStrictEqual(window.__errors, [], 'errors: ' + window.__errors.join('; '));
  }

  // 2. Enabled + opens on it: newest bird, then a newer one, then the modal.
  {
    const st = station();
    const { window, card, root } = mountCard({ window: 'all', latest_view: true, view: 'latest' }, st);
    await wait(1500);
    const tabs = root.querySelectorAll('#slider button');
    assert.strictEqual(tabs.length, 4, 'fourth tab added');
    assert.strictEqual(tabs[3].textContent, 'latest', 'tab label');
    assert.strictEqual(tabs[3].getAttribute('aria-current'), 'true', 'starts on the latest view');
    const el = root.getElementById('latestBird');
    const bird = el.querySelector('.latest-bird');
    assert.ok(bird, 'bird rendered');
    assert.strictEqual(bird.getAttribute('data-sci'), 'Calypte anna', 'newest detection shown, not the most-heard order');
    assert.strictEqual(el.querySelector('.latest-com').textContent, "Anna's Hummingbird");
    assert.strictEqual(el.querySelector('.latest-sci').textContent, 'Calypte anna');
    assert.strictEqual(el.querySelector('.latest-ago').textContent, '5m ago', 'relative time');
    assert.ok(/\d\d:\d\d$/.test(el.querySelector('.latest-clock').textContent), 'clock time shown');
    assert.strictEqual(el.querySelector('.latest-conf').textContent, '93% confidence', "that detection's confidence");
    const src = el.querySelector('.latest-img img').getAttribute('src');
    assert.ok(/illustrations\/calypte-anna\.png\?v=/.test(src), 'perched art: ' + src);
    assert.strictEqual(root.querySelectorAll('.latest-bird').length, 1, 'exactly one bird');

    // A newer detection of another species arrives (MQTT/SSE push refresh).
    st.summary[0].last_heard = stamp(0.2);
    card._refresh();
    await wait(800);
    assert.strictEqual(el.querySelector('.latest-bird').getAttribute('data-sci'), 'Corvus corax', 'moved on to the newer bird');
    assert.strictEqual(el.querySelector('.latest-com').textContent, 'Common Raven');
    assert.ok(/s ago$/.test(el.querySelector('.latest-ago').textContent), 'seconds ago: ' + el.querySelector('.latest-ago').textContent);
    assert.strictEqual(el.querySelector('.latest-conf'), null, 'no confidence shown when that detection is unknown');

    // Tap -> details modal in place, still on the latest view.
    el.querySelector('.latest-bird').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    await wait(700);
    assert.strictEqual(root.getElementById('detail-modal').getAttribute('aria-hidden'), 'false', 'modal opened');
    assert.strictEqual(root.getElementById('modalSci').textContent, 'Corvus corax', 'modal shows the bird');
    assert.strictEqual(tabs[3].getAttribute('aria-current'), 'true', 'still on the latest view');
    assert.deepStrictEqual(window.__errors, [], 'errors: ' + window.__errors.join('; '));
  }

  // 3. Names setting: scientific-only puts the Latin name in the heading.
  {
    const { root } = mountCard({ window: 'all', latest_view: true, names: 'scientific' }, station());
    await wait(1200);
    assert.strictEqual(root.querySelectorAll('#slider button')[0].getAttribute('aria-current'), 'true', 'latest_view alone keeps the collage first');
    assert.strictEqual(root.querySelector('.latest-com').textContent, 'Calypte anna');
    assert.strictEqual(root.querySelector('.latest-sci'), null, 'no duplicate scientific line');
  }

  // 4. Empty window: nothing heard -> empty state, no bird.
  {
    const st = station();
    st.summary = [];
    const { window, root } = mountCard({ window: 'all', view: 'latest' }, st);
    await wait(1200);
    assert.strictEqual(root.querySelectorAll('#slider button').length, 4, "view: 'latest' turns the view on");
    assert.strictEqual(root.querySelector('.latest-bird'), null, 'no bird');
    const empty = root.querySelector('.latest-empty');
    assert.ok(empty, 'empty state shown');
    assert.ok(/next bird heard/.test(empty.textContent), 'empty hint: ' + empty.textContent);
    assert.deepStrictEqual(window.__errors, [], 'errors: ' + window.__errors.join('; '));
  }

  // 5. Static page: ?view=latest adds and opens the view.
  {
    const html = fs.readFileSync(WWW + '/index.html', 'utf8');
    const window = makeWindow('http://ha.local:8123/local/habird/index.html?view=latest', html);
    const st = station();
    window.fetch = st.fetch;
    window.localStorage.setItem('bird:window', '1000000');
    window.eval(fs.readFileSync(WWW + '/config.js', 'utf8'));
    window.AV_CONFIG.birdnetGoUrl = 'http://ha.local:8080';
    window.AV_CONFIG.live = false;
    window.eval(fs.readFileSync(WWW + '/masks.js', 'utf8'));
    window.eval(fs.readFileSync(WWW + '/i18n/en.js', 'utf8'));
    window.eval(fs.readFileSync(WWW + '/apt.js', 'utf8'));
    await wait(1500);
    const doc = window.document;
    const tabs = doc.querySelectorAll('#slider button');
    assert.strictEqual(tabs.length, 4, 'page: fourth tab');
    assert.strictEqual(tabs[3].getAttribute('aria-current'), 'true', 'page: opens on latest');
    assert.ok(doc.body.classList.contains('av-view-latest'), 'page: shared title hidden on this view');
    assert.strictEqual(doc.querySelector('.latest-bird').getAttribute('data-sci'), 'Calypte anna', 'page: newest bird');
    assert.ok(doc.querySelector('.latest-img img').getAttribute('src').startsWith('./assets/illustrations/calypte-anna.png'), 'page: static art path');
    assert.deepStrictEqual(window.__errors, [], 'errors: ' + window.__errors.join('; '));
  }

  console.log('LATEST-BIRD VIEW TEST PASSED');
  process.exit(0);
}

main().catch((e) => { console.error('FAIL:', e && e.stack || e); process.exit(1); });
