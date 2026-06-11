// Extract the adapter block + fetchJson dispatcher from apt.js and exercise
// them against canned BirdNET-Go responses.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const src = fs.readFileSync(ROOT + '/homeassistant/www/apt.js', 'utf8');

const start = src.indexOf('var AV_CFG');
const end = src.indexOf('// ======================= end BirdNET-Go adapter');
const adapter = src.slice(start, end);

// fetchJson dispatcher
const fjStart = src.indexOf('function fetchJson(url) {');
const fjEnd = src.indexOf('\n  }', src.indexOf('return fetch(url, { cache: \'no-store\' })', fjStart)) + 4;
const fetchJsonSrc = src.slice(fjStart, fjEnd);

// ---- stubs ----
const NOW = new Date('2026-06-10T14:30:00');  // local
global.Date = class extends Date { constructor(...a){ a.length ? super(...a) : super(NOW.getTime()); } static now(){ return NOW.getTime(); } };

const calls = [];
const responses = {
  '/api/v2/analytics/species/daily?date=2026-06-10': [
    { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird",
      count: 40, hourly_counts: [0,0,0,0,0,0,5,5,5,5,5,5,5,5,0,0,0,0,0,0,0,0,0,0],
      max_confidence: 0.99, first_heard: '06:10:00', latest_heard: '13:55:00' },
    { scientific_name: 'Corvus corax', common_name: 'Common Raven',
      count: 3, hourly_counts: [0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      max_confidence: 0.71, first_heard: '08:01:00', latest_heard: '08:20:00' },
  ],
  '/api/v2/analytics/species/daily?date=2026-06-09': [
    { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird",
      count: 24, hourly_counts: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      max_confidence: 0.88, first_heard: '00:30:00', latest_heard: '23:30:00' },
  ],
  '/api/v2/analytics/species/summary': [
    { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500,
      first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
    { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9,
      first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
  ],
  '/api/v2/analytics/species/summary?start_date=2026-06-03&end_date=2026-06-10': [
    { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 100,
      first_heard: '2026-06-03 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
  ],
  '/api/v2/analytics/time/daily?start_date=2026-05-12&end_date=2026-06-10':
    { data: [ { date: '2026-06-09', count: 24 }, { date: '2026-06-10', count: 43 } ], total: 67 },
  '/api/v2/analytics/species/diversity?start_date=2026-05-12&end_date=2026-06-10':
    { data: [ { date: '2026-06-10', unique_species: 2 } ], max_diversity: 2 },
  '/api/v2/analytics/time/distribution/hourly?start_date=2026-05-12&end_date=2026-06-10':
    Array.from({length:24}, (_,h) => ({ hour: h, count: h === 8 ? 12 : 0 })),
  '/api/v2/detections?queryType=search&search=Corvus%20corax&numResults=100':
    { data: [
      { id: 42, date: '2026-06-10', time: '08:20:00', scientificName: 'Corvus corax', commonName: 'Common Raven', confidence: 0.71 },
      { id: 41, date: '2026-06-10', time: '08:05:00', scientificName: 'Corvus corax sinuatus', commonName: 'Raven (sub)', confidence: 0.9 },
    ], total: 2 },
  '/api/v2/detections?queryType=search&search=Corvus%20corax&numResults=5':
    { data: [ { id: 42, scientificName: 'Corvus corax' } ], total: 1 },
};
global.location = { protocol: 'http:', hostname: 'homeassistant.local' };
global.window = { AV_CONFIG: { birdnetGoUrl: '', sitConfidence: 0.96 } };
global.fetch = (url, opts) => {
  calls.push(url);
  const path = url.replace('http://homeassistant.local:8080', '');
  if (url.startsWith('https://en.wikipedia.org/')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ extract: 'A large black bird.', title: 'Common raven' }) });
  }
  const body = responses[path];
  if (body === undefined) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(body))) });
};
function slugify(sci) { return sci.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

eval(adapter + '\n' + fetchJsonSrc + `
;(async () => {
  const assert = require('assert');

  // --- recent, 12h rolling window (02:30 yesterday? no: 02:30 today) ---
  // window = 2026-06-10 02:30 .. 14:30 -> today buckets 2..14 only.
  const recent12 = await fetchJson('./avian/api/birdnet-api.php?action=recent&hours=12');
  const anna12 = recent12.species.find(s => s.sci === 'Calypte anna');
  assert.strictEqual(anna12.n, 40, '12h anna should count today buckets 6-13 = 40');
  assert.strictEqual(anna12.best_conf, 0.99);
  assert.strictEqual(anna12.last_seen, '2026-06-10 13:55:00');
  const raven12 = recent12.species.find(s => s.sci === 'Corvus corax');
  assert.strictEqual(raven12.n, 3);
  console.log('recent 12h OK', JSON.stringify(recent12.species.map(s=>[s.sci,s.n])));

  // --- recent, 24h: crosses midnight -> today + yesterday buckets >= 14:30-1h
  const recent24 = await fetchJson('./avian/api/birdnet-api.php?action=recent&hours=24');
  const anna24 = recent24.species.find(s => s.sci === 'Calypte anna');
  // yesterday buckets overlapping window: h such that bucketEnd > 14:30 -> h >= 14 -> 10 buckets x1 = 10; today 40. total 50.
  assert.strictEqual(anna24.n, 50, '24h anna = 40 today + 10 yesterday, got ' + anna24.n);
  console.log('recent 24h OK', anna24.n);

  // --- recent 7d -> summary with start_date
  const recent7d = await fetchJson('./avian/api/birdnet-api.php?action=recent&hours=168');
  assert.strictEqual(recent7d.species[0].n, 100);
  console.log('recent 7d OK');

  // --- recent ALL ---
  const recentAll = await fetchJson('./avian/api/birdnet-api.php?action=recent&hours=1000000');
  assert.strictEqual(recentAll.species.length, 2);
  assert.strictEqual(recentAll.species[0].sci, 'Calypte anna'); // latest last_seen first
  console.log('recent ALL OK');

  // --- stats ---
  const stats = await fetchJson('./avian/api/birdnet-api.php?action=stats');
  assert.deepStrictEqual(stats.totals, { detections: 509, species: 2 });
  assert.deepStrictEqual(stats.today, { detections: 43, species: 2 });
  assert.strictEqual(stats.week.detections, 100);
  assert.strictEqual(stats.last_hour.detections, 0); // hour 14 buckets are 0
  assert.strictEqual(stats.started, '2026-01-02');
  console.log('stats OK', JSON.stringify(stats.totals));

  // --- lifelist sorted by first_seen asc ---
  const ll = await fetchJson('./avian/api/birdnet-api.php?action=lifelist');
  assert.strictEqual(ll.species[0].sci, 'Calypte anna');
  assert.strictEqual(ll.species[1].first_seen, '2026-06-01 09:00:00');
  console.log('lifelist OK');

  // --- firstseen desc ---
  const fs2 = await fetchJson('./avian/api/birdnet-api.php?action=firstseen&limit=10');
  assert.strictEqual(fs2.species[0].sci, 'Corvus corax');
  assert.strictEqual(fs2.species[0].total, 9);
  console.log('firstseen OK');

  // --- timeseries ---
  const ts = await fetchJson('./avian/api/birdnet-api.php?action=timeseries&days=30');
  assert.strictEqual(ts.daily.length, 2);
  assert.deepStrictEqual(ts.daily[1], { date: '2026-06-10', detections: 43, species: 2 });
  assert.strictEqual(ts.by_hour[8].detections, 12);
  console.log('timeseries OK');

  // --- species detail: exact-name filter drops the subspecies row ---
  const sp = await fetchJson('./avian/api/birdnet-api.php?action=species&sci=Corvus%20corax');
  assert.strictEqual(sp.detections.length, 1);
  assert.strictEqual(sp.detections[0].file, '42');
  assert.strictEqual(sp.summary.total, 9);
  assert.strictEqual(sp.summary.com, 'Common Raven');
  console.log('species OK');

  // --- wiki ---
  const wiki = await fetchJson('./avian/api/wiki.php?sci=Corvus%20corax');
  assert.strictEqual(wiki.extract, 'A large black bird.');
  console.log('wiki OK');

  // --- audio helpers ---
  assert.strictEqual(bgAudioUrl('42'), 'http://homeassistant.local:8080/api/v2/audio/42');
  const aurl = await resolveSpeciesAudio('Corvus corax');
  assert.strictEqual(aurl, 'http://homeassistant.local:8080/api/v2/audio/42');
  console.log('audio OK');

  // --- asset paths ---
  assert.strictEqual(assetSrc('Corvus corax', 2), './assets/illustrations/corvus-corax-2.png');
  assert.strictEqual(assetSrc('Corvus corax', 1), './assets/illustrations/corvus-corax.png');
  console.log('assets OK');

  // --- memoization: summary fetched once despite stats+lifelist+firstseen+ALL ---
  const summaryCalls = calls.filter(u => u.endsWith('/analytics/species/summary')).length;
  assert.strictEqual(summaryCalls, 1, 'species summary should be memoized, got ' + summaryCalls + ' calls');
  console.log('memoization OK');

  console.log('\\nALL ADAPTER TESTS PASSED');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
`);
