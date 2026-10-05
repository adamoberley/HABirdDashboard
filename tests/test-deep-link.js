// Deep links (#87): a dashboard URL ending in #sci=<scientific name> opens
// that species' detail modal - on load, and on HA's in-app navigation (a
// notification tapped while the dashboard is open). Only one card acts on a
// link, deep_link: false opts a card out, the URL is never written, and a
// config reboot doesn't reopen a bird the user already closed.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const CARD = fs.readFileSync(ROOT + '/dist/habird-card.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://ha.local:8123/lovelace/birds#sci=Corvus%20corax',
  runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
const summary = [
  { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500, first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
  { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9, first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
];
window.fetch = (url) => {
  const p = String(url).replace('http://ha.local:8080', '');
  const ok = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(b))) });
  if (p.startsWith('/api/v2/analytics/species/summary')) return ok(summary);
  if (p.startsWith('/api/v2/analytics/species/daily')) return ok(summary.map(s => ({ ...s, hourly_counts: Array(24).fill(1) })));
  if (p.includes('/analytics/')) return ok({ data: [] });
  if (p.includes('/detections')) return ok({ data: [] });
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
};
window.Audio = class { addEventListener(){} load(){} play(){return Promise.resolve();} pause(){} };
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => null;
window.ResizeObserver = class { observe(){} disconnect(){} };
window.HTMLElement.prototype.scrollIntoView = function () {};
window.eval(CARD);

function card(config) {
  const c = window.document.createElement('habird-card');
  c.setConfig(Object.assign({ birdnet_url: 'http://ha.local:8080', live: false }, config));
  window.document.body.appendChild(c);
  return c;
}
const open = (c) => c.shadowRoot.getElementById('detail-modal').getAttribute('aria-hidden') === 'false';
const shown = (c) => c.shadowRoot.getElementById('modalSci').textContent;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function navigate(url) {
  // What HA's navigate() does: pushState + a location-changed event.
  window.history.pushState(null, '', url);
  window.dispatchEvent(new window.Event('location-changed'));
}

const first = card({ view: 'atlas' });
const second = card({ view: 'collage' });
const optedOut = card({ deep_link: false });

(async () => {
  try {
    await wait(600);
    assert.ok(open(first), 'the link opens the modal on load');
    assert.strictEqual(shown(first), 'Corvus corax');
    assert.ok(!open(second), 'only one card acts on a link');
    assert.ok(!open(optedOut), 'deep_link: false ignores it');
    assert.strictEqual(window.location.hash, '#sci=Corvus%20corax', 'URL untouched');

    // Close it, then reboot the card the way the dashboard editor does:
    // the stale hash is still in the address bar but must not reopen.
    first.shadowRoot.querySelector('#detail-modal [data-close="1"]').click();
    await wait(1200);
    assert.ok(!open(first), 'closes');
    first.setConfig({ birdnet_url: 'http://ha.local:8080', live: false, view: 'atlas', title: 'x' });
    await wait(400);
    assert.ok(!open(first), 'a reboot does not reopen a link already handled');

    // A notification tapped with the dashboard already open: HA pushState's
    // the new URL. '+' for spaces (Jinja's urlencode of a form) works too.
    navigate('/lovelace/birds#sci=Calypte+anna');
    await wait(300);
    assert.ok(open(first), 'in-app navigation opens the new bird');
    assert.strictEqual(shown(first), 'Calypte anna');
    assert.ok(!open(second) && !open(optedOut), 'still only one card');

    // Unrelated navigation (same hash) does nothing; garbage is ignored.
    first.shadowRoot.querySelector('#detail-modal [data-close="1"]').click();
    await wait(1200);
    window.dispatchEvent(new window.Event('location-changed'));
    navigate('/lovelace/birds#sci=%E0%A4%A');
    await wait(300);
    assert.ok(!open(first), 'no reopen on unrelated or malformed navigation');

    // Removed cards stop listening.
    first.remove();
    navigate('/lovelace/birds#sci=Corvus%20corax');
    await wait(300);
    assert.ok(open(second), 'with the first card gone, the next one claims the link');

    // The modal's link button copies exactly the URL that opens this bird.
    let copied = null;
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: (t) => { copied = t; return Promise.resolve(); } }, configurable: true });
    second.shadowRoot.getElementById('modalLink').click();
    await wait(50);
    assert.strictEqual(copied, 'http://ha.local:8123/lovelace/birds#sci=Corvus%20corax', 'copied: ' + copied);
    assert.strictEqual(second.shadowRoot.getElementById('modalLink').getAttribute('data-copied'), 'true');

    console.log('DEEP LINK TEST PASSED');
    process.exit(0);
  } catch (e) { console.error('FAIL:', e.message); process.exit(1); }
})();
