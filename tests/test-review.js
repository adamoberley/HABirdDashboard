// Review write-back v2: ghost-x flag arms to a labelled pill, second tap
// POSTs false_positive with a self-minted double-submit CSRF token (the
// header equals the cookie the card set). Cross-origin direct base must
// refuse with the needs-ingress reason.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

function boot({ ingress }) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://ha.local:8123/x', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const summary = [
    { scientific_name: 'Meleagris gallopavo', common_name: 'Wild Turkey', count: 4, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.66 },
  ];
  const daily = summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1), latest_heard: '13:55:00' }));
  const posts = [];
  const INGRESS = '/api/hassio_ingress/TOK';
  window.fetch = (url, opts) => {
    const u = String(url);
    const p = u.replace('http://ha.local:8080', '').replace(INGRESS, '');
    const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
    if (u.startsWith('https://en.wikipedia.org/')) return ok({ extract: 'A large bird.' });
    if (opts && opts.method === 'POST' && p.includes('/review')) {
      posts.push({ url: u, headers: opts.headers, body: JSON.parse(opts.body), cookie: window.document.cookie });
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
    callApi: ingress ? (m, p2) => {
      if (p2 === 'hassio/addons') return Promise.resolve({ data: { addons: [{ slug: 'db21ed7f_birdnet-go', name: 'Birdnet-go' }] } });
      if (p2 === 'hassio/addons/db21ed7f_birdnet-go/info') return Promise.resolve({ data: { ingress: true, ingress_url: INGRESS + '/' } });
      if (p2 === 'hassio/ingress/session') return Promise.resolve({ data: { session: 'S' } });
      return Promise.reject(404);
    } : undefined,
  };
  const card = window.document.createElement('habird-card');
  card.setConfig({});
  card.hass = hass;
  window.document.body.appendChild(card);
  return { window, card, posts };
}

const assert = require('assert');
let done = 0;

// --- A: with ingress, the write succeeds via self-minted CSRF ---
{
  const { window, card, posts } = boot({ ingress: true });
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
            assert.ok(posts[0].url.startsWith('/api/hassio_ingress/TOK/api/v2/detections/42/review'), 'via ingress: ' + posts[0].url);
            assert.strictEqual(posts[0].body.verified, 'false_positive');
            const tok = posts[0].headers['X-CSRF-Token'];
            assert.ok(tok && tok.length > 10, 'token minted');
            assert.ok(posts[0].cookie.includes('csrf=' + tok), 'header equals the cookie (double-submit)');
            assert.strictEqual(flag.getAttribute('data-state'), 'done');
            assert.strictEqual(flag.textContent, '✓');
            console.log('A: ingress write-back OK (self-minted double-submit token)');
            if (++done === 2) console.log('\nREVIEW V2 TESTS PASSED');
          } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
        }, 400);
      } catch (e) { console.error('A FAIL:', e.message); process.exit(1); }
    }, 900);
  }, 1700);
}

// --- B: no ingress (cross-origin direct base) -> graceful needs-ingress fail ---
{
  const { window, card, posts } = boot({ ingress: false });
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
            assert.ok(flag.title.includes('ingress'), 'tooltip explains: ' + flag.title);
            setTimeout(() => {
              try {
                assert.strictEqual(flag.getAttribute('data-state'), 'idle', 'failure auto-resets');
                console.log('B: cross-origin refusal + auto-reset OK');
                if (++done === 2) console.log('\nREVIEW V2 TESTS PASSED');
                setTimeout(() => process.exit(0), 100);
              } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
            }, 5400);
          } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
        }, 400);
      } catch (e) { console.error('B FAIL:', e.message); process.exit(1); }
    }, 900);
  }, 1700);
}
