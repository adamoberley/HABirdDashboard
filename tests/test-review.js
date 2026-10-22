// Review write-back v2: ghost-x flag arms to a labelled pill, second tap
// POSTs false_positive. With BirdNET-Go on the page's own origin (a
// same-origin reverse proxy) the header echoes the csrf cookie BirdNET-Go
// set - the card never mints one. A cross-origin direct base must refuse
// with the needs-proxy reason.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function boot({ sameOrigin, reviewStatus }) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const summary = [
    { scientific_name: 'Meleagris gallopavo', common_name: 'Wild Turkey', count: 4, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.66 },
  ];
  const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
  const posts = [];
  const SAME = '/birdnet';
  if (sameOrigin) window.document.cookie = 'csrf=FROMBIRDNETGO;path=/';
  window.fetch = (url, opts) => {
    const u = String(url);
    const p = u.replace('http://ha.local:8080', '').replace(SAME, '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (u.startsWith('https://en.wikipedia.org/')) return ok({ extract: 'A large bird.' });
    if (opts && opts.method === 'POST' && p.includes('/review')) {
      posts.push({ url: u, headers: opts.headers, body: JSON.parse(opts.body), cookie: window.document.cookie });
      if (reviewStatus === 403) return Promise.resolve({ ok: false, status: 403, json: () => Promise.reject(403) });
      return ok({ success: true });
    }
    if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
    if (p.startsWith('/api/v2/analytics/species/daily')) return ok(daily);
    if (p.includes('/analytics/')) return ok({ data: [] });
    if (p.includes('/detections?queryType=search')) return ok({ data: [
      { id: 42, date: '2026-06-10', time: '08:20:00', scientificName: 'Meleagris gallopavo', commonName: 'Wild Turkey', confidence: 0.66 },
    ] });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  };
  window.Audio = class { constructor(){ this.crossOrigin=null; } addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 600; } });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe(){} disconnect(){} };
  window.eval(CARD);
  const hass = {
    themes: {}, states: {},
  };
  const card = window.document.createElement('habird-card');
  card.setConfig(sameOrigin ? { birdnet_url: SAME } : {});
  card.hass = hass;
  window.document.body.appendChild(card);
  return { window, card, posts };
}

const assert = require('assert');
let done = 0;

// --- A: same-origin BirdNET-Go, the write echoes BirdNET-Go's own CSRF cookie ---
{
  const { window, card, posts } = boot({ sameOrigin: true });
  setTimeout(() => {
    const root = card.shadowRoot;
    root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const flag = root.querySelector('#modalRecordings .rec-row .flag');
        assert.ok(flag, 'flag rendered');
        assert.strictEqual(flag.getAttribute('data-state'), 'idle');
        assert.strictEqual(flag.textContent, '✕', 'idle is a ghost x');
        flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        assert.strictEqual(flag.getAttribute('data-state'), 'armed');
        assert.strictEqual(flag.textContent, 'not it?', 'armed pill label');
        flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        setTimeout(() => {
          try {
            assert.strictEqual(posts.length, 1, 'one POST');
            assert.ok(posts[0].url.startsWith('/birdnet/api/v2/detections/42/review'), 'same-origin base: ' + posts[0].url);
            assert.strictEqual(posts[0].body.verified, 'false_positive');
            // Sent alongside the legacy field: BirdNET-Go's public API docs
            // don't pin down the review body's field name, and the Apr 2026
            // release renamed the search response's verdict field
            // 'verified' -> 'correct' - unknown fields are ignored
            // server-side, so sending both reads correctly either way.
            assert.strictEqual(posts[0].body.correct, 'false_positive');
            assert.strictEqual(posts[0].headers['X-CSRF-Token'], 'FROMBIRDNETGO', "header echoes BirdNET-Go's cookie");
            assert.strictEqual(posts[0].cookie, 'csrf=FROMBIRDNETGO', 'card set no cookies of its own');
            assert.strictEqual(flag.getAttribute('data-state'), 'done');
            assert.strictEqual(flag.textContent, '✓');
            console.log('A: same-origin write-back OK (BirdNET-Go\'s own CSRF cookie)');
            if (++done === 3) console.log('\nREVIEW V2 TESTS PASSED');
          } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
        }, 400);
      } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
    }, 900);
  }, 1700);
}

// --- B: cross-origin direct base -> graceful needs-proxy fail ---
{
  const { window, card, posts } = boot({ sameOrigin: false });
  setTimeout(() => {
    const root = card.shadowRoot;
    root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const flag = root.querySelector('#modalRecordings .rec-row .flag');
        flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        setTimeout(() => {
          try {
            assert.strictEqual(posts.length, 0, 'no POST attempted cross-origin');
            assert.strictEqual(flag.getAttribute('data-state'), 'failed');
            assert.ok(flag.title.includes('Bird Card Proxy'), 'tooltip explains: ' + flag.title);
            setTimeout(() => {
              try {
                assert.strictEqual(flag.getAttribute('data-state'), 'idle', 'failure auto-resets');
                console.log('B: cross-origin refusal + auto-reset OK');
                if (++done === 3) {
                  console.log('\nREVIEW V2 TESTS PASSED');
                  setTimeout(() => process.exit(0), 100);
                }
              } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
            }, 5400);
          } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
        }, 400);
      } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
    }, 900);
  }, 1700);
}

// --- C: BirdNET-Go's Aug 2026 CSRF enforcement rejects the write (403) ---
// -> the flag pill fails with a distinct "blocked" message, not the
// generic error-code pill.
{
  const { window, card, posts } = boot({ sameOrigin: true, reviewStatus: 403 });
  setTimeout(() => {
    const root = card.shadowRoot;
    root.querySelector('.bird-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    setTimeout(() => {
      try {
        const flag = root.querySelector('#modalRecordings .rec-row .flag');
        flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        flag.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
        setTimeout(() => {
          try {
            assert.strictEqual(posts.length, 1, 'one POST attempted');
            assert.strictEqual(flag.getAttribute('data-state'), 'failed');
            assert.strictEqual(flag.textContent, 'blocked', 'distinct 403 label, not a generic error code');
            assert.ok(flag.title.includes('CSRF'), 'tooltip names the cause: ' + flag.title);
            console.log('C: 403 CSRF rejection -> distinct "blocked" message OK');
            if (++done === 3) {
              console.log('\nREVIEW V2 TESTS PASSED');
              setTimeout(() => process.exit(0), 100);
            }
          } catch (e) { console.error('C FAIL:', e.message); process.exit(1); }
        }, 400);
      } catch (e) { console.error('C FAIL:', e.message); process.exit(1); }
    }, 900);
  }, 1700);
}
