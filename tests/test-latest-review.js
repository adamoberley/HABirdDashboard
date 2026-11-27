// Latest-bird view (#94), review regressions: a stale refresh can't bring
// back an older bird; the confidence belongs to the exact detection on
// show and a failed lookup is retried; a bird outside the window (but in
// the collage's fuzzy hour bucket) isn't shown; a deep link on a card
// locked to the latest view opens the modal in place; the confidence
// lookup only runs while the view is on screen, leaves the shared
// data-source flag alone, and its timer stops on removal/reconfigure.
// Each scenario runs on its own; every failure is reported.
'use strict';
const fs = require('fs');
const assert = require('assert');
const { fmt, stamp, station, makeWindow, mountCard, wait, WWW } = require('./test-latest.js');

const tabs = (root) => root.querySelectorAll('#slider button');
const shownSci = (root) => {
  const b = root.querySelector('.latest-bird');
  return b ? b.getAttribute('data-sci') : null;
};
const confText = (root) => {
  const c = root.querySelector('.latest-conf');
  return c ? c.textContent : null;
};
const noErrors = (window) => assert.deepStrictEqual(window.__errors, [], 'errors: ' + window.__errors.join('; '));

const scenarios = {
  // 1a. A slow summary response from an older refresh lands after a newer
  // refresh already showed a newer bird: the older one must not win.
  async staleRefresh() {
    const st = station();
    const { window, card, root } = mountCard({ window: 'all', view: 'latest' }, st);
    await wait(1200);
    assert.strictEqual(shownSci(root), 'Calypte anna', 'starts on the hummingbird');
    st.hold = [];
    card._refresh();                       // A: parked
    await wait(100);
    assert.ok(st.hold.length > 0, 'refresh A is waiting on the summary');
    const parked = st.hold;
    st.hold = null;
    st.summary[0].last_heard = stamp(0.2); // the raven calls
    card._refresh();                       // B: answers at once
    await wait(600);
    assert.strictEqual(shownSci(root), 'Corvus corax', 'refresh B shows the raven');
    parked.forEach((release) => release()); // A lands late, with the old data
    await wait(600);
    assert.strictEqual(shownSci(root), 'Corvus corax', 'the stale refresh did not bring the hummingbird back');
    noErrors(window);
  },

  // 1b. A window change whose fetch fails must not keep showing the
  // previous window's bird (static page, window picker).
  async failedWindowChange() {
    const html = fs.readFileSync(WWW + '/index.html', 'utf8');
    const window = makeWindow('http://ha.local:8123/local/habird/index.html?view=latest', html);
    const st = station();
    st.summary[1].last_heard = stamp(120);   // newest bird: two hours ago
    st.summary[0].last_heard = stamp(300);
    // The daily summary (what the past-hour window reads) is down from
    // the start, so it can't be served from a memo of an earlier answer.
    st.dailyFail = true;
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
    assert.strictEqual(shownSci(doc), 'Calypte anna', 'all-time window: the hummingbird');
    doc.querySelector('#winPick button[data-h="1"]').click();   // Past hour, fetch fails
    await wait(800);
    assert.strictEqual(shownSci(doc), null, "a failed switch to the past hour doesn't keep the all-time bird");
    noErrors(window);
  },

  // 2a. Confidence comes from the detection on show (to the second), not
  // the newest call in the same minute.
  async confidenceExactDetection() {
    const st = station();
    const base = new Date(Date.now() - 5 * 60000);
    base.setSeconds(5, 0);
    const later = new Date(base.getTime() + 40000);
    st.summary[1].last_heard = fmt(base);
    st.detections['Calypte anna'] = [
      { id: 8, scientificName: 'Calypte anna', date: fmt(later).slice(0, 10), time: fmt(later).slice(11), confidence: 0.75 },
      { id: 7, scientificName: 'Calypte anna', date: fmt(base).slice(0, 10), time: fmt(base).slice(11), confidence: 0.934 },
    ];
    const { window, root } = mountCard({ window: 'all', view: 'latest' }, st);
    await wait(1200);
    assert.strictEqual(shownSci(root), 'Calypte anna');
    assert.strictEqual(confText(root), '93% confidence', 'confidence of the 12:34:05-style call, not the later one');
    noErrors(window);
  },

  // 2b. A lookup that failed (503) is retried on the next refresh.
  async confidenceRetry() {
    const st = station();
    st.speciesFail['Calypte anna'] = 1;
    const { window, card, root } = mountCard({ window: 'all', view: 'latest' }, st);
    await wait(1200);
    assert.strictEqual(confText(root), null, 'first lookup failed: no confidence');
    card._refresh();
    await wait(800);
    assert.strictEqual(confText(root), '93% confidence', 'a later healthy refresh retries the lookup');
    noErrors(window);
  },

  // 3. Past hour: a call from before the cutoff that shares an hour bucket
  // with it stays in the collage (fuzzy edge, unchanged) but is not the
  // latest bird.
  async windowCutoff() {
    const st = station();
    const ws = Date.now() - 3600000;
    const hourStart = new Date(ws); hourStart.setMinutes(0, 0, 0);
    const t = Math.max(hourStart.getTime(), ws - 10 * 60000);   // same bucket, before the cutoff
    st.events = [{ sci: 'Corvus corax', com: 'Common Raven', t, conf: 0.71 }];
    const { window, root } = mountCard({ window: 1, view: 'latest' }, st);
    await wait(1200);
    assert.ok(root.querySelector('.gtile[data-sci="Corvus corax"]'), "collage's hour-bucket edge still includes it");
    assert.strictEqual(shownSci(root), null, 'a call from ' + fmt(new Date(t)) + ' is outside the past hour');
    assert.ok(root.querySelector('.latest-empty'), 'empty state instead');
    noErrors(window);
  },

  // 1c. Default collage (latest view off): All is parked, the user goes to
  // the past hour and back to All, and the fresh All fetch fails. The
  // parked All answer is the right data for the window on show and must
  // land - a newer fetch for ANOTHER window doesn't make it stale.
  async windowReturnKeepsOlderAll() {
    const st = station();
    const base = st.fetch;
    st.summaryFail = false;
    st.fetch = (url) => (st.summaryFail && /\/species\/summary/.test(String(url)))
      ? Promise.resolve({ ok: false, status: 503, json: () => Promise.reject(503) })
      : base(url);
    const { window, card, root } = mountCard({ window: 'all' }, st);
    await wait(1200);
    const tiles = () => [...root.querySelectorAll('.gtile')].map((t) => t.dataset.sci).sort();
    assert.deepStrictEqual(tiles(), ['Calypte anna', 'Corvus corax'], 'all-time flock');
    st.hold = [];
    card._refresh();                       // All, parked
    await wait(100);
    const parked = st.hold;
    st.hold = null;
    root.querySelector('#winPick button[data-h="1"]').click();         // past hour: empty
    await wait(600);
    assert.deepStrictEqual(tiles(), [], 'past hour is empty');
    st.summaryFail = true;
    // Past the 10 s request memo, so going back to All really asks again
    // (and fails) instead of sharing the parked request.
    const realNow = window.Date.now;
    window.Date.now = () => realNow() + 11000;
    root.querySelector('#winPick button[data-h="1000000"]').click();   // back to All, fails
    await wait(600);
    parked.forEach((release) => release());
    await wait(600);
    assert.deepStrictEqual(tiles(), ['Calypte anna', 'Corvus corax'], 'the parked All answer lands');
    noErrors(window);
  },

  // 3b. Past hour without timestamps (daily rows missing latest_heard):
  // an undated row can't be checked against the cutoff, so it isn't named.
  async undatedPastHour() {
    const st = station();
    const ws = Date.now() - 3600000;
    const hourStart = new Date(ws); hourStart.setMinutes(0, 0, 0);
    const t = Math.max(hourStart.getTime(), ws - 10 * 60000);
    st.events = [{ sci: 'Corvus corax', com: 'Common Raven', t, conf: 0.71 }];
    const base = st.fetch;
    st.fetch = (url) => /\/species\/daily/.test(String(url))
      ? base(url).then((r) => ({ ok: true, status: 200,
          json: () => r.json().then((rows) => rows.map((x) => Object.assign({}, x, { latest_heard: '' }))) }))
      : base(url);
    const { window, root } = mountCard({ window: 1, view: 'latest' }, st);
    await wait(1200);
    assert.strictEqual(shownSci(root), null, 'no undated bird named in the past hour');
    noErrors(window);
  },

  // 4. A card locked to the latest view: a #sci= link opens the details
  // in place and the view stays (the switcher is hidden - no way back).
  async lockedDeepLink() {
    const { window, card, root } = mountCard({ window: 'all', view: 'latest', view_selector: false }, station(),
      { url: 'http://ha.local:8123/lovelace/birds#sci=Corvus%20corax' });
    await wait(1200);
    assert.strictEqual(root.getElementById('detail-modal').getAttribute('aria-hidden'), 'false', 'link opens the modal');
    assert.strictEqual(root.getElementById('modalSci').textContent, 'Corvus corax');
    assert.strictEqual(tabs(root)[3].getAttribute('aria-current'), 'true', 'still on the latest view');
    assert.ok(root.querySelector('.av-shell').classList.contains('av-view-latest'), 'latest layout kept');
    // In-app navigation to another bird, same card.
    window.history.pushState(null, '', '/lovelace/birds#sci=Calypte+anna');
    window.dispatchEvent(new window.Event('location-changed'));
    await wait(400);
    assert.strictEqual(root.getElementById('modalSci').textContent, 'Calypte anna');
    assert.strictEqual(tabs(root)[3].getAttribute('aria-current'), 'true', 'still on the latest view after navigation');
    void card;
    noErrors(window);
  },

  // 5a. Enabled but not on screen: no confidence lookup, no tick timer.
  // On screen: both. Off screen again, removed, reconfigured: no timer.
  async onlyWhileVisible() {
    const st = station();
    const { window, card, root } = mountCard({ window: 'all', latest_view: true }, st);
    await wait(1200);
    assert.strictEqual(tabs(root)[0].getAttribute('aria-current'), 'true', 'opens on the collage');
    assert.strictEqual(st.calls['Calypte anna'] || 0, 0, 'no confidence lookup while on the collage');
    assert.strictEqual(window.__tick30.size, 0, 'no tick timer while on the collage');
    tabs(root)[3].click();
    await wait(800);
    assert.ok(st.calls['Calypte anna'] >= 1, 'lookup runs once the view is shown');
    assert.strictEqual(confText(root), '93% confidence');
    assert.strictEqual(window.__tick30.size, 1, 'one tick timer while shown');
    tabs(root)[0].click();
    await wait(100);
    assert.strictEqual(window.__tick30.size, 0, 'tick stops when leaving the view');
    tabs(root)[3].click();
    await wait(100);
    assert.strictEqual(window.__tick30.size, 1, 'and restarts on return');
    card.remove();
    await wait(100);
    assert.strictEqual(window.__tick30.size, 0, 'tick stops when the card is removed');
    // Reconfigure a card that is on the latest view: the old instance's
    // tick must go; only the new instance's own one may remain.
    const card2 = window.document.createElement('habird-card');
    card2.setConfig({ birdnet_url: 'http://ha.local:8080', live: false, window: 'all', view: 'latest' });
    card2.hass = { themes: {}, states: {} };
    window.document.body.appendChild(card2);
    await wait(1200);
    assert.strictEqual(window.__tick30.size, 1, 'one tick for the shown view');
    card2.setConfig({ birdnet_url: 'http://ha.local:8080', live: false, window: 'all', view: 'latest', title: 'x' });
    await wait(1200);
    assert.strictEqual(window.__tick30.size, 1, 'reconfigure leaves no orphaned tick');
    noErrors(window);
  },

  // 5b. The lookup keeps its data source to itself: falling back to HA
  // history for the confidence must not mark the whole card as
  // MQTT-only (that disables the modal's audio for every bird).
  async lookupLeavesSharedFlag() {
    const st = station();
    st.speciesFail['Calypte anna'] = 99;   // REST search for this bird keeps failing
    const rl = st.summary[0].last_heard;
    st.detections['Corvus corax'] = [
      { id: 3, scientificName: 'Corvus corax', date: rl.slice(0, 10), time: rl.slice(11), confidence: 0.71 },
    ];
    const E = 'sensor.birdnet_go_mic';
    const iso = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();
    const history = [
      [{ entity_id: E + '_scientific_name', state: 'Calypte anna', last_changed: iso(5) }],
      [{ entity_id: E + '_confidence', state: '93.4', last_changed: iso(5) }],
      [{ entity_id: E + '_last_species', state: "Anna's Hummingbird", last_changed: iso(5) }],
    ];
    const hass = {
      themes: {},
      states: {
        [E + '_scientific_name']: { state: 'Calypte anna' },
        [E + '_confidence']: { state: '93.4' },
        [E + '_last_species']: { state: "Anna's Hummingbird" },
      },
      callApi: (method, p) => p.startsWith('history/period/')
        ? Promise.resolve(JSON.parse(JSON.stringify(history))) : Promise.reject(404),
    };
    const { window, card, root } = mountCard({ window: 'all', view: 'latest' }, st, { hass });
    await wait(1500);
    const openRaven = async () => {
      card._setRoute('#sci=Corvus%20corax');
      await wait(700);
      assert.strictEqual(root.getElementById('modalSci').textContent, 'Corvus corax');
    };
    await openRaven();                     // REST answers for the raven (cached)
    assert.strictEqual(root.querySelector('#modalRecordings .rec-no-audio'), null, 'raven recordings playable');
    root.querySelector('#detail-modal [data-close="1"]').click();
    await wait(700);
    tabs(root)[3].click();
    await wait(300);
    st.summary[1].last_heard = stamp(0.1); // a new hummingbird call -> new lookup
    card._refresh();
    await wait(1200);
    await openRaven();                     // same raven, from the cache
    assert.strictEqual(root.querySelector('#modalRecordings .rec-no-audio'), null,
      "the latest view's lookup didn't mark the card as MQTT-only");
    noErrors(window);
  },
};

(async () => {
  const only = process.argv[2];
  let failed = 0;
  for (const name of Object.keys(scenarios)) {
    if (only && name !== only) continue;
    try {
      await scenarios[name]();
      console.log('ok    ' + name);
    } catch (e) {
      failed++;
      console.log('FAIL  ' + name + ': ' + (e && e.message || e));
    }
  }
  if (failed) { console.error(failed + ' scenario(s) failed'); process.exit(1); }
  console.log('LATEST-BIRD REVIEW TEST PASSED');
  process.exit(0);
})();
