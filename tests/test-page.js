// Load the real index.html + config.js + apt.js in jsdom with a stubbed
// BirdNET-Go API; verify the app boots, renders atlas/stats from live
// data, and chooses poses by confidence.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const WWW = ROOT + '/homeassistant/www';
const html = fs.readFileSync(WWW + '/index.html', 'utf8');

const responses = {
  '/api/v2/analytics/species/summary': [
    { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird", count: 500,
      first_heard: '2026-01-02 08:00:00', last_heard: '2026-06-10 13:55:00', max_confidence: 0.99 },
    { scientific_name: 'Corvus corax', common_name: 'Common Raven', count: 9,
      first_heard: '2026-06-01 09:00:00', last_heard: '2026-06-10 08:20:00', max_confidence: 0.71 },
  ],
};
function respond(path) {
  if (responses[path]) return responses[path];
  if (path.startsWith('/api/v2/analytics/species/daily')) {
    return [
      { scientific_name: 'Calypte anna', common_name: "Anna's Hummingbird",
        count: 40, hourly_counts: [0,0,0,0,0,0,5,5,5,5,5,5,5,5,0,0,0,0,0,0,0,0,0,0],
        max_confidence: 0.99, first_heard: '06:10:00', latest_heard: '13:55:00' },
      { scientific_name: 'Corvus corax', common_name: 'Common Raven',
        count: 3, hourly_counts: [0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        max_confidence: 0.71, first_heard: '08:01:00', latest_heard: '08:20:00' },
    ];
  }
  if (path.includes('/analytics/species/summary?start_date=')) return responses['/api/v2/analytics/species/summary'];
  if (path.includes('/analytics/time/daily')) return { data: [{ date: '2026-06-10', count: 43 }] };
  if (path.includes('/analytics/species/diversity')) return { data: [{ date: '2026-06-10', unique_species: 2 }] };
  if (path.includes('/analytics/time/distribution/hourly')) return Array.from({length:24},(_,h)=>({hour:h,count:0}));
  if (path.includes('/detections?queryType=search')) return { data: [], total: 0 };
  return null;
}

const dom = new JSDOM(html, {
  url: 'http://homeassistant.local:8123/local/avianvisitors/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push(e.error || e.message));

window.fetch = (url, opts) => {
  const u = String(url);
  const path = u.replace('http://homeassistant.local:8080', '');
  if (u.startsWith('https://en.wikipedia.org/')) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ extract: 'x' }) });
  }
  const body = respond(path);
  if (body === null) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(404), arrayBuffer: () => Promise.reject(404) });
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(body))) });
};
window.Audio = class { addEventListener(){} load(){} play(){ return Promise.resolve(); } pause(){} };
// jsdom has no layout: give the collage a fake size so renderCollage runs.
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return this.id === 'collage' ? 1200 : 300; } });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return this.id === 'collage' ? 800 : 100; } });
window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect(){}, fillStyle:'', getImageData:()=>({data:[]}), putImageData(){}, clearRect(){}, createImageData:()=>({data:new Uint8ClampedArray(4)}) });

window.eval(fs.readFileSync(WWW + '/config.js', 'utf8'));
window.eval(fs.readFileSync(WWW + '/masks.js', 'utf8'));
// The page's i18n bootstrap loads the English table before apt.js; mirror
// that here so UI strings resolve (rather than falling back to raw keys).
window.eval(fs.readFileSync(WWW + '/i18n/en.js', 'utf8'));
  window.eval(fs.readFileSync(WWW + '/apt.js', 'utf8'));

setTimeout(() => {
  const doc = window.document;
  const assert = require('assert');
  try {
    // Collage rendered both species as tiles with static asset srcs
    const tiles = [...doc.querySelectorAll('.gtile img')];
    assert.ok(tiles.length === 2, 'expected 2 collage tiles, got ' + tiles.length);
    const srcs = tiles.map(t => t.getAttribute('src'));
    // Anna 0.99 >= 0.96 -> perched (no -2); Raven 0.71 -> flight (-2 exists for corvus-corax)
    assert.ok(srcs.some(s => s.includes('illustrations/calypte-anna.png')), 'anna perched: ' + srcs);
    assert.ok(srcs.some(s => s.includes('illustrations/corvus-corax-2.png')), 'raven flying: ' + srcs);
    // Atlas got cards
    const cards = [...doc.querySelectorAll('.bird-card')];
    assert.ok(cards.length === 2, 'expected 2 atlas cards, got ' + cards.length);
    assert.ok(cards[0].querySelector('img').getAttribute('src').includes('./assets/illustrations/'), 'atlas img static');
    // Stats lists populated
    assert.ok(doc.getElementById('statsByPeriod').textContent.includes('all time'), 'stats by period rendered');
    assert.ok(doc.getElementById('statsTopSpec').textContent.includes('Hummingbird'), 'top species rendered');
    assert.ok(doc.getElementById('statsFirstSeen').textContent.includes('Raven'), 'first seen rendered');
    // No uncaught errors during boot
    assert.deepStrictEqual(errors, [], 'uncaught errors: ' + errors.join('; '));
    console.log('PAGE SMOKE TEST PASSED:', tiles.length, 'tiles,', cards.length, 'cards, poses correct');
    process.exit(0);
  } catch (e) {
    console.error('FAIL:', e.message);
    console.error('window errors:', errors);
    process.exit(1);
  }
}, 1500);
// (appended) second phase exercised via a separate process is overkill;
