(function () {
  // Bumped whenever the offline sketch build changes, so the browser
  // doesn't keep a stale cache after we regenerate the sketches.
  var SKETCH_VERSION = 'r15'; // r15: 64 new Australian species (BirdNET-Go
                              // station list) + fox/frog non-bird detections.
                              // r14: silhouette masks for the 466 European
                              // (eBird DE) species so the collage can place
                              // them. r13: 2K House Sparrow flight + House Wren
                              // (both poses). r12: 2K House Sparrow perched.
  // Cache-bust for /api/img - bump whenever a bird gets re-rendered via
  // /api/regen or whenever you need every CF DC to drop its cached copy.
  // Cloudflare keys on the full URL incl. query, so bumping this is
  // equivalent to a global cache purge for /api/img. (caches.default
  // .delete() in the worker only affects ONE colo at a time, so a
  // versioned URL is the only reliable way to invalidate everywhere.)
  var IMG_VERSION = 'r15'; // r15: 64 new Australian species (BirdNET-Go
                           // station list) + fox/frog non-bird detections.
                           // r14: European (eBird DE) species masks land in
                           // the collage. r13: 2K House Sparrow flight + House
                           // Wren art - drop every cached copy. r12: 2K Sparrow
                           // perched.

  // ===========================================================================
  // BirdNET-Go adapter (Home Assistant build)
  // ===========================================================================
  // The original AvianVisitors frontend talks to BirdNET-Pi through the PHP
  // shims under ./avian/api/. This build is served as static files from Home
  // Assistant's /config/www and reads a BirdNET-Go instance's REST API v2
  // directly from the browser instead (BirdNET-Go ships permissive CORS by
  // default, and /api/v2/detections + /api/v2/analytics are public routes).
  //
  // To keep the rest of this file byte-comparable with upstream, the legacy
  // call sites are left intact and fetchJson() (defined further down, next to
  // the DATA cache) recognises the old birdnet-api.php / wiki.php URLs and
  // dispatches them here. Images come from the bundled ./assets/ folder;
  // audio comes from BirdNET-Go's /api/v2/audio/:id.
  //
  // Endpoint map (PHP action -> BirdNET-Go):
  //   stats       -> analytics/species/summary (all + last 7d) + species/daily (today)
  //   lifelist    -> analytics/species/summary
  //   recent N<=24h -> analytics/species/daily for today (+ yesterday), summing
  //                  the hourly_counts buckets that intersect the rolling window
  //   recent 7d   -> analytics/species/summary?start_date=<7d ago>
  //   recent ALL  -> analytics/species/summary
  //   activity    -> analytics/species/daily per covered date (max 7 days back),
  //                  keeping per-hour buckets for the stats heatmap
  //   timeseries  -> analytics/time/daily + analytics/species/diversity
  //                  + analytics/time/distribution/hourly
  //   firstseen   -> derived from the lifelist (sorted by first_heard desc)
  //   species     -> detections?queryType=search (exact sci-name filter client-side)
  //   wiki        -> en.wikipedia.org REST summary, fetched directly (CORS-open)

  var AV_CFG = window.AV_CONFIG || {};

  // ---- i18n runtime ----
  // Defined up front so it's available to every init-time and render-time
  // consumer below. Translation tables self-register into window.HABIRD_I18N
  // (one file per language under homeassistant/www/i18n/; the card build
  // inlines them all, the standalone page loads en + the detected language).
  // `en` is the complete key set and the fallback for every other language.
  var I18N = (typeof window !== 'undefined' && window.HABIRD_I18N) || { en: {} };
  // Resolve the active language once. Priority:
  //   1. explicit config override (AV_CFG.language)
  //   2. Home Assistant UI language (hass.language / hass.locale.language)
  //   3. navigator.language (standalone page)
  //   4. 'en'
  function resolveLocale() {
    var hass = AV_CFG.__getHass && AV_CFG.__getHass();
    var want = AV_CFG.language
      || (hass && (hass.language || (hass.locale && hass.locale.language)))
      || (typeof navigator !== 'undefined' && navigator.language)
      || 'en';
    want = String(want).toLowerCase();          // 'pt-BR' -> 'pt-br'
    if (I18N[want]) return want;
    var base = want.split('-')[0];
    if (I18N[base]) return base;
    return 'en';
  }
  var LOCALE = resolveLocale();   // key into I18N ('da', 'en', ...)
  var BCP47 = LOCALE;             // tag for Intl.* APIs (used from Step 2)
  // Wikipedia language subdomain for the active locale (used from Step 3).
  // Derive from the base subtag ('pt-br' -> 'pt'), with a small override
  // map for wikis whose code differs from the UI-language code (Norwegian
  // Bokmal/Nynorsk both live on no.wikipedia.org). 'en' means "current
  // behaviour" (English Wikipedia + English external link), so with no
  // hass.language (the test env) this stays byte-identical to before.
  var WIKI_LANG_OVERRIDES = { nb: 'no', nn: 'no' };
  var WIKI_LANG = (function () {
    var base = String(LOCALE || 'en').split('-')[0];
    return WIKI_LANG_OVERRIDES[base] || base || 'en';
  })();
  // Translate a key, falling back to the en table, then the key itself.
  // {name} placeholders are filled from the optional params object.
  function tt(key, params) {
    var table = I18N[LOCALE] || {};
    var en = I18N.en || {};
    var s = (key in table) ? table[key] : (en[key] != null ? en[key] : key);
    if (params) s = s.replace(/\{(\w+)\}/g, function (_, k) { return params[k] == null ? '' : params[k]; });
    return s;
  }
  // Relative-time formatter. Intl.RelativeTimeFormat localizes "5m ago",
  // "2d ago", ... for non-English locales. English is deliberately NOT
  // routed through it: the card's own compact "5m ago" wording is kept
  // byte-identical to the pre-i18n literals (RTF would say "5 min. ago").
  // So RTF stays null for BCP47='en' (and whenever Intl is unavailable),
  // and every site falls back to its plain-English string in that case.
  var RTF = null;
  try {
    if (BCP47 !== 'en' && typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
      RTF = new Intl.RelativeTimeFormat(BCP47, { numeric: 'always', style: 'short' });
    }
  } catch (e) { RTF = null; }
  // Format "<n> <unit> ago" via RTF when available, else the supplied
  // English fallback string. `unit` is an Intl RelativeTimeFormat unit
  // ('second'|'minute'|'hour'|'day'); the value is negated (past).
  function relTimeAgo(n, unit, enFallback) {
    if (RTF) { try { return RTF.format(-n, unit); } catch (e) {} }
    return enFallback;
  }
  // One DOM pass over the static template: data-i18n -> textContent,
  // data-i18n-html -> innerHTML (trusted rich strings), data-i18n-aria ->
  // aria-label, data-i18n-placeholder -> placeholder. The English literal
  // stays in the markup too (readable source + a no-JS default).
  function localizeStaticDom() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = tt(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = tt(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', tt(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', tt(el.getAttribute('data-i18n-placeholder')));
    });
  }
  if (typeof document !== 'undefined') localizeStaticDom();
  // Test hook: expose the resolved locale + helpers so the jsdom suite can
  // assert the fallback anchor (resolveLocale() === 'en' with no
  // hass.language) without reaching into this closure. Harmless in prod.
  try {
    window.__habirdI18n = { resolveLocale: resolveLocale, t: tt, get locale() { return LOCALE; }, get wikiLang() { return WIKI_LANG; } };
  } catch (e) {}

  // '' -> same host the dashboard is served from, port 8080 (the stock
  // alexbelgium app (add-on) exposes BirdNET-Go there on the HA box itself).
  var BG_BASE = (AV_CFG.birdnetGoUrl || '').replace(/\/+$/, '') ||
    (location.protocol + '//' + location.hostname + ':8080');
  // Perched at/above this best-in-window confidence, flying below it.
  var SIT_CONFIDENCE = (typeof AV_CFG.sitConfidence === 'number') ? AV_CFG.sitConfidence : 0.90;

  function bgUrl(path) { return BG_BASE + '/api/v2' + path; }

  // ---- HTTPS / Nabu Casa: route the API through HA ingress ----
  // Remote access tunnels only HA itself, and the browser blocks an
  // https page from calling a plain-http LAN URL (mixed content) - so
  // there is NO direct BirdNET-Go URL that works remotely. The add-on
  // ships HA ingress though, which is same-origin with HA and rides the
  // tunnel. When the page is https and a hass connection is available,
  // discover the add-on's ingress endpoint, open an ingress session
  // (cookie, renewed every 5 minutes), and rebase the API onto it -
  // full functionality, audio included, from anywhere. Discovery needs
  // an admin user (the supervisor API); anything failing here quietly
  // leaves the LAN default in place and the MQTT fallback carries data.
  var _ingressP = null;
  var _ingressWhy = '';
  function ingressApiBase() {
    if (_ingressP) return _ingressP;
    if (!AV_CFG.__getHass) {
      _ingressWhy = 'no hass connection';
      return (_ingressP = Promise.resolve(null));
    }
    _ingressP = (function () {
      function unwrap(res) { return (res && res.data) || res || {}; }
      // Supervisor access, two channels: the REST proxy (/api/hassio/*)
      // and, where that's unavailable, the WebSocket supervisor/api
      // command modern frontends use.
      function sup(method, path, data) {
        var hass = AV_CFG.__getHass();
        if (!hass) return Promise.reject('no hass');
        var rest = hass.callApi
          ? Promise.resolve(hass.callApi(method, 'hassio/' + path, data)).then(unwrap)
          : Promise.reject('no callApi');
        return rest.catch(function () {
          if (!hass.callWS) return Promise.reject('no supervisor access');
          return hass.callWS({
            type: 'supervisor/api',
            endpoint: '/' + path,
            method: method.toLowerCase(),
            data: data,
          }).then(unwrap);
        });
      }
      return sup('GET', 'addons').then(function (res) {
        var addons = (res && res.addons) || [];
        var hit = addons.filter(function (a) {
          return /birdnet/i.test(a.slug || '') || /birdnet/i.test(a.name || '');
        })[0];
        if (!hit) throw new Error('no birdnet add-on in the list');
        return sup('GET', 'addons/' + hit.slug + '/info');
      }, function () {
        // Listing failed (older proxies restrict it) - probe the
        // alexbelgium add-on's well-known slug directly; the repo hash
        // prefix is stable across installs.
        return sup('GET', 'addons/db21ed7f_birdnet-go/info');
      }).then(function (info) {
        if (!info.ingress || !(info.ingress_url || info.ingress_entry)) throw new Error('add-on has no ingress');
        // ingress_url may include the add-on's landing subpath (this one
        // declares ingress_entry: ui/dashboard) - POSTing under that hits
        // the UI's GET-only catch-all and 405s. The API lives at the bare
        // token mount, so strip everything after the token.
        var raw = String(info.ingress_url || info.ingress_entry);
        var m = raw.match(/^(\/api\/hassio_ingress\/[^\/]+)/);
        var base = m ? m[1] : raw.replace(/\/+$/, '');
        var session = null;
        function newSession() {
          return sup('POST', 'ingress/session').then(function (r) {
            session = (r && r.session) || null;
            if (session) {
              // NOTE: ';Secure' only over https - browsers silently DROP
              // JS-set Secure cookies on http pages, which would leave
              // every ingress request without its session (the
              // exclamation-mark flag failure on LAN installs).
              document.cookie = 'ingress_session=' + session +
                ';path=/api/hassio_ingress/;SameSite=Strict' +
                (location.protocol === 'https:' ? ';Secure' : '');
            }
            return session;
          });
        }
        return newSession().then(function (s) {
          if (!s) throw new Error('no ingress session');
          setInterval(function () {
            sup('POST', 'ingress/validate_session', { session: session })
              .catch(function () { newSession().catch(function () {}); });
          }, 5 * 60 * 1000);
          _ingressWhy = '';
          return base;
        });
      }).catch(function (e) {
        // Remember WHY for the flag's error surface, and don't poison
        // the cache - the next caller tries again.
        _ingressWhy = (e && e.message) || String(e);
        try { console.warn('[bird-card] ingress unavailable:', _ingressWhy); } catch (e2) {}
        _ingressP = null;
        return null;
      });
    })();
    return _ingressP;
  }
  // On an HTTPS page the LAN default is dead on arrival (mixed content) -
  // rebase ALL reads onto ingress. On plain http the direct LAN base is
  // faster and stays; ingress is still resolved on demand for writes.
  var BG_READY = Promise.resolve();
  if (!AV_CFG.birdnetGoUrl && location.protocol === 'https:' && AV_CFG.__getHass) {
    BG_READY = ingressApiBase().then(function (b) { if (b) BG_BASE = b; });
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  // Write-back: review a detection ('correct' | 'false_positive').
  // BirdNET-Go's CSRF guard is the stateless double-submit pattern: the
  // X-CSRF-Token header must equal the `csrf` cookie. Cookies only flow on
  // SAME-ORIGIN requests, so writes ride HA ingress (the cookie travels to
  // BirdNET-Go through the proxy). The token itself can be self-minted -
  // that's the nature of double-submit; the protection is that cross-site
  // JS can't set this origin's cookies, and we're legitimately same-origin.
  function bgReview(id, verified) {
    return ingressApiBase().then(function (ib) {
      var sameOrigin = !!ib ||
        BG_BASE.indexOf(location.protocol + '//' + location.host) === 0 ||
        BG_BASE.charAt(0) === '/';
      if (!sameOrigin) {
        // Cross-origin (direct LAN URL from the HA page): the browser
        // won't carry cookies, so CSRF can never pass. Needs ingress.
        return Promise.reject('needs-ingress: ' + (_ingressWhy || 'unavailable'));
      }
      var base = ib || BG_BASE;
      var tok = getCookie('csrf');
      if (!tok) {
        tok = String(Date.now()) + Math.random().toString(36).slice(2) +
          Math.random().toString(36).slice(2);
        document.cookie = 'csrf=' + tok + ';path=/;SameSite=Lax' +
          (location.protocol === 'https:' ? ';Secure' : '');
      }
      function post() {
        return fetch(base + '/api/v2/detections/' + encodeURIComponent(id) + '/review', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': tok,
          },
          body: JSON.stringify({ verified: verified }),
        }).then(function (r) { return r.ok ? r : Promise.reject(r.status); });
      }
      return post().catch(function (status) {
        // 401 usually means the ingress session lapsed - mint a fresh
        // one and retry once.
        if (status !== 401 || !ib) return Promise.reject(status);
        _ingressP = null;
        return ingressApiBase().then(function () { return post(); });
      });
    });
  }

  // ---- Audio boost ----
  // Detection clips are quiet; an HTMLAudio element caps at 1.0, so the
  // boost routes playback through WebAudio: gain (configurable dB) into a
  // compressor so the louder signal limits instead of clipping. Needs
  // CORS-clean audio (crossOrigin=anonymous; BirdNET-Go's media endpoints
  // send permissive CORS, and ingress is same-origin anyway).
  var _boostCtx = null;
  function makeAudio(url) {
    var audio = new Audio();
    var db = +AV_CFG.audioBoostDb || 0;
    if (db > 0) audio.crossOrigin = 'anonymous';
    audio.src = url;
    if (db > 0) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try {
          if (!_boostCtx) _boostCtx = new Ctx();
          if (_boostCtx.state === 'suspended') _boostCtx.resume();
          var srcNode = _boostCtx.createMediaElementSource(audio);
          var gain = _boostCtx.createGain();
          gain.gain.value = Math.pow(10, db / 20);
          var comp = _boostCtx.createDynamicsCompressor();
          srcNode.connect(gain);
          gain.connect(comp);
          comp.connect(_boostCtx.destination);
        } catch (e) { /* boost is best-effort; the element still plays */ }
      }
    }
    return audio;
  }

  function bgJson(path) {
    return BG_READY.then(function () {
      return fetch(bgUrl(path), { cache: 'no-store' });
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
  }
  // Short-TTL memo so one refreshAll() fan-out (stats + lifelist + recent +
  // firstseen all want the species summary) costs one HTTP request, while a
  // later poll still refetches. Failed promises are evicted immediately so
  // a transient error doesn't get cached for the TTL.
  var _bgMemo = {};
  function bgMemoJson(path, ttlMs) {
    ttlMs = ttlMs || 10000;
    var hit = _bgMemo[path];
    var now = Date.now();
    if (hit && (now - hit.t) < ttlMs) return hit.p;
    var p = bgJson(path);
    _bgMemo[path] = { t: now, p: p };
    p.catch(function () {
      if (_bgMemo[path] && _bgMemo[path].p === p) delete _bgMemo[path];
    });
    return p;
  }

  // Local-time YYYY-MM-DD (toISOString would shift the date in any
  // timezone west of UTC; BirdNET-Go's dates are server-local).
  function bgDateStr(d) {
    return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) +
      '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
  }

  // analytics/species/summary row -> the legacy lifelist/recent species shape.
  function bgSummaryRow(r) {
    return {
      sci: r.scientific_name,
      com: r.common_name,
      n: +r.count || 0,
      best_conf: +r.max_confidence || 0,
      first_seen: r.first_heard || null,   // "YYYY-MM-DD HH:MM:SS"
      last_seen: r.last_heard || null,
    };
  }

  function bgLifelist() {
    return bgMemoJson('/analytics/species/summary').then(function (rows) {
      var species = (rows || []).map(bgSummaryRow);
      species.sort(function (a, b) { return (a.first_seen || '').localeCompare(b.first_seen || ''); });
      return { species: species, as_of: new Date().toISOString() };
    });
  }

  // Species heard in the rolling window. Windows longer than a day use the
  // day-granular species summary; windows up to 24h are rebuilt from the
  // per-day hourly_counts buckets of today (and yesterday when the window
  // crosses midnight), so 1H/12H/24H stay rolling rather than calendar-day.
  // Hour-bucket resolution means the window edge is fuzzy by up to an hour -
  // fine for a collage sized by relative counts.
  function bgRecent(hours) {
    var now = new Date();
    if (hours > 24) {
      var path = '/analytics/species/summary';
      if (hours < 1000000) {
        path += '?start_date=' + bgDateStr(new Date(now.getTime() - hours * 3600000)) +
          '&end_date=' + bgDateStr(now);
      }
      return bgMemoJson(path).then(function (rows) {
        var species = (rows || []).map(bgSummaryRow);
        species.sort(function (a, b) { return (b.last_seen || '').localeCompare(a.last_seen || ''); });
        return { hours: hours, species: species, as_of: now.toISOString() };
      });
    }
    var windowStart = now.getTime() - hours * 3600000;
    var days = [bgDateStr(now)];
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (windowStart < dayStart) days.push(bgDateStr(new Date(now.getTime() - 86400000)));
    return Promise.all(days.map(function (d) {
      // rows:null marks a FAILED fetch (vs an empty day) - if every day
      // failed the API is unreachable and the whole call must reject so
      // the 'auto' data-source routing can fall back to HA history.
      return bgMemoJson('/analytics/species/daily?date=' + d)
        .then(function (rows) { return { date: d, rows: rows || [] }; },
              function () { return { date: d, rows: null }; });
    })).then(function (perDay) {
      if (perDay.every(function (d) { return d.rows === null; })) {
        return Promise.reject('daily summary unreachable');
      }
      var bySci = {};
      perDay.forEach(function (day) {
        // Hour buckets for this date, as ms epochs, to test window overlap.
        var p = day.date.split('-');
        var dayBase = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
        (day.rows || []).forEach(function (r) {
          var inWin = 0;
          var counts = r.hourly_counts || [];
          for (var h = 0; h < 24; h++) {
            var bStart = dayBase + h * 3600000;
            // Count a bucket if any part of it lies inside [windowStart, now].
            if (bStart + 3600000 > windowStart && bStart <= now.getTime()) {
              inWin += +counts[h] || 0;
            }
          }
          if (!inWin) return;
          var lastSeen = r.latest_heard ? (day.date + ' ' + r.latest_heard) : null;
          var rec = bySci[r.scientific_name];
          if (!rec) {
            bySci[r.scientific_name] = {
              sci: r.scientific_name,
              com: r.common_name,
              n: inWin,
              best_conf: +r.max_confidence || 0,
              last_seen: lastSeen,
            };
          } else {
            rec.n += inWin;
            rec.best_conf = Math.max(rec.best_conf, +r.max_confidence || 0);
            if (lastSeen && (!rec.last_seen || lastSeen > rec.last_seen)) rec.last_seen = lastSeen;
          }
        });
      });
      var species = Object.keys(bySci).map(function (k) { return bySci[k]; });
      species.sort(function (a, b) { return (b.last_seen || '').localeCompare(a.last_seen || ''); });
      // Older BirdNET-Go builds omit max_confidence from the daily
      // summary; backfill from the all-time species summary (memoized -
      // stats/lifelist fetch it anyway) so the sit/fly rule has a real
      // best-in-window... best-available confidence to work with.
      if (species.some(function (s) { return !s.best_conf; })) {
        return bgMemoJson('/analytics/species/summary').then(function (rows) {
          var bySci2 = {};
          (rows || []).forEach(function (r) { bySci2[r.scientific_name] = +r.max_confidence || 0; });
          species.forEach(function (s) {
            if (!s.best_conf && bySci2[s.sci]) s.best_conf = bySci2[s.sci];
          });
          return { hours: hours, species: species, as_of: now.toISOString() };
        }).catch(function () {
          return { hours: hours, species: species, as_of: now.toISOString() };
        });
      }
      return { hours: hours, species: species, as_of: now.toISOString() };
    });
  }

  // Per-species hourly activity for the stats heatmap: rows of
  // { sci, com, n, byHour[24] } where byHour buckets are hour-of-day.
  // Windows up to a day count only buckets inside the rolling window;
  // longer windows (7D/ALL) aggregate hour-of-day over the last 7 days -
  // the daily-summary endpoint is per-date, so wider spans would mean a
  // fetch per day. Past days never change, so they memo on a long TTL
  // and the steady-state poll only refetches today's summary.
  function bgActivity(hours) {
    var now = new Date();
    var winHours = Math.min(hours, 7 * 24);
    var windowStart = now.getTime() - winHours * 3600000;
    var todayStr = bgDateStr(now);
    var dates = [];
    for (var off = 0; off < 8; off++) {
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off);
      if (base.getTime() + 86400000 <= windowStart) break;
      dates.push(bgDateStr(base));
    }
    return Promise.all(dates.map(function (d) {
      // rows:null marks a FAILED fetch (vs an empty day) - see bgRecent.
      return bgMemoJson('/analytics/species/daily?date=' + d, d === todayStr ? 10000 : 600000)
        .then(function (rows) { return { date: d, rows: rows || [] }; },
              function () { return { date: d, rows: null }; });
    })).then(function (perDay) {
      if (perDay.every(function (d) { return d.rows === null; })) {
        return Promise.reject('daily summary unreachable');
      }
      var bySci = {};
      perDay.forEach(function (day) {
        var p = day.date.split('-');
        var dayBase = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
        (day.rows || []).forEach(function (r) {
          var counts = r.hourly_counts || [];
          for (var h = 0; h < 24; h++) {
            var n = +counts[h] || 0;
            if (!n) continue;
            // Count a bucket if any part of it lies inside [windowStart, now].
            var bStart = dayBase + h * 3600000;
            if (bStart + 3600000 <= windowStart || bStart > now.getTime()) continue;
            var rec = bySci[r.scientific_name];
            if (!rec) {
              rec = bySci[r.scientific_name] = {
                sci: r.scientific_name, com: r.common_name,
                n: 0, byHour: new Array(24).fill(0),
              };
            }
            rec.n += n;
            rec.byHour[h] += n;
          }
        });
      });
      var species = Object.keys(bySci).map(function (k) { return bySci[k]; });
      species.sort(function (a, b) { return b.n - a.n; });
      return { hours: hours, win_hours: winHours, species: species, as_of: now.toISOString() };
    });
  }

  function bgStats() {
    var now = new Date();
    var weekStart = bgDateStr(new Date(now.getTime() - 7 * 86400000));
    return Promise.all([
      bgMemoJson('/analytics/species/summary'),
      bgMemoJson('/analytics/species/daily?date=' + bgDateStr(now)).catch(function () { return []; }),
      bgMemoJson('/analytics/species/summary?start_date=' + weekStart + '&end_date=' + bgDateStr(now))
        .catch(function () { return []; }),
    ]).then(function (parts) {
      var all = parts[0] || [], today = parts[1] || [], week = parts[2] || [];
      function sumCounts(rows) {
        return rows.reduce(function (a, r) { return a + (+r.count || 0); }, 0);
      }
      // "Last hour" = the current clock-hour's bucket across all species.
      // (The PHP shim used a rolling 60 minutes; hour-bucket precision is
      // the best the daily-summary endpoint offers and reads the same.)
      var hr = now.getHours();
      var lastHour = today.reduce(function (a, r) {
        return a + (+((r.hourly_counts || [])[hr]) || 0);
      }, 0);
      var started = null;
      all.forEach(function (r) {
        var d = (r.first_heard || '').slice(0, 10);
        if (d && (!started || d < started)) started = d;
      });
      return {
        totals: { detections: sumCounts(all), species: all.length },
        today: { detections: sumCounts(today), species: today.length },
        last_hour: { detections: lastHour },
        week: { detections: sumCounts(week), species: week.length },
        started: started,
        as_of: now.toISOString(),
      };
    });
  }

  function bgFirstseen(limit) {
    return bgLifelist().then(function (j) {
      var rows = j.species.slice().sort(function (a, b) {
        return (b.first_seen || '').localeCompare(a.first_seen || '');
      }).slice(0, limit || 10).map(function (s) {
        return { sci: s.sci, com: s.com, first_seen: s.first_seen, total: s.n };
      });
      return { species: rows, as_of: new Date().toISOString() };
    });
  }

  function bgTimeseries(days) {
    days = days || 30;
    var now = new Date();
    var start = bgDateStr(new Date(now.getTime() - (days - 1) * 86400000));
    var end = bgDateStr(now);
    var range = '?start_date=' + start + '&end_date=' + end;
    return Promise.all([
      bgMemoJson('/analytics/time/daily' + range).catch(function () { return null; }),
      bgMemoJson('/analytics/species/diversity' + range).catch(function () { return null; }),
      bgMemoJson('/analytics/time/distribution/hourly' + range).catch(function () { return null; }),
    ]).then(function (parts) {
      // All three null = the API is unreachable (not just sparse data):
      // reject so 'auto' routing can fall back to HA history.
      if (!parts[0] && !parts[1] && !parts[2]) {
        return Promise.reject('analytics unreachable');
      }
      var byDate = {};
      (((parts[0] || {}).data) || []).forEach(function (r) {
        byDate[r.date] = { date: r.date, detections: +r.count || 0, species: 0 };
      });
      (((parts[1] || {}).data) || []).forEach(function (r) {
        if (!byDate[r.date]) byDate[r.date] = { date: r.date, detections: 0, species: 0 };
        byDate[r.date].species = +r.unique_species || 0;
      });
      var daily = Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
      var by_hour = (parts[2] || []).map(function (r) {
        return { hour: +r.hour, detections: +r.count || 0 };
      });
      return { days: days, daily: daily, by_hour: by_hour, as_of: now.toISOString() };
    });
  }

  // Per-species detail: the detection list that powers the modal's
  // Recordings section. queryType=search matches sci OR common name with
  // LIKE, so re-filter to the exact scientific name (keeps subspecies and
  // similarly-named species out). `file` carries the BirdNET-Go detection
  // ID - everything downstream treats it as an opaque audio key.
  function bgSpecies(sci) {
    return Promise.all([
      bgMemoJson('/detections?queryType=search&search=' + encodeURIComponent(sci) + '&numResults=100', 30000),
      bgLifelist(),
    ]).then(function (parts) {
      var dets = ((parts[0] || {}).data || []).filter(function (d) {
        return d.scientificName === sci;
      }).map(function (d) {
        return { d: d.date, t: d.time, file: String(d.id), conf: +d.confidence || 0 };
      });
      var row = parts[1].species.filter(function (s) { return s.sci === sci; })[0] || {};
      return {
        sci: sci,
        summary: {
          com: row.com || null,
          total: row.n || dets.length,
          first_seen: row.first_seen || null,
          last_seen: row.last_seen || null,
          best_conf: row.best_conf || null,
        },
        detections: dets,
      };
    });
  }

  // Fetch a Wikipedia summary for a scientific name. The query key is the
  // Latin name (language-independent), and most non-English wikis carry a
  // redirect from it that the summary endpoint follows - so the localized
  // article can usually be fetched directly. Tries `lang` first, then
  // falls back to English on any 404 / network error / empty extract.
  // Returns { extract, title, lang, url } (title/url reflect the wiki the
  // extract actually came from). With lang omitted or 'en' this is the
  // original English-only behaviour.
  function bgWiki(sci, lang) {
    var L = lang || 'en';
    var tryLang = function (code) {
      return fetch('https://' + code + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(sci))
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (j) {
          if (!j.extract) return Promise.reject('empty');
          return {
            extract: j.extract,
            title: j.title || null,
            lang: code,
            url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || null,
          };
        });
    };
    return (L !== 'en')
      ? tryLang(L).catch(function () { return tryLang('en'); })
      : tryLang('en');
  }

  // BirdNET-Go serves each detection's clip at /api/v2/audio/:id.
  function bgAudioUrl(fileId) {
    return bgUrl('/audio/' + encodeURIComponent(fileId));
  }

  // Latest clip for a species (the atlas cards' play button). Resolved
  // lazily on first play and cached - the legacy recording.php?sci= shim
  // did this lookup server-side.
  var _speciesAudioCache = {};
  function resolveSpeciesAudio(sci) {
    if (_speciesAudioCache[sci]) return _speciesAudioCache[sci];
    var p = bgJson('/detections?queryType=search&search=' + encodeURIComponent(sci) + '&numResults=5')
      .then(function (j) {
        var hit = ((j || {}).data || []).filter(function (d) {
          return d.scientificName === sci;
        })[0];
        if (!hit) throw new Error('no recording');
        return bgAudioUrl(hit.id);
      });
    p.catch(function () {
      if (_speciesAudioCache[sci] === p) delete _speciesAudioCache[sci];
    });
    return (_speciesAudioCache[sci] = p);
  }

  // ---- Reference call (Xeno-Canto) ----
  // A canonical example call/song for a species, fetched from the
  // Xeno-Canto v3 API so it can be compared against BirdNET-Go's own
  // captures. This is a DIFFERENT thing from resolveSpeciesAudio above:
  // that returns what your mic recorded, this returns a clean reference.
  // Needs a free API key (AV_CFG.xenoCantoKey); the feature stays hidden
  // without one. v3 sends `access-control-allow-origin: *`, so the
  // browser can query it directly - no server proxy needed. Cached per
  // species (resolved metadata, including the playable audio URL).
  var _refCallCache = {};
  function refCallEnabled() { return !!(AV_CFG && AV_CFG.xenoCantoKey); }
  function _xcLenSeconds(s) {
    // XC `length` is "m:ss" (or occasionally bare seconds).
    if (s == null) return 0;
    s = String(s);
    if (s.indexOf(':') >= 0) {
      var a = s.split(':');
      return (+a[0] || 0) * 60 + (+a[1] || 0);
    }
    return +s || 0;
  }
  function _xcHttps(u) {
    // XC returns protocol-relative URLs (//xeno-canto.org/...).
    if (!u) return '';
    return u.indexOf('//') === 0 ? 'https:' + u : u;
  }
  // Fetch the XC API with bounded retry on 429 (rate limit) + transient
  // 5xx, honoring Retry-After. XC throttles free keys, so without this a
  // burst of taps makes some calls fail with a bare "unavailable".
  function _xcFetchWithRetry(url, attempt) {
    attempt = attempt || 0;
    return fetch(url).then(function (r) {
      if ((r.status === 429 || (r.status >= 500 && r.status < 600)) && attempt < 3) {
        var ra = parseFloat(r.headers.get('Retry-After'));
        var wait = (ra > 0 ? ra : Math.pow(2, attempt)) * 1000;  // ~1s, 2s, 4s
        return new Promise(function (res) { setTimeout(res, wait); })
          .then(function () { return _xcFetchWithRetry(url, attempt + 1); });
      }
      if (!r.ok) throw new Error('xc-http-' + r.status);
      return r.json();
    });
  }
  function resolveReferenceCall(sci) {
    if (!refCallEnabled()) return Promise.reject(new Error('no key'));
    if (_refCallCache[sci]) return _refCallCache[sci];
    var parts = String(sci).trim().split(/\s+/);
    // v3 query tags: gen:<genus> sp:<species>. Quote to keep them exact.
    var q = 'gen:"' + (parts[0] || '') + '"';
    if (parts[1]) q += ' sp:"' + parts[1] + '"';
    var url = 'https://xeno-canto.org/api/3/recordings?query='
      + encodeURIComponent(q) + '&key=' + encodeURIComponent(AV_CFG.xenoCantoKey);
    var p = _xcFetchWithRetry(url, 0)
      .then(function (j) {
        var recs = (j && j.recordings) || [];
        // Rank: real audio file first, then call/song over other types,
        // then short clips (<=30s), then best quality (q 'A' beats 'E').
        var scored = recs.filter(function (r) { return r && r.file; }).map(function (r) {
          var t = (r.type || '').toLowerCase();
          var len = _xcLenSeconds(r.length);
          return {
            r: r,
            pref: /\b(call|song)\b/.test(t) ? 0 : 1,
            shortish: (len > 0 && len <= 30) ? 0 : 1,
            qual: (r.q || 'E').charAt(0).toUpperCase()
          };
        });
        scored.sort(function (a, b) {
          return (a.pref - b.pref) || (a.shortish - b.shortish)
            || (a.qual < b.qual ? -1 : a.qual > b.qual ? 1 : 0);
        });
        // Return a ranked CANDIDATE LIST so playback can fall through to
        // the next recording if one won't play in the browser. Kept wide
        // (15) because high-volume species can have many in-browser-
        // unplayable files before a good one.
        var cands = scored.slice(0, 15).map(function (s) {
          var r = s.r;
          return {
            url: _xcHttps(r.file), page: _xcHttps(r.url), rec: r.rec || '',
            lic: _xcHttps(r.lic), type: r.type || '', q: r.q || '', id: r.id || ''
          };
        });
        if (!cands.length) throw new Error('no recording');
        return cands;
      });
    // Don't cache failures - a later open should retry (transient/quota).
    p.catch(function () { if (_refCallCache[sci] === p) delete _refCallCache[sci]; });
    return (_refCallCache[sci] = p);
  }

  // ---- Fallback data source: HA history of the BirdNET-Go MQTT sensors ----
  // BirdNET-Go's MQTT support gives each microphone a Home Assistant device
  // with "Scientific Name" / "Last Species" / "Confidence" sensors that
  // update on every detection. The sensors only hold the LATEST detection,
  // but HA's recorder keeps their state history - so the detection stream
  // (time + species + confidence) can be rebuilt from /api/history and
  // aggregated client-side into everything the views need. Used when
  // BirdNET-Go's REST API isn't reachable from the browser (dataSource
  // 'auto', the default) or when forced with dataSource 'ha'.
  //
  // Limits vs the REST API: no audio clips (recordings never travel over
  // MQTT), and history only reaches back as far as HA's recorder retention
  // (default ~10 days) - the ALL window and life list show that span.

  function haAvailable() {
    var hass = AV_CFG.__getHass && AV_CFG.__getHass();
    return !!((hass && hass.callApi) || AV_CFG.haToken || (AV_CFG.wall || {}).haToken);
  }
  // GET against HA's REST API ('states', 'history/period/...') - through
  // the card's authenticated hass connection when present, else a
  // long-lived token (static-page install).
  function haApi(path) {
    var hass = AV_CFG.__getHass && AV_CFG.__getHass();
    if (hass && hass.callApi) return Promise.resolve(hass.callApi('GET', path));
    var token = AV_CFG.haToken || (AV_CFG.wall || {}).haToken;
    if (!token) return Promise.reject('no HA access');
    return fetch('/api/' + path, {
      cache: 'no-store',
      headers: { 'Authorization': 'Bearer ' + token },
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
  }
  var _haMemo = {};
  function haMemo(key, ttlMs, make) {
    var hit = _haMemo[key];
    var now = Date.now();
    if (hit && (now - hit.t) < ttlMs) return hit.p;
    var p = make();
    _haMemo[key] = { t: now, p: p };
    p.catch(function () { if (_haMemo[key] && _haMemo[key].p === p) delete _haMemo[key]; });
    return p;
  }

  // How far back history-mode data reaches (bounded by HA's recorder
  // retention, default 10 days - fetching further just returns less).
  function hhDays() { return Math.max(1, +AV_CFG.historyDays || 10); }

  // The MQTT sensor trios, one per microphone. Explicit via AV_CFG.haSensors
  // (a list of *_scientific_name entity ids) or discovered by suffix.
  function hhSensorSets() {
    function fromIds(ids) {
      return ids.filter(function (id) { return /_scientific_name$/.test(id); })
        .map(function (id) {
          return {
            sci: id,
            conf: id.replace(/_scientific_name$/, '_confidence'),
            com: id.replace(/_scientific_name$/, '_last_species'),
          };
        });
    }
    if (AV_CFG.haSensors && AV_CFG.haSensors.length) {
      return Promise.resolve(fromIds(AV_CFG.haSensors));
    }
    var hass = AV_CFG.__getHass && AV_CFG.__getHass();
    if (hass && hass.states) return Promise.resolve(fromIds(Object.keys(hass.states)));
    return haMemo('states', 60000, function () { return haApi('states'); })
      .then(function (all) {
        return fromIds((all || []).map(function (e) { return e.entity_id; }));
      });
  }

  function hhFmtTs(ms) {
    var d = new Date(ms);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  // Detection events, oldest first: [{t(ms), sci, com, conf(0..1)}].
  // 'short' covers the rolling-24h windows on a fresh TTL; 'long' covers
  // lifelist/stats/charts on a slower one. One event per confidence-sensor
  // update (confidence differs detection to detection, so back-to-back
  // detections of the SAME species still register as separate events),
  // joined with the species names in force at that moment; species changes
  // the confidence stream missed count too.
  function hhEvents(kind) {
    var ttl = kind === 'short' ? 10000 : 240000;
    return haMemo('events:' + kind, ttl, function () {
      var sinceMs = kind === 'short'
        ? Date.now() - 25 * 3600000
        : Date.now() - hhDays() * 86400000;
      return hhSensorSets().then(function (sets) {
        if (!sets.length) return Promise.reject('no BirdNET-Go MQTT sensors found');
        var ids = [];
        sets.forEach(function (s) { ids.push(s.sci, s.conf, s.com); });
        var path = 'history/period/' + new Date(sinceMs).toISOString() +
          '?filter_entity_id=' + encodeURIComponent(ids.join(',')) +
          '&end_time=' + encodeURIComponent(new Date().toISOString()) +
          '&minimal_response&no_attributes';
        return haApi(path).then(function (hist) {
          // hist: one array per entity; its first row carries entity_id,
          // later rows are minimal {state, last_changed}.
          var byId = {};
          (hist || []).forEach(function (rows) {
            if (rows && rows.length) byId[rows[0].entity_id] = rows;
          });
          function timeline(id) {
            var out = [];
            (byId[id] || []).forEach(function (r) {
              var st = r.state;
              if (st == null || st === '' || st === 'unknown' || st === 'unavailable' || st === 'None') return;
              var t = Date.parse(r.last_changed || r.last_updated);
              if (!isNaN(t)) out.push({ t: t, v: st });
            });
            out.sort(function (a, b) { return a.t - b.t; });
            return out;
          }
          // Monotonic "latest value at time t (+2s MQTT fan-out jitter)"
          // walker: the event streams are processed in ascending time, so
          // a single advancing pointer replaces the old O(n^2) rescans -
          // a 10-day busy-station history joins in linear time.
          function walker(tl) {
            var i = 0, last = null;
            return function (t) {
              while (i < tl.length && tl[i].t <= t + 2000) { last = tl[i].v; i++; }
              return last;
            };
          }
          function toConf(v) {
            var n = parseFloat(v);
            if (isNaN(n)) return 0;
            return n > 1 ? n / 100 : n;   // sensor publishes percent
          }
          var events = [];
          sets.forEach(function (s) {
            var confs = timeline(s.conf);
            var scis = timeline(s.sci);
            var comAtA = walker(timeline(s.com));
            var comAtB = walker(timeline(s.com));
            var sciAt = walker(scis);
            var confAt = walker(confs);
            // 2-second buckets of (species, time) already emitted via the
            // confidence stream, so the species pass can skip duplicates
            // without scanning the whole event list per entry.
            var seen = {};
            confs.forEach(function (c) {
              var sci = sciAt(c.t);
              if (!sci) return;
              var b = Math.round(c.t / 2000);
              seen[sci + '|' + (b - 1)] = 1;
              seen[sci + '|' + b] = 1;
              seen[sci + '|' + (b + 1)] = 1;
              events.push({ t: c.t, sci: sci, com: comAtA(c.t) || sci, conf: toConf(c.v) });
            });
            scis.forEach(function (sc) {
              if (seen[sc.v + '|' + Math.round(sc.t / 2000)]) return;
              events.push({ t: sc.t, sci: sc.v, com: comAtB(sc.t) || sc.v,
                conf: toConf(confAt(sc.t)) });
            });
          });
          events.sort(function (a, b) { return a.t - b.t; });
          return events;
        });
      });
    });
  }

  // Collapse events at/after sinceMs into the species rows the views expect.
  function hhAgg(events, sinceMs) {
    var by = {};
    events.forEach(function (e) {
      if (e.t < sinceMs) return;
      var r = by[e.sci];
      if (!r) r = by[e.sci] = { sci: e.sci, com: e.com, n: 0, best_conf: 0, _f: e.t, _l: e.t };
      r.n++;
      if (e.conf > r.best_conf) r.best_conf = e.conf;
      if (e.t < r._f) r._f = e.t;
      if (e.t >= r._l) { r._l = e.t; r.com = e.com; }
    });
    return Object.keys(by).map(function (k) {
      var r = by[k];
      r.first_seen = hhFmtTs(r._f);
      r.last_seen = hhFmtTs(r._l);
      delete r._f; delete r._l;
      return r;
    });
  }

  function hhRecent(hours) {
    var kind = hours <= 24 ? 'short' : 'long';
    var since = hours >= 1000000 ? 0 : Date.now() - hours * 3600000;
    return hhEvents(kind).then(function (ev) {
      var species = hhAgg(ev, since);
      species.sort(function (a, b) { return (b.last_seen || '').localeCompare(a.last_seen || ''); });
      return { hours: hours, species: species, as_of: new Date().toISOString() };
    });
  }

  // Per-species hourly activity from the MQTT event stream - same shape
  // and 7-day cap as bgActivity.
  function hhActivity(hours) {
    var winHours = Math.min(hours, 7 * 24);
    var since = Date.now() - winHours * 3600000;
    return hhEvents(hours <= 24 ? 'short' : 'long').then(function (ev) {
      var by = {};
      ev.forEach(function (e) {
        if (e.t < since) return;
        var r = by[e.sci];
        if (!r) r = by[e.sci] = { sci: e.sci, com: e.com, n: 0, byHour: new Array(24).fill(0) };
        r.n++;
        r.byHour[new Date(e.t).getHours()]++;
        r.com = e.com;
      });
      var species = Object.keys(by).map(function (k) { return by[k]; });
      species.sort(function (a, b) { return b.n - a.n; });
      return { hours: hours, win_hours: winHours, species: species, as_of: new Date().toISOString() };
    });
  }

  function hhLifelist() {
    return hhEvents('long').then(function (ev) {
      var species = hhAgg(ev, 0);
      species.sort(function (a, b) { return (a.first_seen || '').localeCompare(b.first_seen || ''); });
      return { species: species, as_of: new Date().toISOString() };
    });
  }

  function hhFirstseen(limit) {
    return hhLifelist().then(function (j) {
      var rows = j.species.slice().sort(function (a, b) {
        return (b.first_seen || '').localeCompare(a.first_seen || '');
      }).slice(0, limit || 10).map(function (s) {
        return { sci: s.sci, com: s.com, first_seen: s.first_seen, total: s.n };
      });
      return { species: rows, as_of: new Date().toISOString() };
    });
  }

  function hhStats() {
    return hhEvents('long').then(function (ev) {
      var now = new Date();
      var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      function tally(since) {
        var n = 0, sp = {};
        ev.forEach(function (e) { if (e.t >= since) { n++; sp[e.sci] = 1; } });
        return { detections: n, species: Object.keys(sp).length };
      }
      var all = tally(0), today = tally(dayStart), week = tally(now.getTime() - 7 * 86400000);
      return {
        totals: all,
        today: today,
        last_hour: { detections: tally(now.getTime() - 3600000).detections },
        week: week,
        started: ev.length ? hhFmtTs(ev[0].t).slice(0, 10) : null,
        as_of: now.toISOString(),
      };
    });
  }

  function hhTimeseries(days) {
    days = days || 30;
    return hhEvents('long').then(function (ev) {
      var byDate = {}, byHour = new Array(24).fill(0);
      ev.forEach(function (e) {
        var key = hhFmtTs(e.t).slice(0, 10);
        var d = byDate[key];
        if (!d) d = byDate[key] = { date: key, detections: 0, _sp: {} };
        d.detections++;
        d._sp[e.sci] = 1;
        byHour[new Date(e.t).getHours()]++;
      });
      var daily = Object.keys(byDate).sort().map(function (k) {
        var d = byDate[k];
        return { date: d.date, detections: d.detections, species: Object.keys(d._sp).length };
      });
      return {
        days: days,
        daily: daily,
        by_hour: byHour.map(function (n, h) { return { hour: h, detections: n }; }),
        as_of: new Date().toISOString(),
      };
    });
  }

  function hhSpecies(sci) {
    return hhEvents('long').then(function (ev) {
      var mine = ev.filter(function (e) { return e.sci === sci; });
      var agg = hhAgg(mine, 0)[0] || {};
      var dets = mine.slice().reverse().slice(0, 100).map(function (e) {
        var ts = hhFmtTs(e.t);
        // file:'' - audio clips don't travel over MQTT; the modal's play
        // buttons no-op and the rows still show time + confidence.
        return { d: ts.slice(0, 10), t: ts.slice(11), file: '', conf: e.conf };
      });
      return {
        sci: sci,
        summary: {
          com: agg.com || null,
          total: agg.n || 0,
          first_seen: agg.first_seen || null,
          last_seen: agg.last_seen || null,
          best_conf: agg.best_conf || null,
        },
        detections: dets,
      };
    });
  }

  // ---- Static illustration resolver ----
  // The PHP cutout.php walked illustration -> photo-cutout -> Wikipedia
  // fallbacks server-side. Served statically, the <img> itself walks the
  // chain instead: start at the bundled illustration and step down on
  // each onerror. data-fb tracks the step so a missing file can't loop.
  function assetSrc(sci, pose) {
    return './assets/illustrations/' + slugify(sci) + (pose === 2 ? '-2' : '') + '.png';
  }
  window.__birdImgErr = function (img) {
    var slug = img.getAttribute('data-slug');
    var step = +(img.getAttribute('data-fb') || 0);
    img.setAttribute('data-fb', String(step + 1));
    if (!slug) { img.onerror = null; img.style.visibility = 'hidden'; return; }
    if (step === 0) {
      // Flight illustration missing -> perched illustration.
      img.src = './assets/illustrations/' + slug + '.png';
    } else if (step === 1) {
      // No illustration at all -> background-removed photo cutout.
      img.src = './assets/cutouts/' + slug + '.png';
    } else {
      // Nothing bundled for this species - hide rather than show the
      // browser's broken-image glyph. (Deliberately NOT falling back to
      // BirdNET-Go's photo proxy: photos break the kachō-e style and
      // have no silhouette masks. The pipeline in avian/scripts
      // generates style-matched art for any species instead.)
      img.onerror = null;
      img.style.visibility = 'hidden';
    }
  };
  // Attribute string for collage/atlas <img> tags built via innerHTML.
  // pose 1 starts at fallback step 1 (its first candidate IS the perched
  // illustration, so a failure should go straight to the photo cutout).
  function birdImgAttrs(sci, pose) {
    return ' data-slug="' + slugify(sci) + '" data-sci="' + esc(sci) +
      '" data-fb="' + (pose === 2 ? 0 : 1) + '" onerror="__birdImgErr(this)"';
  }
  // ======================= end BirdNET-Go adapter ==========================

  // ---- Sliding pill helper ----
  // Each segmented control has a single .seg-pill element that we move via
  // transform/width to whichever button currently has aria-current="true".
  // This gives an iOS-style smooth slide instead of a hard snap.
  function syncPill(container) {
    var pill = container.querySelector('.seg-pill');
    var active = container.querySelector('button[aria-current="true"]');
    if (!pill || !active) return;
    // offsetLeft is relative to the container (we set position:relative on it).
    pill.style.width = active.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }

  // Clicking the open space of a segmented toggle (not a specific option)
  // advances to the next available option, cycling. Clicking an option
  // still jumps straight to it - we just synthesize a click on the next
  // button so its existing handler runs.
  function wireToggleAdvance(container) {
    if (!container || container.__advanceWired) return;
    container.__advanceWired = true;
    container.addEventListener('click', function (ev) {
      if (ev.target.closest('button')) return;   // a specific option was clicked
      var btns = [].slice.call(container.querySelectorAll('button')).filter(function (b) {
        return !b.disabled && b.getAttribute('data-unavailable') !== 'true';
      });
      if (btns.length < 2) return;
      var cur = -1;
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('aria-current') === 'true') { cur = i; break; }
      }
      btns[(cur + 1) % btns.length].click();
    });
  }

  // ---- Slider ----
  var views = document.getElementById('views');
  var slider = document.getElementById('slider');
  var btns = [].slice.call(slider.querySelectorAll('button'));
  var winPick = document.getElementById('winPick');

  // Each view's title. The shared static-head shows one of these based on
  // the current view; identical adjacent values mean the title stays put
  // with no fade (collage and stats both say Heard Recently). Titles are
  // resolved through t() lazily (at view-switch time) so translations that
  // load with the app are picked up; a config `title` pins a custom string.
  var VIEW_TITLE_KEYS = ['title.heardRecently', 'title.heardRecently', 'title.avianVisitors'];
  var CUSTOM_TITLE = null;
  var staticHead = document.querySelector('.static-head');
  var staticTitle = document.getElementById('staticTitle');
  // Card builds pass a `title` key: '' hides the whole title block, a
  // non-empty value pins that custom title across every view (and hides
  // the "your birds" eyebrow - it's an About affordance, not part of a
  // user's chosen heading). Absent key (the static page) keeps the
  // original per-view titles.
  if (AV_CFG && 'title' in AV_CFG) {
    if (!AV_CFG.title) {
      if (staticHead) staticHead.style.display = 'none';
    } else {
      CUSTOM_TITLE = AV_CFG.title;
      if (staticTitle) staticTitle.textContent = AV_CFG.title;
      var __pre = staticHead && staticHead.querySelector('.pre');
      if (__pre) __pre.style.display = 'none';
      // Float the heading over the collage and let the packer treat it
      // as an obstacle - birds nest around the words like they do
      // around the clock (renderCollage measures the h1).
      document.body.classList.add('av-title-overlay');
    }
  }
  function viewTitle(i) {
    return CUSTOM_TITLE != null ? CUSTOM_TITLE : tt(VIEW_TITLE_KEYS[i]);
  }
  function setTitleForView(i) {
    var next = viewTitle(i);
    if (!staticTitle || staticTitle.textContent === next) return;
    // Fade out -> swap text -> fade in. The opacity transition is 240ms;
    // we swap at ~half that so the eye doesn't catch the text change.
    staticHead.classList.add('swap-out');
    setTimeout(function () {
      staticTitle.textContent = next;
      // Force reflow before removing class so the transition restarts.
      void staticHead.offsetWidth;
      staticHead.classList.remove('swap-out');
    }, 220);
  }

  // The views slide horizontally over SLIDE_MS (see .views transition). For
  // stats + atlas we hold the load-in hidden until the slide has essentially
  // settled, so you watch the content populate *in* the view rather than it
  // finishing mid-slide. The lead is a touch under SLIDE_MS so the cascade
  // begins just as the view arrives - no dead pause, still snappy. Collage's
  // bloom reads fine mid-slide, so it starts immediately (no lead). Stats
  // reads as starting a hair slower than atlas, so it gets a shorter lead.
  var SLIDE_MS = 480;
  var SWITCH_LEAD = SLIDE_MS - 100;   // atlas
  var STATS_LEAD = SLIDE_MS - 200;    // stats - begin a touch sooner
  var currentView = 0;                // collage shows first (no go() needed)
  function go(i) {
    i = Math.max(0, Math.min(2, i));
    // Only a genuine view *switch* replays the entrance. go() also fires when
    // a card is expanded (it sets the #sci= hash, which routes through go(2))
    // while already on the atlas - that must not retrigger the load-in.
    var switching = (i !== currentView);
    currentView = i;
    // Stats + atlas drop the shared title so their content gets the full height.
    document.body.classList.toggle('av-view-stats', i === 1);
    document.body.classList.toggle('av-view-atlas', i === 2);
    views.style.transform = 'translateX(-' + (i * 100) + '%)';
    btns.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    syncPill(slider);
    setTitleForView(i);
    if (!switching) return;
    // Replay the view's entrance animation on switch (collage bloom,
    // stats left-to-right, atlas row-by-row).
    if (i === 0) playCollageEntrance();
    else if (i === 1) playStatsEntrance(STATS_LEAD);
    else if (i === 2) playAtlasEntrance(SWITCH_LEAD);
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.i); }); });

  // ---- Window picker ----
  // Persist selections across reloads so a returning visitor lands on the
  // same view they left. Keys are namespaced so a future schema change
  // can be invalidated by bumping the prefix.
  function readLS(k, fallback) { try { return localStorage.getItem(k) || fallback; } catch (e) { return fallback; } }
  function writeLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---- Single-audio coordinator ----
  // Only one source plays at a time across the whole app: atlas-card
  // playback, modal recording playback, and the live stream each call
  // audioClaim(theirStopFn) the moment they start, which stops whatever
  // else was playing, and audioRelease(theirStopFn) when they stop on
  // their own. Keeps "start a new one -> the old one pauses" true even
  // across those three independent players.
  var __audioActiveStop = null;
  function audioClaim(stopSelf) {
    if (__audioActiveStop && __audioActiveStop !== stopSelf) {
      var prev = __audioActiveStop;
      __audioActiveStop = null;
      try { prev(); } catch (e) {}
    }
    __audioActiveStop = stopSelf;
  }
  function audioRelease(stopSelf) {
    if (__audioActiveStop === stopSelf) __audioActiveStop = null;
  }

  // ---- Theme (light / charcoal dark) ----
  // No in-app toggle: the Home Assistant card follows HA's light/dark mode
  // (the card wrapper sets data-theme on the host), and the standalone
  // page follows the OS / browser color scheme.
  function applyTheme(name) {
    if (name === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  (function followOsTheme() {
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mq && mq.matches ? 'dark' : 'light');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (e) { applyTheme(e.matches ? 'dark' : 'light'); });
    }
  })();

  // ---- Optional paper colour + texture (config-driven, opt-in) ----
  // paperColor / paperColorDark override --paper per theme; paperTexture lays a
  // faint grayscale fractal-noise grain over the ground so the collage reads
  // like a print on washi rather than flat colour. Blank colour / 0 texture
  // leaves the theme's default --paper untouched. The colour is re-applied
  // whenever data-theme flips (OS scheme on the page, HA dark mode on the card).
  function applyPaperColour() {
    var pc = (currentTheme() === 'dark') ? AV_CFG.paperColorDark : AV_CFG.paperColor;
    if (pc) document.documentElement.style.setProperty('--paper', pc);
    else document.documentElement.style.removeProperty('--paper');
  }
  applyPaperColour();
  if (window.MutationObserver) {
    new MutationObserver(applyPaperColour).observe(
      document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  (function applyPaperTexture() {
    var amt = Math.max(0, Math.min(0.3, +AV_CFG.paperTexture || 0));
    if (amt <= 0 || AV_CFG.paperBg === false) return;   // needs a paper ground
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>"
      + "<filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.9' "
      + "numOctaves='2' stitchTiles='stitch'/>"
      + "<feColorMatrix type='saturate' values='0'/></filter>"
      + "<rect width='180' height='180' filter='url(#p)' opacity='" + amt + "'/></svg>";
    document.body.style.backgroundImage =
      'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    document.body.style.backgroundRepeat = 'repeat';
  })();

  var winBtns = [].slice.call(winPick.querySelectorAll('button'));
  var currentHours = +readLS('bird:window', '24') || 24;
  // Card builds fix the time window from card config and hide the
  // segmented picker - the window is a card setting there, not an
  // on-screen control. 'all' or any hour count works.
  if (AV_CFG && AV_CFG.windowHours != null && AV_CFG.windowHours !== '') {
    currentHours = AV_CFG.windowHours === 'all'
      ? 1000000
      : Math.max(1, +AV_CFG.windowHours || 24);
    if (winPick) winPick.style.display = 'none';
  }
  // Card builds: pin the starting view, and optionally hide the
  // collage/stats/atlas selector so a card can BE a single view (one
  // dashboard can then mix a collage card, a stats card, an atlas card).
  if (AV_CFG && AV_CFG.view) {
    var __vi = { collage: 0, stats: 1, atlas: 2 }[AV_CFG.view];
    if (__vi) go(__vi);
  }
  if (AV_CFG && AV_CFG.viewSelector === false && slider) {
    slider.style.display = 'none';
    // Lets the CSS reclaim the picker's clearance (paddings, wall
    // widget insets) when there's no picker to clear.
    document.body.classList.add('av-no-picker');
  }
  if (AV_CFG && AV_CFG.selectorPosition === 'top') {
    document.body.classList.add('av-picker-top');
  }
  winBtns.forEach(function (b) {
    b.setAttribute('aria-current', (+b.dataset.h === currentHours) ? 'true' : 'false');
  });
  winBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      winBtns.forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
      currentHours = +b.dataset.h;
      writeLS('bird:window', String(currentHours));
      syncPill(winPick);
      // Actual data refresh is wired below via refreshRecent().
    });
  });

  // Initial pill placement (after layout settles) + on resize.
  // Atlas sort segmented control - same pill-on-recess pattern.
  var atlasSortEl = document.getElementById('atlasSort');
  var atlasSortBtns = atlasSortEl ? [].slice.call(atlasSortEl.querySelectorAll('button')) : [];
  window.__atlasSort = readLS('bird:atlasSort', 'count');
  atlasSortBtns.forEach(function (b) {
    b.setAttribute('aria-current', (b.dataset.sort === window.__atlasSort) ? 'true' : 'false');
  });
  atlasSortBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      atlasSortBtns.forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
      window.__atlasSort = b.dataset.sort;
      writeLS('bird:atlasSort', window.__atlasSort);
      syncPill(atlasSortEl);
      // Re-render the atlas with new sort, replaying the row-by-row
      // cascade so a filter change reads as a fresh stack load-in.
      renderAtlas(true);
    });
  });

  // Open-space click advances these segmented toggles to the next option.
  wireToggleAdvance(slider);
  wireToggleAdvance(winPick);
  wireToggleAdvance(atlasSortEl);
  wireToggleAdvance(document.getElementById('modalPoseToggle'));
  function syncAllPills() { syncPill(slider); syncPill(winPick); if (atlasSortEl) syncPill(atlasSortEl); }
  // The buttons size from text content; wait for fonts so width is correct.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncAllPills);
  }
  // Also sync after layout is definitely done.
  requestAnimationFrame(function () { requestAnimationFrame(syncAllPills); });
  var pillTimer;
  window.addEventListener('resize', function () {
    clearTimeout(pillTimer);
    pillTimer = setTimeout(syncAllPills, 80);
  });

  // ---- Raster-bitmask collage with bird-shaped nesting ----
  // Each species ships a low-res binary alpha mask (cutout_masks.ts) that
  // matches the bird's actual outline. The layout maintains an occupancy
  // grid at viewport resolution; for each tile we spiral outward from the
  // cluster centre and pick the closest position where the tile's mask
  // doesn't overlap any already-placed mask. Result: birds nest into each
  // other's concavities (wing arc cradles tail, etc.) with a small visual
  // gap baked into the mask via Python-side dilation. No bbox overlap, no
  // rectangles touching - actual polygon-aware packing.

  var collage = document.getElementById('collage');
  // DIMS and MASKS (the per-species aspect + silhouette tables) live
  // in the generated masks.js, loaded before this file - keeps this
  // source reviewable and artwork-regen diffs out of the app logic.

  // Tunables - Galliformes-poster-inspired. Raster-mask nesting.
  //
  // Layout discipline: tile areas are NORMALISED against a viewport
  // budget (sum of areas ≈ budgetFrac × vpArea) rather than each tile
  // being clamped to a per-tile maxArea. The old per-tile cap made every
  // loud bird look identical (Anna n=398, Crow n=31 and Phoebe n=26 all
  // hit ceiling and rendered the same size) AND it allowed total area to
  // overflow narrow viewports so birds got dropped off-screen.
  // Normalising fixes both - relative size tracks the relative call
  // ratio, and total area can never exceed what the iterative shrink
  // loop is willing to scale into the viewport.
  //
  // The budget FRACTION is set per render from collageFill + a count
  // offset (see renderCollage), not here.
  function tuning(n) {
    // Count -> area exponent ("size contrast"): how steeply a bird's area
    // grows with its detection count. Lower = sizes stay closer together;
    // higher = the loudest birds dominate. User-tunable via sizeContrast
    // (card slider / config.js). At 0.5 the loudest bird reads a few times
    // bigger than a quiet one without dwarfing the flock; was a fixed 0.65,
    // which made the top few birds feel oversized. At 0 the exponent is 0,
    // so every bird's score is 1 and the flock is drawn essentially uniform.
    var contrast = (typeof AV_CFG.sizeContrast === 'number') ? AV_CFG.sizeContrast : 0.5;
    contrast = Math.max(0, Math.min(0.8, contrast));
    return {
      countExp: contrast,
      // Floor: every species in the dataset must be visible, even
      // n=1. Tracks species count so a tiny rare bird stays
      // recognisable on a crowded plate.
      minTileAreaFrac: n <= 8 ? 0.0100 :
                        n <= 20 ? 0.0075 :
                                  0.0055,
      // Wider clusters for landscape viewports, more so as n grows.
      ellipseAspectBias: 2.1,
    };
  }
  var GRID_STRIDE = 4; // viewport px per occupancy cell; smaller = slower
  var COLLAGE_PAD = 3; // breathing room (grid cells) around each bird;
                       // eased on narrow screens where birds are smaller.
  // Pose is deterministic in this build: a species sits (perched pose) when
  // its best detection confidence in the current window is >= SIT_CONFIDENCE
  // (config.js, default 0.96), and flies otherwise - a clear, close bird has
  // settled in; a faint maybe is just passing through. Recomputed every
  // render, so a bird "lands" the moment a confident detection arrives.

  // Decode and cache each mask once. Sparse cell-list form (only "on"
  // cells) makes collision tests linear in opaque area, not total area.
  var maskCache = {};
  function loadMask(slug) {
    if (maskCache[slug]) return maskCache[slug];
    var rec = MASKS[slug];
    if (!rec) return null;
    var bytes = atob(rec.bits);
    var w = rec.w, h = rec.h;
    var cells = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        var b = bytes.charCodeAt(i >> 3);
        if ((b >> (7 - (i & 7))) & 1) cells.push([x, y]);
      }
    }
    return (maskCache[slug] = { w: w, h: h, cells: cells });
  }

  function slugify(sci) {
    return sci.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function aspect(sci) {
    var d = DIMS[slugify(sci)];
    return d ? d[0] / d[1] : 1.4;
  }

  // Mask-aware nester. tiles: { fullW, fullH, mask, data }. Returns the
  // same tiles with .x, .y assigned (top-left in viewport coords).
  // `obstacles` ([{x,y,w,h}] in the same coords) are stamped into the
  // occupancy grid before any bird is placed, so the flock packs around
  // them exactly as it packs around another bird - used for the wall
  // clock/weather block and the card's configured title.
  function maskPack(tiles, W, H, xBias, yBias, pad, obstacles, ringMode) {
    var GW = Math.ceil(W / GRID_STRIDE) + 2;
    var GH = Math.ceil(H / GRID_STRIDE) + 2;
    var grid = new Uint8Array(GW * GH);
    (obstacles || []).forEach(function (ob) {
      var ox0 = Math.max(0, ob.x / GRID_STRIDE | 0);
      var oy0 = Math.max(0, ob.y / GRID_STRIDE | 0);
      var ox1 = Math.min(GW - 1, (ob.x + ob.w) / GRID_STRIDE | 0);
      var oy1 = Math.min(GH - 1, (ob.y + ob.h) / GRID_STRIDE | 0);
      // An `ellipse` obstacle (the ring-mode centre keep-out) blocks only
      // the cells inside the oval, so the flock packs into a rounded halo
      // instead of around a hard-edged box. Everything else is a rectangle.
      if (ob.ellipse) {
        var ecx = (ob.x + ob.w / 2) / GRID_STRIDE;
        var ecy = (ob.y + ob.h / 2) / GRID_STRIDE;
        var erx = (ob.w / 2) / GRID_STRIDE || 1;
        var ery = (ob.h / 2) / GRID_STRIDE || 1;
        for (var egy = oy0; egy <= oy1; egy++) {
          var eoff = egy * GW;
          var ndy = (egy - ecy) / ery;
          for (var egx = ox0; egx <= ox1; egx++) {
            var ndx = (egx - ecx) / erx;
            if (ndx * ndx + ndy * ndy <= 1) grid[eoff + egx] = 1;
          }
        }
        return;
      }
      for (var ogy = oy0; ogy <= oy1; ogy++) {
        var ooff = ogy * GW;
        for (var ogx = ox0; ogx <= ox1; ogx++) grid[ooff + ogx] = 1;
      }
    });

    function tileXf(tile, tx, ty) {
      // Flow rotation for `tile` centred at this candidate position, IDENTICAL
      // to the CSS transform render applies (scaleX(flip) then rotate). null =
      // upright. With it, collision/stamp pack the ROTATED silhouette, so a
      // rotated bird can never overlap a neighbour.
      if (!tile.flow) return null;
      var ccx = tx + tile.fullW / 2, ccy = ty + tile.fullH / 2;
      var phi = Math.atan2(ccy - cy, ccx - cx) * 180 / Math.PI;
      var tau = phi + tile.flow.dir * 90;
      var rightish = Math.cos(tile.headingDeg * Math.PI / 180) >= 0;
      var flip = (tile.flow.dir === 1) ? !rightish : rightish;
      var deg = flip ? (tau - 180 + tile.headingDeg) : (tau - tile.headingDeg);
      deg = ((((deg % 360) + 540) % 360) - 180) * tile.flow.strength;
      var rad = deg * Math.PI / 180;
      return { cos: Math.cos(rad), sin: Math.sin(rad), fx: flip ? -1 : 1, ox: ccx, oy: ccy };
    }
    function cellRange(tile, tx, ty, c, xf) {
      // Grid range [gx0, gy0, gx1, gy1] (inclusive, clamped) the mask cell
      // occupies. When `xf` is set the cell's footprint is rotated about the
      // tile centre first (conservative: bounds the rotated quad).
      var sx = tile.fullW / tile.mask.w;
      var sy = tile.fullH / tile.mask.h;
      var x0, y0, x1, y1;
      if (!xf) {
        x0 = (tx + c[0] * sx) / GRID_STRIDE | 0;
        y0 = (ty + c[1] * sy) / GRID_STRIDE | 0;
        x1 = (tx + (c[0] + 1) * sx) / GRID_STRIDE | 0;
        y1 = (ty + (c[1] + 1) * sy) / GRID_STRIDE | 0;
      } else {
        var hw = tile.fullW / 2, hh = tile.fullH / 2;
        var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
        for (var k = 0; k < 4; k++) {
          var lx = ((c[0] + (k & 1)) * sx - hw) * xf.fx;
          var ly = (c[1] + (k >> 1)) * sy - hh;
          var px = xf.ox + lx * xf.cos - ly * xf.sin;
          var py = xf.oy + lx * xf.sin + ly * xf.cos;
          if (px < minx) minx = px; if (px > maxx) maxx = px;
          if (py < miny) miny = py; if (py > maxy) maxy = py;
        }
        x0 = minx / GRID_STRIDE | 0; y0 = miny / GRID_STRIDE | 0;
        x1 = maxx / GRID_STRIDE | 0; y1 = maxy / GRID_STRIDE | 0;
      }
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
      if (x1 >= GW) x1 = GW - 1; if (y1 >= GH) y1 = GH - 1;
      return [x0, y0, x1, y1];
    }
    function collides(tile, tx, ty) {
      var xf = tileXf(tile, tx, ty);
      var cells = tile.mask.cells;
      for (var i = 0; i < cells.length; i++) {
        var r = cellRange(tile, tx, ty, cells[i], xf);
        for (var gy = r[1]; gy <= r[3]; gy++) {
          var off = gy * GW;
          for (var gx = r[0]; gx <= r[2]; gx++) {
            if (grid[off + gx]) return true;
          }
        }
      }
      return false;
    }
    function stamp(tile, tx, ty) {
      var xf = tileXf(tile, tx, ty);
      var cells = tile.mask.cells;
      for (var i = 0; i < cells.length; i++) {
        var r = cellRange(tile, tx, ty, cells[i], xf);
        // Dilate the stamped footprint by `pad` cells so the next bird can't
        // pack right up against this one - a uniform gap around every
        // silhouette. collides() stays unpadded, so the gap is added once.
        var gy0 = r[1] - pad, gy1 = r[3] + pad;
        var gx0 = r[0] - pad, gx1 = r[2] + pad;
        if (gy0 < 0) gy0 = 0; if (gx0 < 0) gx0 = 0;
        if (gy1 >= GH) gy1 = GH - 1; if (gx1 >= GW) gx1 = GW - 1;
        for (var gy = gy0; gy <= gy1; gy++) {
          var off = gy * GW;
          for (var gx = gx0; gx <= gx1; gx++) grid[off + gx] = 1;
        }
      }
    }
    function offGrid(tile, tx, ty) {
      // True if the rendered tile bbox extends past the viewport.
      return tx < 0 || ty < 0 || tx + tile.fullW > W || ty + tile.fullH > H;
    }

    var cx = W / 2, cy = H / 2;
    // Largest first so the cluster grows around the anchor.
    tiles.sort(function (a, b) { return (b.fullW * b.fullH) - (a.fullW * a.fullH); });
    var placed = [];
    // Seeded PRNG keeps the layout stable across resizes.
    var seed = 0x9E3779B9;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var tx, ty;
      // Anchor bird goes dead-centre - unless an obstacle (the wall
      // clock or title on a small screen) reaches that far, in which
      // case it falls through to the spiral search like everyone else.
      // Ring mode never centres the anchor: the open middle is the point.
      if (i === 0 && !ringMode && !(obstacles && obstacles.length && collides(t, cx - t.fullW / 2, cy - t.fullH / 2))) {
        tx = cx - t.fullW / 2;
        ty = cy - t.fullH / 2;
        t.x = tx; t.y = ty;
        stamp(t, tx, ty);
        placed.push(t);
        continue;
      }
      var best = null;
      if (ringMode) {
        // RING: fill the whole frame around an open centre. The cluster
        // spiral below grows one compact blob (so a hole in it just reads
        // as "blob with a hole"); ring mode instead scatters birds across
        // the ENTIRE viewport with blue-noise spacing - sample many
        // positions, keep the one farthest from its nearest neighbour.
        // That reaches the corners and edges, so the flock reads as a
        // rectangle of birds; the centre keep-out (stamped already) holds
        // the void. Largest birds (placed first) stake out the open frame,
        // smaller ones fill the gaps in toward the rim - the look from the
        // original poster.
        var bestScore = -Infinity;
        var rangeX = Math.max(0, W - t.fullW), rangeY = Math.max(0, H - t.fullH);
        for (var s = 0; s < 96; s++) {
          var sx = rand() * rangeX, sy = rand() * rangeY;
          if (collides(t, sx, sy)) continue;
          var scx = sx + t.fullW / 2, scy = sy + t.fullH / 2;
          var nd = Infinity;
          for (var pi = 0; pi < placed.length; pi++) {
            var pp = placed[pi];
            if (pp.x < -1000) continue;       // skip the unplaced
            var d = Math.hypot(scx - (pp.x + pp.fullW / 2), scy - (pp.y + pp.fullH / 2));
            if (d < nd) nd = d;
          }
          if (nd > bestScore) { bestScore = nd; best = { x: sx, y: sy }; }
        }
      } else {
        // CLUSTER: spiral outward, stopping at the first ring with any
        // non-colliding spot (the tightest distance from centre). Within
        // that ring, pick the position closest to the centre of mass of
        // placed tiles, so the blob grows organically, not directionally.
        var comX = 0, comY = 0, comW = 0;
        placed.forEach(function (p) {
          var a = p.fullW * p.fullH;
          comX += (p.x + p.fullW / 2) * a;
          comY += (p.y + p.fullH / 2) * a;
          comW += a;
        });
        if (comW > 0) { comX /= comW; comY /= comW; }
        else { comX = cx; comY = cy; }       // nothing placed yet: grow from centre

        var bestCost = Infinity;
        var step = Math.max(GRID_STRIDE, Math.min(t.fullW, t.fullH) * 0.05);
        var maxR = Math.max(W, H);
        var foundRing = -1;
        var phase = rand() * Math.PI * 2;
        for (var r = 0; r <= maxR; r += step) {
          if (foundRing >= 0 && r > foundRing + step * 2) break;
          var samples = Math.max(36, Math.floor(r / 1.6));
          for (var k = 0; k < samples; k++) {
            var theta = phase + (k / samples) * Math.PI * 2;
            // Elliptical ring - stretched per axis: xBias>yBias gives a wide
            // (landscape) cluster, yBias>xBias a tall (portrait) one.
            var px = cx + r * xBias * Math.cos(theta) - t.fullW / 2;
            var py = cy + r * yBias * Math.sin(theta) - t.fullH / 2;
            if (offGrid(t, px, py)) continue;
            if (collides(t, px, py)) continue;
            // Distance to existing cluster centre of mass + small noise.
            var dxx = (px + t.fullW / 2 - comX);
            var dyy = (py + t.fullH / 2 - comY);
            var cost = Math.hypot(dxx / xBias, dyy / yBias) + rand() * step * 0.5;
            if (cost < bestCost) { bestCost = cost; best = { x: px, y: py }; }
          }
          if (best && foundRing < 0) foundRing = r;
        }
      }
      if (best) {
        t.x = best.x; t.y = best.y;
        stamp(t, best.x, best.y);
        placed.push(t);
      } else {
        // Couldn't fit anywhere - hide off-screen rather than overlap.
        t.x = -99999; t.y = -99999;
        placed.push(t);
      }
    }
    return placed;
  }

  var _collageSig = null;
  function renderCollage(items, animate) {
    if (!items.length) {
      collage.innerHTML = '';   // blank, rather than an empty-state message
      collagePlaced = [];
      _collageSig = 'empty';
      return;
    }
    var W = collage.clientWidth, H = collage.clientHeight;
    if (!W || !H) { setTimeout(function () { renderCollage(items, animate); }, 80); return; }

    // Obstacles the flock packs around: the wall clock/weather block and
    // (card builds) a configured title floated over the collage. Each box
    // gets a little air so birds don't kiss the letterforms.
    var obstacles = [];
    function addObstacle(el) {
      if (!el) return;
      var b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      var cb = collage.getBoundingClientRect();
      var M = 12;
      obstacles.push({ x: b.left - cb.left - M, y: b.top - cb.top - M,
                       w: b.width + 2 * M, h: b.height + 2 * M });
    }
    var wwEl = document.getElementById('wallWidgets');
    if (wwEl && !wwEl.hidden) addObstacle(wwEl);
    if (document.body.classList.contains('av-title-overlay') && staticTitle) addObstacle(staticTitle);
    // The view picker too: the collage view keeps no reserved band for
    // it (the box is the whole card, so the flock centres truly), and
    // birds simply pack around the pill.
    var slEl = document.getElementById('slider');
    if (slEl && slEl.style.display !== 'none') addObstacle(slEl);

    // Collage shape: 'ring' opens the centre into a halo of birds in
    // flight, 'cluster' (default) packs one solid blob. The open centre
    // is just an elliptical obstacle stamped dead-middle, so the same
    // nesting + shrink-to-fit that flows birds around the wall clock
    // forms the ring - and maskPack skips its centre anchor so nothing
    // fills the hole. Pushed here (not at pack time) so it lands in the
    // obstacle set the render signature is built from, and a live shape
    // change repacks. Static-page displays can override per-URL
    // (?ring / ?shape=cluster / ?hole=0.5); the card feeds its own config.
    var shape = AV_CFG.collageShape;
    var holeFrac = (typeof AV_CFG.collageHole === 'number') ? AV_CFG.collageHole : 0.5;
    if (window.AV_CONFIG) {
      if (/[?&]ring(=|&|$)/.test(location.search)) shape = 'ring';
      var mShape = location.search.match(/[?&]shape=([\w-]+)/);
      if (mShape) shape = mShape[1];
      var mHole = location.search.match(/[?&]hole=([\d.]+)/);
      if (mHole) holeFrac = parseFloat(mHole[1]);
    }
    var ringMode = shape === 'ring';
    // Flow: in ring mode, rotate in-flight birds so they fly along the ring's
    // tangent (a wheeling flock). 'cw'/'ccw' pick the direction; flowStrength
    // 0..1 scales from upright to fully tangential. Needs a per-illustration
    // heading DIRS[slug] (degrees, 0=right, 90=down). Static page can override
    // per-URL: ?flow=ccw&strength=1.
    var flow = AV_CFG.collageFlow || 'off';
    var flowStrength = (typeof AV_CFG.collageFlowStrength === 'number') ? AV_CFG.collageFlowStrength : 1;
    if (window.AV_CONFIG) {
      var mFlow = location.search.match(/[?&]flow=(cw|ccw|off)/);
      if (mFlow) flow = mFlow[1];
      var mFs = location.search.match(/[?&]strength=([\d.]+)/);
      if (mFs) flowStrength = parseFloat(mFs[1]);
    }
    flowStrength = Math.max(0, Math.min(1, flowStrength));
    var flowOn = ringMode && (flow === 'cw' || flow === 'ccw');
    var DIRTAB = (window.__DIRS) || (typeof DIRS !== 'undefined' ? DIRS : {});
    if (ringMode) {
      holeFrac = Math.max(0.1, Math.min(0.7, holeFrac));
      // A roundish void, sized off the SHORTER axis (so it stays an open
      // centre, not a slot) and stretched a touch wider for the landscape
      // look of the poster. Birds scatter to fill the frame around it.
      var holeR = Math.min(W, H) * 0.5 * holeFrac;
      var holeRx = holeR * 1.3;
      var holeRy = holeR;
      obstacles.push({ x: W / 2 - holeRx, y: H / 2 - holeRy,
                       w: holeRx * 2, h: holeRy * 2, ellipse: true });
    }

    // The silent poll mostly returns identical data - skip the whole
    // pack/render when nothing that affects layout changed, so the DOM
    // is left completely untouched (no flicker, no work).
    var sig = W + 'x' + H + '|' + JSON.stringify(obstacles) + '|' +
      items.map(function (s) {
        var c0 = +s.best_conf || 0;
        return s.sci + ':' + (+s.n || 0) + ':' + ((c0 === 0 || c0 >= SIT_CONFIDENCE) ? 'p' : 'f');
      }).join(',');
    if (!animate && sig === _collageSig) return;
    _collageSig = sig;

    // Tuning depends on bird count - same viewport, very different
    // pack densities for 6 vs 48 birds.
    var T = tuning(items.length);
    var vpArea = W * H;
    // Collage fill: how much of the box the flock targets, as a fraction
    // of viewport area. `collageFill` (0.1-1.0, default 0.5) is the
    // user-facing control - the HA card exposes it as a slider, the
    // static page sets it in config.js. A count offset nudges it so a
    // BUSIER plate spreads a little wider and a sparse one pulls in
    // (more birds -> bigger footprint); at the 0.5 default that's
    // 0.45 / 0.50 / 0.55 by count. Birds always shrink to fit (the loop
    // below), so values near 1.0 just fill the box.
    var nBirds = items.length;
    var fill = (typeof AV_CFG.collageFill === 'number') ? AV_CFG.collageFill : 0.5;
    fill = Math.max(0.1, Math.min(1.0, fill));
    // Busier plates get a bigger area budget AND a tighter gap (pad, below),
    // so a large flock packs closer and each bird stays a bit larger instead
    // of shrinking to specks.
    var countOffset = nBirds <= 12 ? -0.05 : nBirds <= 24 ? 0 :
                      nBirds <= 48 ? 0.08 : nBirds <= 90 ? 0.18 : 0.28;
    var budgetFrac = Math.max(0.04, Math.min(1.2, fill + countOffset));
    var budget  = vpArea * budgetFrac;
    var minArea = vpArea * T.minTileAreaFrac;

    // Step 1: build tiles + assign each a count-weighted SCORE (not a
    // final area yet). area-from-count uses a sub-linear exponent so
    // a 400-detection bird is visibly larger than a 30-detection bird
    // without dwarfing it.
    var tiles = items.map(function (s) {
      var base = slugify(s.sci);
      // Pose: sitting when the window's best confidence clears the
      // SIT_CONFIDENCE bar, flying otherwise - and flight only if a flight
      // render exists. Flight uses the <slug>-2 mask/aspect/image so the
      // wings-spread silhouette nests correctly.
      // Flight needs a KNOWN low confidence: older BirdNET-Go builds omit
      // max_confidence from some analytics responses, and an unknown
      // (0) confidence must not read as "uncertain bird" - perch it.
      var __conf = +s.best_conf || 0;
      var pose = (DIMS[base + '-2'] && __conf > 0 && __conf < SIT_CONFIDENCE) ? 2 : 1;
      // Flow wants a coherent wheel of fliers: force the flight pose for any
      // species that has one (all bundled species do).
      if (flowOn && DIMS[base + '-2']) pose = 2;
      var slug = pose === 2 ? base + '-2' : base;
      var mask = loadMask(slug);
      if (!mask && pose === 2) { pose = 1; slug = base; mask = loadMask(slug); }
      if (!mask) return null;
      var d = DIMS[slug];
      var n = +s.n; if (!n || isNaN(n)) n = 1;
      var headDeg = DIRTAB[slug];
      return {
        mask: mask, data: s, pose: pose,
        ar: d ? d[0] / d[1] : 1.4,
        score: Math.pow(Math.max(1, n), T.countExp),
        // Flow heading for THIS tile so the packer can pack the ROTATED
        // silhouette (maskPack/tileXf), not the upright one - otherwise a
        // rotated bird's wings sweep into a neighbour the collision never saw.
        headingDeg: (typeof headDeg === 'number') ? headDeg : null,
        flow: (flowOn && pose === 2 && typeof headDeg === 'number')
          ? { dir: (flow === 'ccw') ? -1 : 1, strength: flowStrength } : null,
      };
    }).filter(Boolean);

    // Step 2: normalise so sum(area) ≈ budget. Then floor each tile
    // at minArea so even a 1-call bird stays legible.
    var sumScore = tiles.reduce(function (a, t) { return a + t.score; }, 0) || 1;
    tiles.forEach(function (t) {
      t.area = Math.max(minArea, budget * t.score / sumScore);
    });
    // After flooring, total may exceed budget; squeeze the over-budget
    // remainder out of the LARGER tiles (the ones above minArea) so
    // the floor on rare birds stays intact.
    var sumA = tiles.reduce(function (a, t) { return a + t.area; }, 0);
    if (sumA > budget) {
      var fixedSum = tiles.filter(function (t) { return t.area <= minArea + 1e-9; })
        .reduce(function (a, t) { return a + t.area; }, 0);
      var flexSum  = sumA - fixedSum;
      var flexBudget = Math.max(0, budget - fixedSum);
      var shrink = flexSum > 0 ? Math.min(1, flexBudget / flexSum) : 1;
      tiles.forEach(function (t) {
        if (t.area > minArea + 1e-9) t.area *= shrink;
      });
    }
    // Step 3: derive width/height from area + per-species aspect.
    tiles.forEach(function (t) {
      t.fullW = Math.sqrt(t.area * t.ar);
      t.fullH = t.fullW / t.ar;
    });

    // Width-responsive: wide screens get a horizontal ellipse at full padding;
    // narrow/portrait screens a vertical ellipse with slightly tighter padding.
    var narrow = W <= 700;
    var xBias = narrow ? 1 : T.ellipseAspectBias;
    var yBias = narrow ? 1.7 : 1;   // gentler than the desktop bias so the
                                    // portrait cluster stays a bit wider / less tall
    // Spacing: user-tunable gap around each bird. Collision never lets birds
    // overlap regardless; this only sets how much air sits between them - lower
    // packs them closer (bigger, denser), higher gives more breathing room.
    // collageSpacing 0-1 (0.5 = the default gap); ?spacing= overrides on the
    // static page.
    var spacing = (typeof AV_CFG.collageSpacing === 'number') ? AV_CFG.collageSpacing : 0;
    if (window.AV_CONFIG) {
      var mSp = location.search.match(/[?&]spacing=([\d.]+)/);
      if (mSp) spacing = parseFloat(mSp[1]);
    }
    spacing = Math.max(0, Math.min(1, spacing));
    var basePad = Math.max(1, Math.round(spacing * 2 * COLLAGE_PAD));  // 0->1 tight, 0.5->3 default, 1->6 airy
    var pad = narrow ? Math.max(1, basePad - 1) : basePad;
    var placed = maskPack(tiles, W, H, xBias, yBias, pad, obstacles, ringMode);

    // Scale-to-fit: iterate shrink + repack until every tile lands on
    // screen. The old single-pass version dropped birds when one pass
    // wasn't enough (narrow viewports + many species). Capped at 10
    // iterations - by then the linear scale is ~0.5 of original, more
    // than enough headroom for any viewport.
    function clusterBounds(arr) {
      var L = Infinity, R = -Infinity, T2 = Infinity, B = -Infinity;
      arr.forEach(function (t) {
        if (t.x < -1000) return;
        if (t.x < L) L = t.x;
        if (t.x + t.fullW > R) R = t.x + t.fullW;
        if (t.y < T2) T2 = t.y;
        if (t.y + t.fullH > B) B = t.y + t.fullH;
      });
      return { L: L, R: R, T: T2, B: B };
    }
    var b = clusterBounds(placed);
    for (var iter = 0; iter < 10; iter++) {
      var missing  = placed.some(function (t) { return t.x < -1000; });
      var overflow = b.L < 0 || b.T < 0 || b.R > W || b.B > H;
      if (!missing && !overflow) break;
      // Base 0.93 linear shrink (≈ 0.86 area). If overflow, take the
      // tighter of cluster-to-viewport ratios so we converge fast.
      var scale = 0.93;
      if (overflow) {
        var clW = b.R - b.L, clH = b.B - b.T;
        var sx = (W * 0.96) / Math.max(clW, W * 0.96);
        var sy = (H * 0.94) / Math.max(clH, H * 0.94);
        scale = Math.min(scale, sx, sy);
      }
      tiles.forEach(function (t) { t.fullW *= scale; t.fullH *= scale; });
      placed = maskPack(tiles, W, H, xBias, yBias, pad, obstacles, ringMode);
      b = clusterBounds(placed);
    }

    // Re-centre the cluster in the FULL box so it doesn't drift to one
    // side from the spiral's center-of-mass bias. With obstacles (clock /
    // title) stamped, the shift is validated first - tried at full size,
    // then backed off by halves - and only applied when no bird's box
    // would land on an obstacle. So the flock centres in the whole card
    // and simply declines the shift in layouts where it can't.
    var dx = W / 2 - (b.L + b.R) / 2;
    var dy = H / 2 - (b.T + b.B) / 2;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      var shiftHits = function (sx, sy) {
        for (var oi = 0; oi < obstacles.length; oi++) {
          var ob = obstacles[oi];
          for (var ti = 0; ti < placed.length; ti++) {
            var t = placed[ti];
            if (t.x < -1000) continue;
            if (t.x + sx < ob.x + ob.w && t.x + sx + t.fullW > ob.x &&
                t.y + sy < ob.y + ob.h && t.y + sy + t.fullH > ob.y) return true;
          }
        }
        return false;
      };
      var scale = 1;
      while (scale > 0.12 && shiftHits(dx * scale, dy * scale)) scale /= 2;
      if (scale > 0.12) {
        placed.forEach(function (t) {
          if (t.x > -1000) { t.x += dx * scale; t.y += dy * scale; }
        });
      }
    }

    // ---- Incremental DOM reconciliation ----
    // Tiles are keyed by species and REUSED across renders, so a poll
    // never tears the DOM down: an unchanged bird's styles are set to
    // identical values (a browser no-op - zero repaint), a moved or
    // resized bird glides on the .gtile CSS transition, a departed bird
    // fades out, and a new arrival blooms in on its own.
    var emptyMsg = collage.querySelector('.empty');
    if (emptyMsg) collage.removeChild(emptyMsg);
    var existing = {};
    [].slice.call(collage.querySelectorAll('.gtile')).forEach(function (el) {
      if (el.classList.contains('leaving')) {
        // A previous exit still mid-fade: finish it instantly so a
        // returning species gets a fresh entrance.
        if (el.parentNode) el.parentNode.removeChild(el);
        return;
      }
      existing[el.getAttribute('data-sci')] = el;
    });
    var hadTiles = Object.keys(existing).length > 0;
    var used = {};
    placed.forEach(function (r) {
      var s = r.data;
      var btn = existing[s.sci];
      var fresh = !btn;
      if (fresh) {
        btn = document.createElement('button');
        btn.className = 'gtile';
        btn.type = 'button';
        btn.setAttribute('data-sci', s.sci);
        btn.innerHTML = '<img loading="lazy" decoding="async" alt="">';
      }
      used[s.sci] = 1;
      btn.setAttribute('aria-label', s.com);
      // Fallback for keyboard / screen-reader users - the visible hover
      // pill below is the primary affordance for sighted mouse users.
      // "calls" (not "heard") because one bird can rack up dozens of
      // detections in a session; "heard" implies distinct individuals.
      var titleN = +s.n || 0;
      btn.title = (s.com || s.sci) + ' · ' + fmtN(titleN) + ' ' +
        (titleN === 1 ? tt('unit.call') : tt('unit.calls')) + ' ' + windowLabel(currentHours);
      btn.style.left   = r.x + 'px';
      btn.style.top    = r.y + 'px';
      btn.style.width  = r.fullW + 'px';
      btn.style.height = r.fullH + 'px';
      // Static bundled illustration; __birdImgErr walks the fallback
      // chain (flight -> perched -> photo cutout) if a file is missing.
      // Only touched when it actually changes (pose flip / new bird) -
      // re-assigning an identical src can restart the load in some
      // browsers, which is exactly the flash this avoids.
      var imgEl = btn.querySelector('img');
      var src = assetSrc(s.sci, r.pose) + '?v=' + IMG_VERSION;
      if (imgEl.getAttribute('src') !== src) {
        imgEl.setAttribute('alt', s.com);
        imgEl.setAttribute('data-slug', slugify(s.sci));
        imgEl.setAttribute('data-sci', s.sci);
        imgEl.setAttribute('data-fb', r.pose === 2 ? '0' : '1');
        imgEl.style.visibility = '';
        imgEl.onerror = function () { window.__birdImgErr(imgEl); };
        imgEl.setAttribute('src', src);
      }
      // Ring flow: rotate the IMG only (never the tile - the tile box stays
      // axis-aligned, so silhouette packing, alpha-mask hit-testing and the
      // tooltip are all untouched). Bank each bird INTO the ring: nose along
      // the tangent, BELLY toward the centre (the inside of the turn). The art
      // is drawn dorsal-up, so the belly sits 90deg clockwise of the nose for a
      // right-facing bird and ccw for a left-facing one; we mirror (flip) the
      // birds whose belly would otherwise face outward. Far-side birds roll
      // fully over - that's the wheel. Applied every render pass.
      var head = DIRTAB[slugify(s.sci) + (r.pose === 2 ? '-2' : '')];
      if (flowOn && r.pose === 2 && typeof head === 'number') {
        var phi = Math.atan2(r.y + r.fullH / 2 - H / 2, r.x + r.fullW / 2 - W / 2) * 180 / Math.PI;
        var dir = (flow === 'ccw') ? -1 : 1;
        var tau = phi + dir * 90;                          // nose rides the tangent
        var rightish = Math.cos(head * Math.PI / 180) >= 0;
        var flip = (dir === 1) ? !rightish : rightish;     // mirror if belly would face outward
        var rot = flip ? (tau - 180 + head) : (tau - head);
        rot = ((((rot % 360) + 540) % 360) - 180) * flowStrength;
        imgEl.style.transformOrigin = '50% 50%';
        imgEl.style.transform = 'rotate(' + rot.toFixed(1) + 'deg)' + (flip ? ' scaleX(-1)' : '');
      } else if (imgEl.style.transform) {
        imgEl.style.transform = '';
      }
      if (fresh) {
        collage.appendChild(btn);
        // A mid-session arrival blooms in by itself; the full staggered
        // entrance (first load / window change / view switch) is handled
        // by playCollageEntrance below instead.
        if (!animate && hadTiles) {
          btn.style.animationDelay = '0ms';
          btn.classList.add('entering');
          setTimeout(function () {
            btn.classList.remove('entering');
            btn.style.animationDelay = '';
          }, 700);
        }
      }
      r.el = btn;
    });
    // Departures fade + shrink away, then leave the DOM.
    Object.keys(existing).forEach(function (sci) {
      if (used[sci]) return;
      var el = existing[sci];
      el.classList.add('leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 560);
    });
    // Hover pill - one persistent node; mousemove populates its text
    // from hit.data so the count is whatever the current window says.
    var tip = collage.querySelector('.collage-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'collageTip';
      tip.className = 'collage-tip';
      tip.setAttribute('aria-hidden', 'true');
      collage.appendChild(tip);
    }
    // Stash the placed tiles so the alpha-mask hit-tester (below) can
    // resolve which silhouette the cursor is actually over.
    collagePlaced = placed.filter(function (t) { return t.x > -1000; });

    // Bloom the birds in from the centre outward, but only when asked
    // (first load, window change, view switch) - never on the silent 30s
    // poll or a resize, which render without the animate flag.
    if (animate) playCollageEntrance();
  }

  // Staggered centre-out entrance: each tile fades + scales in, delayed by
  // its distance from the collage centre, so the flock blooms from the
  // middle out. Re-applied with a reflow reset so it can replay on demand
  // (e.g. switching back to the collage view).
  var collageEntranceT = null;
  function playCollageEntrance() {
    var tiles = [].slice.call(collage.querySelectorAll('.gtile'));
    if (!tiles.length) return;
    var cx = collage.clientWidth / 2, cy = collage.clientHeight / 2;
    var maxD = 1;
    var info = tiles.map(function (t) {
      var d = Math.hypot((t.offsetLeft + t.offsetWidth / 2) - cx,
                         (t.offsetTop + t.offsetHeight / 2) - cy);
      if (d > maxD) maxD = d;
      return { el: t, d: d };
    });
    var SPREAD = 520;   // ms from the centre bird to the outermost
    info.forEach(function (o) {
      o.el.classList.remove('entering');
      o.el.style.animationDelay = ((o.d / maxD) * SPREAD).toFixed(0) + 'ms';
    });
    void collage.offsetWidth;   // commit the reset so the animation replays
    info.forEach(function (o) { o.el.classList.add('entering'); });
    // Safety net: the keyframe starts the tiles hidden (backwards fill), so
    // if the animation never advances (a backgrounded/throttled tab where
    // CSS animation time is frozen), strip the class after the bloom's
    // worst-case duration so the birds always end visible. A no-op when the
    // animation ran normally - it's already at the base (visible) state.
    clearTimeout(collageEntranceT);
    collageEntranceT = setTimeout(function () {
      info.forEach(function (o) { o.el.classList.remove('entering'); o.el.style.animationDelay = ''; });
    }, SPREAD + 520);
  }

  // Atlas entrance: cards rise + fade in row by row, top to bottom. Cards
  // sharing an offsetTop are one row, so they appear together; each row
  // down adds a small delay (capped so a long lifelist doesn't crawl).
  var atlasEntranceT = null;
  // lead: ms to hold every card hidden before the cascade starts. On a view
  // switch this is set to ~the view-slide duration so the row-by-row load-in
  // begins as the view settles (not while it's still sliding in). The cards'
  // `backwards` fill keeps them hidden during the lead, so there's no flash.
  // In-place re-renders (sort change) pass no lead - they fire immediately.
  function playAtlasEntrance(lead) {
    lead = lead || 0;
    var grid = document.getElementById('atlasGrid');
    if (!grid) return;
    var cards = [].slice.call(grid.querySelectorAll('.bird-card'));
    if (!cards.length) return;
    var uniqTops = cards.map(function (c) { return c.offsetTop; })
      .sort(function (a, b) { return a - b; })
      .filter(function (v, i, a) { return i === 0 || v !== a[i - 1]; });
    var rowOf = {}; uniqTops.forEach(function (t, i) { rowOf[t] = i; });
    // Each row trails the one above by PER_ROW ms. At 90ms against the 480ms
    // card animation the rows clearly cascade top-to-bottom (a row starts when
    // the one above is ~1/5 in) instead of reading as one simultaneous fade.
    // MAX_ROW caps the stagger so a long lifelist's off-screen rows don't crawl.
    var PER_ROW = 90, MAX_ROW = 10;
    cards.forEach(function (c) {
      c.classList.remove('entering');
      c.style.animationDelay = (lead + Math.min(rowOf[c.offsetTop] || 0, MAX_ROW) * PER_ROW) + 'ms';
    });
    void grid.offsetWidth;
    cards.forEach(function (c) { c.classList.add('entering'); });
    clearTimeout(atlasEntranceT);
    atlasEntranceT = setTimeout(function () {
      cards.forEach(function (c) { c.classList.remove('entering'); c.style.animationDelay = ''; });
    }, lead + MAX_ROW * PER_ROW + 540);
  }

  // Stats entrance: heatmap rows fade in top -> bottom, with the side
  // panel fading in just behind. Opacity only.
  var statsEntranceT = null;
  // lead: see playAtlasEntrance. On a view switch the whole graph is held
  // hidden until the slide settles, then populates top-to-bottom; in-place
  // re-renders (window-picker change) pass no lead and animate immediately.
  function playStatsEntrance(lead) {
    lead = lead || 0;
    var plot = document.querySelector('.stats-hm');
    if (!plot) return;
    var SPREAD = 460;
    // The heatmap populates top-to-bottom: the hour header leads (delay
    // 0), then the species rows stagger down the list. animationDelay
    // carries the per-element offset.
    var items = [];
    var hmRows = [].slice.call(plot.querySelectorAll('.stats-hm-head, .stats-hm-row'));
    hmRows.forEach(function (el, i) {
      items.push({ el: el, d: (i / Math.max(1, hmRows.length - 1)) * SPREAD });
    });
    // Side panel loads in tandem: section headers + captions lead, then
    // their rows populate top-to-bottom over the same window as the graph.
    var side = document.querySelector('.stats-side');
    if (side) {
      [].slice.call(side.querySelectorAll('h3, small')).forEach(function (el) { items.push({ el: el, d: 40 }); });
      var rows = [].slice.call(side.querySelectorAll('li'));
      rows.forEach(function (el, i) { items.push({ el: el, d: 80 + (i / Math.max(1, rows.length - 1)) * SPREAD }); });
    }
    items.forEach(function (o) { o.el.classList.remove('entering'); o.el.style.animationDelay = Math.round(lead + o.d) + 'ms'; });
    void plot.offsetWidth;
    items.forEach(function (o) { o.el.classList.add('entering'); });
    clearTimeout(statsEntranceT);
    statsEntranceT = setTimeout(function () {
      items.forEach(function (o) { o.el.classList.remove('entering'); o.el.style.animationDelay = ''; });
    }, lead + SPREAD + 560);
  }

  // ---- Alpha-mask hover/click hit-testing ----
  // The .gtile buttons are rectangles and their bounding boxes overlap
  // (tight nesting). A plain :hover would light up whichever rectangle
  // is on top - often not the bird under the cursor. So we hit-test
  // the cursor against each tile's binary alpha mask and only the
  // genuinely-hit silhouette gets .is-hover / receives the click.
  var collagePlaced = [];
  var collageHovered = null;
  function maskHitTest(clientX, clientY) {
    var box = collage.getBoundingClientRect();
    var px = clientX - box.left, py = clientY - box.top;
    // Iterate topmost-first (later in DOM = painted on top).
    for (var i = collagePlaced.length - 1; i >= 0; i--) {
      var t = collagePlaced[i];
      if (px < t.x || py < t.y || px > t.x + t.fullW || py > t.y + t.fullH) continue;
      var mx = ((px - t.x) / t.fullW * t.mask.w) | 0;
      var my = ((py - t.y) / t.fullH * t.mask.h) | 0;
      // Build a fast lookup set once per mask.
      if (!t.mask._set) {
        var set = {};
        var cells = t.mask.cells;
        for (var c = 0; c < cells.length; c++) set[cells[c][0] + '|' + cells[c][1]] = 1;
        t.mask._set = set;
      }
      if (t.mask._set[mx + '|' + my]) return t;
    }
    return null;
  }
  // Adaptive tip placement: anchor the pill above the hovered bird,
  // centred on it; flip below if there's no room above; clamp to the
  // collage box; and lift it clear of the bottom switcher only when the
  // two would actually overlap. wasHidden suppresses the glide on first
  // appearance so it doesn't slide in from the corner.
  function positionCollageTip(tip, t, wasHidden) {
    var box = collage.getBoundingClientRect();
    var tipW = tip.offsetWidth, tipH = tip.offsetHeight;
    var half = tipW / 2;
    var cx = t.x + t.fullW / 2;
    cx = Math.max(half + 4, Math.min(cx, box.width - half - 4));
    var ty = t.y - tipH - 10;                 // prefer above the bird
    if (ty < 4) ty = t.y + t.fullH + 10;      // no room above -> go below
    ty = Math.max(4, Math.min(ty, box.height - tipH - 4));
    // Keep clear of the bottom switcher, but only if it's on screen and
    // the tip would actually land on top of it.
    var sw = document.querySelector('.slider');
    if (sw) {
      var sr = sw.getBoundingClientRect();
      var sLeft = sr.left - box.left, sRight = sr.right - box.left;
      var sTop = sr.top - box.top, sBot = sr.bottom - box.top;
      var overlaps = (cx - half) < sRight && (cx + half) > sLeft
        && ty < sBot && (ty + tipH) > sTop;
      if (overlaps) ty = Math.max(4, sTop - tipH - 8);
    }
    if (wasHidden) tip.style.transition = 'none';
    tip.style.transform = 'translate(' + cx + 'px,' + ty + 'px) translateX(-50%)';
    if (wasHidden) { void tip.offsetWidth; tip.style.transition = ''; }
  }
  collage.addEventListener('mousemove', function (ev) {
    var hit = maskHitTest(ev.clientX, ev.clientY);
    if (hit === collageHovered) return;
    if (collageHovered && collageHovered.el) collageHovered.el.classList.remove('is-hover');
    collageHovered = hit;
    if (hit && hit.el) hit.el.classList.add('is-hover');
    collage.style.cursor = hit ? 'pointer' : 'default';
    var tip = document.getElementById('collageTip');
    if (tip) {
      if (hit) {
        var wasHidden = tip.getAttribute('aria-hidden') !== 'false';
        var s = hit.data;
        var n = +s.n || 0;
        var noun = (n === 1) ? tt('unit.call') : tt('unit.calls');
        tip.innerHTML = '<span class="ct-name">' + esc(s.com || s.sci) + '</span>'
          + '<span class="ct-w"> - </span>'
          + '<span class="ct-n">' + fmtN(n) + '</span>'
          + '<span class="ct-w"> ' + noun + ' ' + windowLabel(currentHours) + '</span>';
        positionCollageTip(tip, hit, wasHidden);
        tip.setAttribute('aria-hidden', 'false');
      } else {
        tip.setAttribute('aria-hidden', 'true');
      }
    }
  });
  collage.addEventListener('mouseleave', function () {
    if (collageHovered && collageHovered.el) collageHovered.el.classList.remove('is-hover');
    collageHovered = null;
    var tip = document.getElementById('collageTip');
    if (tip) tip.setAttribute('aria-hidden', 'true');
  });
  collage.addEventListener('click', function (ev) {
    var hit = maskHitTest(ev.clientX, ev.clientY);
    if (!hit) return;
    // Tap a bird: info modal (default), reference call, or both, per
    // the tap_action setting. No detour through the atlas view.
    handleBirdTap(hit.data.sci);
  });

  // Debug hook - call __layout({ slugs, weights, n }) from devtools to
  // re-render the collage with a custom item set. Lets us prove the
  // nester handles 6/12/24/48 birds and varied size hierarchies without
  // touching the source.
  window.__layout = function (opts) {
    opts = opts || {};
    var allSlugs = Object.keys({"acanthis-flammea":[560,372],"accipiter-cooperii":[558,560],"accipiter-gentilis":[558,560],"accipiter-striatus":[375,560],"actitis-macularius":[560,409],"aechmophorus-occidentalis":[525,560],"aegolius-acadicus":[560,558],"aeronautes-saxatalis":[560,439],"agelaius-phoeniceus":[276,560],"aix-sponsa":[560,378],"ammodramus-savannarum":[560,436],"amphispiza-bilineata":[560,559],"anas-crecca":[560,288],"anas-platyrhynchos":[558,560],"anser-albifrons":[560,439],"anthus-rubescens":[375,560],"aphelocoma-californica":[560,373],"aphelocoma-woodhouseii":[468,560],"aquila-chrysaetos":[437,560],"archilochus-alexandri":[560,344],"ardea-alba":[560,465],"ardea-herodias":[560,373],"artemisiospiza-belli":[560,435],"asio-flammeus":[560,560],"asio-otus":[404,560],"athene-cunicularia":[560,373],"aythya-affinis":[560,372],"aythya-americana":[560,553],"aythya-collaris":[560,373],"aythya-valisineria":[560,373],"baeolophus-inornatus":[560,311],"bombycilla-cedrorum":[339,560],"bombycilla-garrulus":[560,559],"branta-canadensis":[560,559],"bubo-virginianus":[373,560],"bubulcus-ibis":[267,560],"bucephala-albeola":[560,408],"bucephala-clangula":[560,242],"buteo-jamaicensis":[560,374],"buteo-lagopus":[560,244],"buteo-lineatus":[463,560],"buteo-regalis":[408,560],"buteo-swainsoni":[560,408],"butorides-virescens":[555,560],"calamospiza-melanocorys":[560,374],"calidris-alba":[560,371],"calidris-alpina":[560,374],"callipepla-californica":[560,372],"calothorax-lucifer":[465,560],"calypte-anna":[560,344],"calypte-costae":[560,409],"cardellina-pusilla":[560,281],"cardellina-rubrifrons":[527,560],"cathartes-aura":[376,560],"catharus-guttatus":[560,333],"catharus-ustulatus":[560,408],"catherpes-mexicanus":[320,560],"certhia-americana":[201,560],"chaetura-vauxi":[560,374],"charadrius-vociferus":[560,408],"chondestes-grammacus":[560,559],"chordeiles-minor":[560,319],"cinclus-mexicanus":[560,465],"circus-hudsonius":[372,560],"cistothorus-palustris":[437,560],"coccothraustes-vespertinus":[560,466],"colaptes-auratus":[560,560],"columba-livia":[560,327],"columbina-passerina":[560,559],"contopus-sordidulus":[560,502],"coragyps-atratus":[560,557],"corvus-brachyrhynchos":[560,503],"corvus-corax":[343,560],"cyanocitta-stelleri":[363,560],"cygnus-buccinator":[560,370],"cypseloides-niger":[560,356],"dryobates-nuttallii":[560,321],"dryobates-pubescens":[560,558],"dryobates-villosus":[268,560],"dryocopus-pileatus":[492,560],"egretta-caerulea":[560,321],"egretta-thula":[560,374],"elanus-leucurus":[560,378],"empidonax-difficilis":[268,560],"empidonax-hammondii":[558,560],"empidonax-oberholseri":[495,560],"empidonax-traillii":[371,560],"empidonax-wrightii":[560,527],"eremophila-alpestris":[560,529],"euphagus-cyanocephalus":[560,371],"falco-columbarius":[560,408],"falco-mexicanus":[349,560],"falco-peregrinus":[465,560],"falco-sparverius":[560,370],"gavia-immer":[560,374],"geothlypis-tolmiei":[560,406],"geothlypis-trichas":[560,316],"glaucidium-gnoma":[560,560],"gymnogyps-californianus":[466,560],"haemorhous-mexicanus":[523,560],"haemorhous-purpureus":[560,387],"haliaeetus-leucocephalus":[560,434],"himantopus-mexicanus":[458,560],"hirundo-rustica":[560,410],"hydroprogne-caspia":[560,373],"icteria-virens":[560,293],"icterus-bullockii":[560,214],"icterus-cucullatus":[391,560],"icterus-galbula":[560,528],"icterus-parisorum":[560,266],"ixoreus-naevius":[560,558],"junco-hyemalis":[560,320],"lanius-ludovicianus":[408,560],"larus-californicus":[560,437],"larus-delawarensis":[560,376],"larus-glaucescens":[560,374],"larus-heermanni":[560,436],"larus-occidentalis":[560,412],"leiothlypis-celata":[522,560],"leiothlypis-lucidae":[351,560],"leucophaeus-atricilla":[560,373],"leucophaeus-pipixcan":[560,560],"leucosticte-tephrocotis":[560,465],"limosa-fedoa":[560,556],"lophodytes-cucullatus":[560,409],"loxia-curvirostra":[560,319],"mareca-americana":[560,375],"mareca-strepera":[560,372],"megaceryle-alcyon":[560,409],"megascops-kennicottii":[560,374],"melanerpes-formicivorus":[351,560],"melanerpes-lewis":[372,560],"meleagris-gallopavo":[560,373],"melospiza-georgiana":[320,560],"melospiza-lincolnii":[560,245],"melospiza-melodia":[560,352],"melozone-aberti":[560,268],"melozone-crissalis":[560,538],"melozone-fusca":[560,495],"mergus-merganser":[560,374],"mimus-polyglottos":[560,310],"mniotilta-varia":[560,351],"molothrus-ater":[560,505],"myadestes-townsendi":[560,436],"myiarchus-cinerascens":[560,532],"nucifraga-columbiana":[560,373],"numenius-americanus":[558,560],"nycticorax-nycticorax":[560,465],"oreothlypis-ruficapilla":[372,560],"pandion-haliaetus":[560,371],"passer-domesticus":[560,444],"passerculus-sandwichensis":[560,542],"passerella-iliaca":[560,350],"passerina-amoena":[560,465],"passerina-cyanea":[560,560],"patagioenas-fasciata":[560,500],"pelecanus-erythrorhynchos":[560,316],"pelecanus-occidentalis":[560,406],"perisoreus-canadensis":[560,349],"petrochelidon-pyrrhonota":[558,560],"phainopepla-nitens":[560,464],"phalacrocorax-auritus":[490,560],"phalaenoptilus-nuttallii":[560,373],"phasianus-colchicus":[560,409],"pheucticus-melanocephalus":[559,560],"pica-nuttalli":[560,320],"picoides-arcticus":[374,560],"pinicola-enucleator":[560,372],"pipilo-chlorurus":[560,318],"pipilo-erythrophthalmus":[352,560],"pipilo-maculatus":[443,560],"piranga-ludoviciana":[293,560],"piranga-rubra":[560,495],"plegadis-chihi":[560,372],"podiceps-nigricollis":[560,374],"podilymbus-podiceps":[560,374],"poecile-gambeli":[560,350],"poecile-rufescens":[560,339],"polioptila-caerulea":[560,557],"pooecetes-gramineus":[560,436],"progne-subis":[313,560],"psaltriparus-minimus":[560,428],"quiscalus-mexicanus":[560,269],"recurvirostra-americana":[268,560],"regulus-calendula":[496,560],"regulus-satrapa":[464,560],"riparia-riparia":[560,494],"rynchops-niger":[560,374],"salpinctes-obsoletus":[560,465],"sayornis-nigricans":[308,560],"sayornis-saya":[463,560],"selasphorus-platycercus":[560,497],"selasphorus-rufus":[560,436],"selasphorus-sasin":[434,560],"setophaga-coronata":[461,560],"setophaga-magnolia":[560,268],"setophaga-nigrescens":[560,350],"setophaga-occidentalis":[560,367],"setophaga-palmarum":[438,560],"setophaga-petechia":[560,268],"setophaga-ruticilla":[560,293],"setophaga-townsendi":[560,416],"sialia-currucoides":[558,560],"sialia-mexicana":[560,371],"sitta-canadensis":[560,379],"sitta-carolinensis":[436,560],"sitta-pygmaea":[560,407],"spatula-clypeata":[560,408],"spatula-discors":[560,493],"sphyrapicus-ruber":[560,558],"sphyrapicus-thyroideus":[374,560],"spinus-lawrencei":[560,373],"spinus-pinus":[560,516],"spinus-psaltria":[560,548],"spinus-tristis":[536,560],"spizella-atrogularis":[246,560],"spizella-breweri":[560,557],"spizella-passerina":[560,320],"spizelloides-arborea":[560,436],"stelgidopteryx-serripennis":[558,560],"sterna-forsteri":[560,373],"sterna-hirundo":[560,411],"streptopelia-decaocto":[560,393],"strix-occidentalis":[560,553],"sturnella-neglecta":[320,560],"sturnus-vulgaris":[560,545],"tachycineta-bicolor":[375,560],"tachycineta-thalassina":[560,435],"thalasseus-elegans":[560,407],"thryomanes-bewickii":[560,263],"toxostoma-redivivum":[560,298],"tringa-semipalmata":[560,464],"troglodytes-aedon":[560,494],"troglodytes-pacificus":[560,407],"turdus-migratorius":[560,402],"tyrannus-verticalis":[559,560],"tyrannus-vociferans":[495,560],"tyto-alba":[560,464],"urile-penicillatus":[296,560],"vireo-bellii":[560,559],"vireo-cassinii":[560,319],"vireo-gilvus":[464,560],"vireo-huttoni":[410,560],"xanthocephalus-xanthocephalus":[293,560],"zenaida-asiatica":[560,558],"zenaida-macroura":[522,560],"zonotrichia-atricapilla":[560,238],"zonotrichia-leucophrys":[560,313],"zonotrichia-querula":[560,294]});
    var slugs = opts.slugs || allSlugs.slice(0, opts.n || 12);
    var weights = opts.weights;
    var items = slugs.map(function (slug, i) {
      // Recover a sci name from the slug - capitalize first segment.
      var parts = slug.split('-');
      var sci = parts.slice(0, 2).map(function (p, j) { return j === 0 ? p[0].toUpperCase() + p.slice(1) : p; }).join(' ');
      var n;
      if (weights === 'uniform') n = 10;
      else if (weights === 'extreme') n = i === 0 ? 500 : 1;
      else if (Array.isArray(weights)) n = weights[i] || 1;
      else n = Math.pow(0.55, i) * 100; // default hierarchy
      var it = { sci: sci, com: sci, n: n };
      // Optional pose control for layout previews: a confidence below
      // sitConfidence flies the bird (wings-spread silhouette), at/above
      // it perches; omitted leaves the default (perched).
      if (typeof opts.conf === 'number') it.best_conf = opts.conf;
      return it;
    });
    renderCollage(items);
    return { rendered: items.length, mode: weights || 'hierarchy' };
  };

  // Collage renders whatever is in DATA.recent.species. When the picker
  // changes, refreshRecent() refetches and re-renders. Empty state shows
  // a "no detections in this window" message.
  function renderCollageFromData(animate) {
    var items = (DATA.recent && DATA.recent.species) || [];
    renderCollage(items, animate);
  }
  var rTimer;
  window.addEventListener('resize', function () {
    clearTimeout(rTimer);
    rTimer = setTimeout(function () {
      // (The activity heatmap reflows in pure CSS - no re-render needed.)
      renderCollageFromData();
    }, 120);
  });

  // ---- Stats / Atlas data ----
  // innerHTML setter that skips identical content - re-assigning the
  // same markup still recreates every node (a visible flash on the 30s
  // poll); comparing first makes the no-change case a true no-op.
  function setHtml(el, html) {
    if (!el || el.__lastHtml === html) return false;
    el.__lastHtml = html;
    el.innerHTML = html;
    return true;
  }
  function setRow(id, label, val) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '<span>' + label + '</span><span>' + (val == null || val === '' ? '-' : val) + '</span>';
  }
  function liRow(yr, label, ct, sci) {
    var attr = sci ? ' data-sci="' + esc(sci) + '"' : '';
    return '<li' + attr + '><span class="yr">' + esc(yr) + '</span><span>' + esc(label) +
      '</span><span class="ct">' + (ct == null ? '-' : esc(ct)) + '</span></li>';
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  // HTML-escape for every string interpolated into markup. Species names
  // arrive from the BirdNET-Go API or MQTT sensor states - external data
  // rendered inside the HA frontend, so it must never carry markup.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtN(n) {
    if (n == null) return '-';
    if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString(BCP47);
  }

  // Human label for the current time-window picker selection - replaces
  // a bare "window" with the span it actually covers. Thresholds match
  // the winPick buttons (1H / 12H / 24H / 7D / ALL).
  function windowLabel(h) {
    if (h <= 1) return tt('window.thisHour');
    if (h <= 12) return tt('window.past12h');
    if (h <= 24) return tt('window.today');
    if (h <= 168) return tt('window.thisWeek');
    return tt('window.allTime');
  }

  // ---- Live Pi data layer ----
  // All views read from this DATA object. Populated by fetchAll() on page
  // load and by refreshRecent() when the window picker changes.
  var STATS_DAYS = 30;
  var DATA = {
    stats: null,        // ./avian/api/birdnet-api.php?action=stats (totals/today/week/last_hour/started)
    lifelist: null,     // ./avian/api/birdnet-api.php?action=lifelist (every species ever detected)
    timeseries: null,   // ./avian/api/birdnet-api.php?action=timeseries (daily + hourly aggregates)
    firstseen: null,    // ./avian/api/birdnet-api.php?action=firstseen (newest lifelist additions)
    recent: null,       // ./avian/api/birdnet-api.php?action=recent&hours=N (refetched on picker change)
    activity: null,     // ./avian/api/birdnet-api.php?action=activity&hours=N (per-species hourly heatmap)
  };

  // Derived chart arrays, backfilled so 30 buckets always exist.
  var STATS = {
    detPerDay:  new Array(STATS_DAYS).fill(0), // [day] total detections
    specPerDay: new Array(STATS_DAYS).fill(0), // [day] unique species
    byHour:     new Array(24).fill(0),         // [hour-of-day] detections
  };

  // Map sci -> all-time detection count, populated from lifelist for atlas.
  var speciesTotals = {};

  // Legacy-URL dispatcher (see the BirdNET-Go adapter block at the top of
  // this file). Call sites throughout this file still ask for the BirdNET-Pi
  // PHP shims; this recognises those URLs and answers them from BirdNET-Go's
  // REST API instead, returning the exact same JSON shapes. Anything else
  // falls through to a plain fetch.
  function fetchJson(url) {
    var m = /avian\/api\/([a-z-]+)\.php(?:\?(.*))?$/.exec(url);
    if (m) {
      var q = {};
      (m[2] || '').split('&').forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf('=');
        if (i < 0) { q[decodeURIComponent(kv)] = ''; return; }
        q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, '%20'));
      });
      if (m[1] === 'wiki') return bgWiki(q.sci || '', WIKI_LANG);
      if (m[1] === 'birdnet-api') {
        // Data-source routing: 'api' = BirdNET-Go REST only, 'ha' = HA
        // history of the MQTT sensors only, 'auto' (default) = REST first,
        // falling back to HA history when the REST call fails (e.g. the
        // add-on's port isn't reachable from this browser).
        var mode = AV_CFG.dataSource || 'auto';
        var pick = function (api, ha) {
          if (mode === 'ha') return haAvailable() ? ha() : Promise.reject('HA data source needs the card (hass) or a haToken');
          if (mode === 'api' || !haAvailable()) return api();
          return api().catch(function (apiErr) {
            return ha().catch(function () { return Promise.reject(apiErr); });
          });
        };
        var hours, sci2, days2, lim;
        switch (q.action || 'stats') {
          case 'stats':
            return pick(bgStats, hhStats);
          case 'lifelist':
            return pick(bgLifelist, hhLifelist);
          case 'recent':
            hours = Math.max(1, Math.min(1000000, +q.hours || 24));
            return pick(function () { return bgRecent(hours); }, function () { return hhRecent(hours); });
          case 'activity':
            hours = Math.max(1, Math.min(1000000, +q.hours || 24));
            return pick(function () { return bgActivity(hours); }, function () { return hhActivity(hours); });
          case 'species':
            sci2 = q.sci || '';
            return pick(function () { return bgSpecies(sci2); }, function () { return hhSpecies(sci2); });
          case 'timeseries':
            days2 = Math.max(1, Math.min(90, +q.days || 30));
            return pick(function () { return bgTimeseries(days2); }, function () { return hhTimeseries(days2); });
          case 'firstseen':
            lim = Math.max(1, Math.min(50, +q.limit || 10));
            return pick(function () { return bgFirstseen(lim); }, function () { return hhFirstseen(lim); });
        }
      }
      return Promise.reject(404);
    }
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
  }

  function backfillDaily(daily, days) {
    // Build a continuous array of (days) length, ending today.
    var byDate = {};
    (daily || []).forEach(function (row) { byDate[row.date] = row; });
    var out = new Array(days).fill(null).map(function () { return { detections: 0, species: 0 }; });
    var today = new Date();
    for (var i = 0; i < days; i++) {
      var d = new Date(today);
      d.setDate(today.getDate() - (days - 1 - i));
      var key = d.toISOString().slice(0, 10);
      if (byDate[key]) {
        out[i].detections = +byDate[key].detections || 0;
        out[i].species    = +byDate[key].species    || 0;
      }
    }
    return out;
  }

  function recomputeDerived() {
    var ts = DATA.timeseries || { daily: [], by_hour: [] };
    var ll = DATA.lifelist || { species: [] };
    var rows = backfillDaily(ts.daily, STATS_DAYS);
    STATS.detPerDay  = rows.map(function (r) { return r.detections; });
    STATS.specPerDay = rows.map(function (r) { return r.species; });
    var byHour = new Array(24).fill(0);
    (ts.by_hour || []).forEach(function (r) { byHour[+r.hour] = +r.detections; });
    STATS.byHour = byHour;
    speciesTotals = {};
    (ll.species || []).forEach(function (s) { speciesTotals[s.sci] = +s.n; });
  }

  // Activity heatmap (BirdNET-Go dashboard style): one row per species
  // (most-heard first), one cell per hour of day. A cell's tint deepens
  // with its detection count (5 log steps) and the number prints inside.
  // The panel scrolls vertically when there are many species and
  // horizontally on narrow screens (fixed cell width, sticky name
  // column). Windows longer than a day aggregate hour-of-day over the
  // last 7 days - the caption says which.
  function renderActivity(animate) {
    var tl = document.getElementById('statsTimeline');
    if (!tl) return;
    var act = DATA.activity || {};
    var species = (act.species || []).slice();
    if (!species.length) {
      setHtml(tl, '<div class="stats-hm-empty">' + esc(tt('stats.heatmapEmpty')) + '</div>');
      return;
    }
    var MAX_ROWS = 40;
    var trimmed = species.length > MAX_ROWS;
    if (trimmed) species = species.slice(0, MAX_ROWS);

    var winHours = act.win_hours || Math.min(currentHours, 7 * 24);
    var maxN = 1;
    species.forEach(function (s) {
      (s.byHour || []).forEach(function (n) { if (+n > maxN) maxN = +n; });
    });
    // 5 tint steps on a log scale, so one loud dawn chorus doesn't wash
    // every other cell down to the faintest shade.
    function shade(n) {
      return Math.max(1, Math.min(5, Math.ceil(5 * Math.log(1 + n) / Math.log(1 + maxN))));
    }

    // Hours of day inside the window: a rolling sub-day window covers a
    // contiguous (midnight-wrapping) hour range ending now; cells outside
    // it get .off so the window's extent reads at a glance.
    var inWin = new Array(24).fill(true);
    if (winHours < 24) {
      inWin.fill(false);
      var nowH = new Date().getHours();
      for (var k = 0; k < Math.min(24, Math.ceil(winHours)); k++) {
        inWin[(nowH - k + 24) % 24] = true;
      }
    }

    var head = '<div class="stats-hm-head"><span class="stats-hm-name"></span>';
    for (var hh = 0; hh < 24; hh++) head += '<span class="stats-hm-hr">' + pad(hh) + '</span>';
    head += '<span class="stats-hm-tot">' + esc(tt('stats.heatmapTotal')) + '</span></div>';

    var rows = species.map(function (s) {
      var cells = '';
      for (var h = 0; h < 24; h++) {
        var n = +((s.byHour || [])[h]) || 0;
        cells += '<span class="stats-hm-cell' + (n ? ' l' + shade(n) : '') +
          (inWin[h] ? '' : ' off') + '">' + (n ? fmtN(n) : '') + '</span>';
      }
      return '<div class="stats-hm-row" data-sci="' + esc(s.sci) + '">'
        + '<span class="stats-hm-name"><span class="com">' + esc(s.com || s.sci) + '</span></span>'
        + cells
        + '<span class="stats-hm-tot">' + fmtN(s.n) + '</span></div>';
    }).join('');

    // Past the 7-day cap (the ALL window) the matrix only covers the
    // last week - say so instead of implying all time.
    var cap = currentHours > 7 * 24
      ? tt('stats.byHourDayCap')
      : tt('stats.byHourCap', { window: windowLabel(currentHours) });
    if (trimmed) cap += ' · ' + tt('stats.heatmapTrim', { max: MAX_ROWS, total: act.species.length });

    setHtml(tl,
      '<div class="stats-hm">' + head + rows + '</div>'
      + '<div class="stats-hm-cap">' + cap + '</div>');
    if (animate) playStatsEntrance();
  }

  // Cross-highlight between the heatmap rows and the right-side
  // species lists. Delegated off the stats view so it survives the
  // periodic re-render of both halves.
  (function wireStatsHighlight() {
    var v1 = document.getElementById('v1');
    if (!v1) return;
    function setHi(sci, on) {
      if (!sci) return;
      var esc = sci.replace(/"/g, '\"');
      v1.querySelectorAll('.stats-hm-row[data-sci="' + esc + '"], .stats-side li[data-sci="' + esc + '"]')
        .forEach(function (el) { el.classList.toggle('sync-hi', on); });
    }
    v1.addEventListener('mouseover', function (ev) {
      var el = ev.target.closest && ev.target.closest('[data-sci]');
      if (el) setHi(el.getAttribute('data-sci'), true);
    });
    v1.addEventListener('mouseout', function (ev) {
      var el = ev.target.closest && ev.target.closest('[data-sci]');
      if (el) {
        // Only clear if we're actually leaving the element (not moving
        // to a child).
        var to = ev.relatedTarget;
        if (to && el.contains(to)) return;
        setHi(el.getAttribute('data-sci'), false);
      }
    });
  })();

  // ---- Side text lists (real Pi data) ----
  function renderStatsLists() {
    var stats = DATA.stats || {};
    var recent = DATA.recent || { species: [] };
    var firstseen = DATA.firstseen || { species: [] };

    // By Period - pulled directly from ./avian/api/birdnet-api.php?action=stats so the numbers
    // are authoritative (BirdNET-Pi's own counts).
    var last_hour = (stats.last_hour && stats.last_hour.detections) || 0;
    var today_det = (stats.today && stats.today.detections) || 0;
    var week_det = (stats.week && stats.week.detections) || 0;
    var all_det = (stats.totals && stats.totals.detections) || 0;
    setHtml(document.getElementById('statsByPeriod'),
        liRow(tt('stats.badgeNow'),   tt('stats.lastHour'),  fmtN(last_hour))
      + liRow(tt('stats.badgeToday'), tt('stats.today'),     fmtN(today_det))
      + liRow(tt('stats.badgeWeek'),  tt('stats.last7days'), fmtN(week_det))
      + liRow(tt('stats.badgeAll'),   tt('stats.allTime'),   fmtN(all_det)));

    // Top Species - top 5 species in the current window. ./avian/api/birdnet-api.php?action=recent
    // already returns species sorted by last_seen DESC; re-sort by count.
    var ranked = (recent.species || [])
      .slice()
      .sort(function (a, b) { return (+b.n) - (+a.n); })
      .slice(0, 5);
    setHtml(document.getElementById('statsTopSpec'), ranked.length
      ? ranked.map(function (s, i) { return liRow(pad(i + 1), s.com, fmtN(+s.n), s.sci); }).join('')
      : liRow('-', tt('stats.noneInWindow'), ''));
    document.getElementById('statsTopSpecCap').textContent =
      tt('stats.topSpecCap', { window: windowLabel(currentHours) });

    // First Detections - newest additions to the life list, with a
    // "Xd ago" label computed from first_seen.
    var fs = (firstseen.species || []).slice(0, 5);
    var now = Date.now();
    setHtml(document.getElementById('statsFirstSeen'), fs.length
      ? fs.map(function (s) {
          var t = Date.parse((s.first_seen || '').replace(' ', 'T'));
          var label = '-';
          if (!isNaN(t)) {
            var daysAgo = Math.floor((now - t) / 86400000);
            label = daysAgo === 0 ? tt('stats.today')
              : relTimeAgo(daysAgo, 'day', tt('stats.daysAgo', { n: daysAgo }));
          }
          return liRow(label, s.com, '', s.sci);
        }).join('')
      : liRow('-', tt('stats.noneYet'), ''));
  }

  // ---- Atlas: field-guide card grid ----
  // eBird species codes for placeholder birds. eBird's URL scheme is
  // https://ebird.org/species/<code>/, where <code> is a stable 6-char
  // taxonomy code. Hardcoded here for the local-California demo set;
  // a real implementation can look these up via the eBird taxon API.
  var EBIRD_CODES = {
    'Calypte anna':           'annhum',
    'Passer domesticus':      'houspa',
    'Haemorhous mexicanus':   'houfin',
    'Turdus migratorius':     'amerob',
    'Zenaida macroura':       'moudov',
    'Spinus psaltria':        'lesgol',
    'Zonotrichia leucophrys': 'whcspa',
    'Aphelocoma californica': 'cascj1',
    'Mimus polyglottos':      'normoc',
    'Sayornis nigricans':     'blkpho',
    'Larus occidentalis':     'wegull',
    'Corvus brachyrhynchos':  'amecro'
  };

  // External "read more" link. Points at the active locale's Wikipedia so
  // the link lands on the same-language article as the fetched summary;
  // with WIKI_LANG='en' this is byte-identical to the original.
  function wikiUrl(sci, lang) {
    return 'https://' + (lang || WIKI_LANG) + '.wikipedia.org/wiki/' + encodeURIComponent(sci.replace(/ /g, '_'));
  }
  function ebirdUrl(sci) {
    var code = EBIRD_CODES[sci];
    return code ? 'https://ebird.org/species/' + code : 'https://ebird.org/explore';
  }

  // Tiny inline icons - monochrome, ink-only, match the page palette.
  var ICON_PLAY = '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 2 L10 6 L3 10 Z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 12 12" fill="currentColor"><rect x="3" y="2" width="2.5" height="8"/><rect x="6.5" y="2" width="2.5" height="8"/></svg>';

  // Atlas playback state lives at module level: the grid is rebuilt when
  // its data changes, and a per-render state would strand a playing clip
  // (and stack duplicate grid-level listeners).
  var currentAudio = null;
  var currentBtn = null;
  function renderAtlas(animate) {
    var grid = document.getElementById('atlasGrid');
    if (!grid) return;

    var lifelist = (DATA.lifelist && DATA.lifelist.species) || [];
    var recent = (DATA.recent && DATA.recent.species) || [];
    // Window count lookup: sci -> count in current window.
    var winBySci = {};
    recent.forEach(function (s) { winBySci[s.sci] = +s.n; });

    if (!lifelist.length) {
      setHtml(grid, '<div class="atlas-empty">' +
        '<p>' + esc(tt('atlas.emptyTitle')) + '</p>' +
        '<p class="hint">' + esc(tt('atlas.emptyHint')) + '</p>' +
        '</div>');
      return;
    }

    // Time-window filter: when a windowed view is selected, only show
    // species heard in that window. ALL preserves the full lifelist.
    var isAllWindow = currentHours >= 1000000;
    var filtered = isAllWindow
      ? lifelist
      : lifelist.filter(function (s) { return (winBySci[s.sci] || 0) > 0; });
    if (!filtered.length) {
      setHtml(grid, '<div class="atlas-empty">' +
        '<p>' + esc(tt('atlas.noWindowTitle')) + '</p>' +
        '<p class="hint">' + esc(tt('atlas.noWindowHint')) + '</p>' +
        '</div>');
      return;
    }

    // Sort by the atlas-sort segmented control (defaults to "count" =
    // most-heard all time).
    var sortMode = (window.__atlasSort) || 'count';
    var species = filtered.slice();
    if (sortMode === 'count') {
      species.sort(function (a, b) { return (+b.n) - (+a.n); });
    } else if (sortMode === 'recent') {
      species.sort(function (a, b) {
        return (b.last_seen || '').localeCompare(a.last_seen || '');
      });
    } else if (sortMode === 'alpha') {
      species.sort(function (a, b) {
        return (a.com || a.sci || '').localeCompare(b.com || b.sci || '');
      });
    }

    // A species is a "lifer" in the current view if its all-time first
    // detection falls inside the selected window - i.e. it was newly added
    // to the life list this 1h / 12h / 24h / 7d. Never shown for the ALL
    // window (every species would qualify against an open-ended span).
    var now = Date.now();
    var windowStartMs = now - currentHours * 3600000;
    var atlasHtml = species.map(function (s) {
      var total = +s.n || 0;
      var win = winBySci[s.sci] || 0;
      var firstMs = Date.parse((s.first_seen || '').replace(' ', 'T'));
      var isLifer = !isAllWindow && !isNaN(firstMs) && firstMs >= windowStartMs;
      var sketchSrc = assetSrc(s.sci, 1) + '?v=' + SKETCH_VERSION;
      // The "all time" window makes the windowed count identical to the
      // all-time count - collapse to a single stat rather than print the
      // same number twice. Otherwise label the count with its span.
      var statRows = currentHours >= 1000000
        ? '<div><span class="n">' + fmtN(total) + '</span><span class="lbl-inline">' + esc(tt('atlas.allTime')) + '</span></div>'
        : '<div><span class="n">' + fmtN(win) + '</span><span class="lbl-inline">' + esc(windowLabel(currentHours)) + '</span></div>'
          + '<div><span class="n">' + fmtN(total) + '</span><span class="lbl-inline">' + esc(tt('atlas.allTime')) + '</span></div>';
      return ''
        + '<article class="bird-card" data-sci="' + esc(s.sci) + '">'
        +   (isLifer ? '<span class="lifer-badge" title="' + esc(tt('atlas.newTitle')) + '">' + esc(tt('atlas.new')) + '</span>' : '')
        +   '<div class="stat">' + statRows + '</div>'
        +   '<div class="img-wrap">'
        +     '<img loading="lazy" decoding="async" src="' + sketchSrc + '" alt="' + esc(s.com) + '"' + birdImgAttrs(s.sci, 1) + '>'
        +   '</div>'
        +   '<h3>' + esc(s.com) + '</h3>'
        +   '<div class="sci">' + esc(s.sci) + '</div>'
        +   '<div class="spectro-wrap" aria-hidden="true"></div>'
        +   '<div class="actions">'
        +     '<button type="button" class="chip play" data-action="play" aria-label="play recording">'
        +       ICON_PLAY + '<span>play</span>'
        +     '</button>'
        +     '<a class="chip ext" href="' + wikiUrl(s.sci) + '" target="_blank" rel="noopener" aria-label="Wikipedia">wiki</a>'
        +     '<a class="chip ext" href="' + ebirdUrl(s.sci) + '" target="_blank" rel="noopener" aria-label="eBird">ebird</a>'
        +   '</div>'
        + '</article>';
    }).join('');
    // Unchanged markup: leave the DOM (and its wired listeners) alone -
    // no flash on the silent poll. The entrance replay still runs when
    // a view switch asks for it.
    if (!setHtml(grid, atlasHtml)) {
      if (animate) playAtlasEntrance();
      return;
    }

    // Wire audio playback + spectrogram load.
    // - Only one card plays at a time. Clicking play on a different card
    //   stops the current one first.
    // - The spectrogram is lazily fetched on first play (saves a Pi hit
    //   for every card visible on initial render).
    // - If the recording endpoint 404s (no detection yet for this
    //   species), the button reverts and shows "no audio".
    function setBtnState(btn, state) {
      btn.setAttribute('data-state', state);
      if (state === 'playing') {
        btn.setAttribute('data-active', 'true');
        btn.innerHTML = ICON_PAUSE + '<span>stop</span>';
      } else if (state === 'loading') {
        btn.setAttribute('data-active', 'true');
        btn.innerHTML = ICON_PLAY + '<span>...</span>';
      } else if (state === 'missing') {
        btn.setAttribute('data-active', 'false');
        btn.innerHTML = ICON_PLAY + '<span>no audio</span>';
        setTimeout(function () {
          if (btn.getAttribute('data-state') === 'missing') {
            btn.innerHTML = ICON_PLAY + '<span>play</span>';
            btn.setAttribute('data-state', 'idle');
          }
        }, 2200);
      } else {
        btn.setAttribute('data-active', 'false');
        btn.innerHTML = ICON_PLAY + '<span>play</span>';
      }
    }
    function clearProgressOn(card) {
      if (!card) return;
      var sw = card.querySelector('.spectro-wrap');
      if (sw) sw.style.setProperty('--prog', '0%');
      card.removeAttribute('data-playing');
    }
    function stopCurrent() {
      audioRelease(stopCurrent);
      if (currentAudio) {
        try { currentAudio.pause(); } catch (e) {}
        currentAudio = null;
      }
      if (currentBtn) {
        var card = currentBtn.closest('.bird-card');
        clearProgressOn(card);
        setBtnState(currentBtn, 'idle');
        currentBtn = null;
      }
    }
    grid.querySelectorAll('[data-action="play"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.bird-card');
        if (btn === currentBtn) { stopCurrent(); return; }
        stopCurrent();
        audioClaim(stopCurrent);   // stop any modal-recording / live-stream audio
        setBtnState(btn, 'loading');
        currentBtn = btn;
        // The PHP shim resolved sci -> newest recording server-side. Here we
        // first look up the species' latest BirdNET-Go detection (one cached
        // /detections query), then carry on with the resolved clip URL.
        resolveSpeciesAudio(card.dataset.sci).then(function (resolvedUrl) {
        if (currentBtn !== btn) return;   // user clicked away mid-resolve
        card.dataset.audio = resolvedUrl;
        // Render the spectrogram client-side from the recording's audio so
        // it matches the active theme. paintSpectrogram paints with the
        // --paper/--ink palette per data-theme (the same canvas the modal
        // recordings use), instead of a fixed-colour PNG that can't follow
        // light/dark mode. Decoded buffers are cached per URL.
        var spectroWrap = card.querySelector('.spectro-wrap');
        if (spectroWrap && !spectroWrap.firstChild) {
          var canvas = document.createElement('canvas');
          spectroWrap.appendChild(canvas);
          var aurl = card.dataset.audio;
          if (_decodedCache[aurl]) {
            paintSpectrogram(canvas, _decodedCache[aurl]);
          } else {
            var actx = getSpecCtx();
            if (actx) {
              fetch(aurl)
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
                .then(function (b) { return actx.decodeAudioData(b); })
                .then(function (buf) {
                  _decodedCache[aurl] = buf;
                  // Guard on document containment, not spectroWrap.contains:
                  // a 30s refreshAll() poll can rebuild the atlas and detach
                  // this card mid-decode. The detached wrap still "contains"
                  // its canvas, but a detached node measures 0x0, which would
                  // trap paintSpectrogram in its size-retry loop forever.
                  if (document.contains(canvas)) paintSpectrogram(canvas, buf);
                })
                .catch(function () { if (spectroWrap.contains(canvas)) spectroWrap.removeChild(canvas); });
            } else {
              spectroWrap.removeChild(canvas);
            }
          }
        }
        // Start audio.
        var audio = makeAudio(card.dataset.audio);
        audio.addEventListener('canplay', function () {
          if (currentBtn !== btn) return; // user clicked away
          setBtnState(btn, 'playing');
          card.setAttribute('data-playing', 'true');
          audio.play();
        });
        // Progress bar on the spectrogram strip.
        audio.addEventListener('timeupdate', function () {
          if (currentBtn !== btn) return;
          var pct = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
          if (spectroWrap) spectroWrap.style.setProperty('--prog', pct.toFixed(1) + '%');
        });
        audio.addEventListener('ended', function () {
          if (currentBtn === btn) stopCurrent();
        });
        audio.addEventListener('error', function () {
          if (currentBtn === btn) {
            setBtnState(btn, 'missing');
            clearProgressOn(card);
            currentAudio = null; currentBtn = null;
          }
        });
        currentAudio = audio;
        audio.load();
        }).catch(function () {
          // No detection (or clip) for this species - mirror the old
          // 404-from-recording.php behaviour.
          if (currentBtn !== btn) return;
          clearProgressOn(card);
          setBtnState(btn, 'missing');
          currentBtn = null;
        });
      });
    });

    // Spectrogram click = scrub to that position (if playing) or restart.
    // Wired once - the listener lives on the grid (which survives
    // rebuilds) and reads the module-level playback state.
    if (!grid.__scrubWired) {
    grid.__scrubWired = true;
    grid.addEventListener('click', function (ev) {
      var sw = ev.target.closest && ev.target.closest('.spectro-wrap');
      if (!sw || !sw.firstChild) return;
      var card = sw.closest('.bird-card');
      var btn = card.querySelector('[data-action="play"]');
      // If this card is the active one, scrub.
      if (currentBtn === btn && currentAudio && currentAudio.duration) {
        var rect = sw.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        currentAudio.currentTime = pct * currentAudio.duration;
      } else {
        // Otherwise start playback from the top.
        btn.click();
      }
    });
    }
    if (animate) playAtlasEntrance();
  }

  function renderWindowDependent(animate) {
    // renderStatsLists runs BEFORE renderActivity so the stats entrance
    // (fired at the end of renderActivity) can stagger the side-panel rows
    // that were just built, in tandem with the heatmap populating.
    renderCollageFromData(animate);
    renderStatsLists();
    renderActivity(animate);
    renderAtlas(animate);
  }
  function renderTimeIndependent(animate) {
    // Lists first, then the heatmap (see renderWindowDependent).
    renderStatsLists();
    renderActivity(animate);
    renderAtlas(animate);
  }

  function refreshRecent(animate) {
    // Capture the window this fetch was issued for. If the user
    // changes the picker again before it resolves - or a slower poll
    // lands later - we discard the stale response so the collage
    // never reverts to a different window.
    var forHours = currentHours;
    return Promise.all([
      fetchJson('./avian/api/birdnet-api.php?action=recent&hours=' + forHours),
      fetchJson('./avian/api/birdnet-api.php?action=activity&hours=' + forHours)
        .catch(function () { return null; }),
    ]).then(function (parts) {
        if (forHours !== currentHours) return; // window changed mid-flight
        DATA.recent = parts[0];
        DATA.activity = parts[1];
        renderWindowDependent(animate);
      })
      .catch(function (e) { console.warn('recent fetch failed', e); });
  }
  function refreshAll(animate) {
    var forHours = currentHours;
    return Promise.all([
      fetchJson('./avian/api/birdnet-api.php?action=stats').catch(function () { return null; }),
      fetchJson('./avian/api/birdnet-api.php?action=lifelist').catch(function () { return null; }),
      fetchJson('./avian/api/birdnet-api.php?action=timeseries&days=30').catch(function () { return null; }),
      fetchJson('./avian/api/birdnet-api.php?action=firstseen&limit=10').catch(function () { return null; }),
      fetchJson('./avian/api/birdnet-api.php?action=recent&hours=' + forHours).catch(function () { return null; }),
      fetchJson('./avian/api/birdnet-api.php?action=activity&hours=' + forHours).catch(function () { return null; }),
    ]).then(function (parts) {
      DATA.stats = parts[0];
      DATA.lifelist = parts[1];
      DATA.timeseries = parts[2];
      DATA.firstseen = parts[3];
      // Only accept the window-scoped slices if the window hasn't changed
      // since this poll started - otherwise keep what's there.
      if (forHours === currentHours) {
        if (parts[4]) DATA.recent = parts[4];
        if (parts[5]) DATA.activity = parts[5];
      }
      recomputeDerived();
      renderTimeIndependent(animate);
      renderCollageFromData(animate);
    });
  }

  // Kick off the initial fetch. Renders pull from DATA as soon as it
  // populates; until then the page sits with empty histograms + lists.
  // animate=true so the collage blooms in on first load.
  refreshAll(true);

  // Hook into the window picker so the data refetches on change. Pass
  // animate=true so the collage blooms (the silent poll passes nothing).
  winBtns.forEach(function (b) {
    b.addEventListener('click', function () { refreshRecent(true); });
  });

  // ---- Realtime polling ----
  // Every POLL_MS the page refetches the live data set so the collage,
  // stats, and atlas reflect new detections without a manual reload.
  // We use refreshAll() (cheap: 5 small JSON fetches) so the dependent
  // text/charts update too. Polling pauses when the tab is hidden and
  // resumes (with an immediate fetch) when it becomes visible again.
  // Card builds lengthen this (MQTT sensor updates push refreshes there,
  // so the timer is just a safety net); the static page keeps 30s.
  var POLL_MS = Math.max(10, +AV_CFG.pollSeconds || 30) * 1000;
  var pollTimer = null;
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(function () {
      if (document.hidden) return;
      refreshAll();
    }, POLL_MS);
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopPolling();
    } else {
      // Force an immediate refresh on return so the user sees fresh
      // data right away, then resume normal polling cadence.
      refreshAll();
      startPolling();
    }
  });
  startPolling();

  // Card builds call this when a BirdNET-Go MQTT sensor updates: clear
  // the short-TTL response memos (they'd otherwise serve the pre-event
  // answer) and refresh immediately. No-op on the static page.
  if (AV_CFG.__exposeRefresh) {
    AV_CFG.__exposeRefresh(function () {
      _bgMemo = {};
      _haMemo = {};
      refreshAll();
    });
  }

  // ---- Menu dropdown ----
  var dd = document.getElementById('menu-dd');
  var menuBtn = document.getElementById('menuBtn');
  var locked  = document.getElementById('dd-locked');
  var items   = document.getElementById('dd-items');
  var lockHint= document.getElementById('lockHint');
  function openDd()  { dd.classList.add('open'); dd.setAttribute('aria-hidden','false'); setTimeout(function () { document.getElementById('lockPass').focus(); }, 100); }
  function closeDd() { dd.classList.remove('open'); dd.setAttribute('aria-hidden','true'); }
  function toggleDd(){ dd.classList.contains('open') ? closeDd() : openDd(); }
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleDd(); });
  document.addEventListener('click', function (e) { if (!dd.contains(e.target) && e.target !== menuBtn) closeDd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDd(); });

  // Probe menu.php with no Authorization header. On a LAN deploy
  // (AV_REQUIRE_AUTH=0) it returns 200 immediately so the drawer
  // renders directly. On a forwarded deploy with Caddy basic_auth in
  // front, Caddy will already have validated credentials before this
  // request reaches PHP - so a 200 here means we're authed, a 401
  // means Caddy rejected and we need the lock-screen flow.
  function tryAutoUnlock() {
    fetch('./avian/api/menu.php', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 200) {
        return r.json().then(function (j) { renderMenu(j.items || []); });
      }
    }).catch(function () {});
  }
  tryAutoUnlock();

  document.getElementById('unlockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    // BirdNET-Pi's upstream Caddyfile basicauth user is `birdnet`.
    // If your install changed it (custom Caddyfile), set window.AV_AUTH_USER
    // before this script loads - e.g. an inline <script> in index.html.
    var u = (window.AV_AUTH_USER || 'birdnet');
    var p = document.getElementById('lockPass').value;
    var hdr = 'Basic ' + btoa(u + ':' + p);
    // POST to menu.php with the header so the browser caches the basic
    // creds for every subsequent request. If Caddy basic_auth accepts
    // them we get a 200 and the drawer renders; 401 means wrong password.
    fetch('./avian/api/menu.php', {
      method: 'POST',
      headers: { 'Authorization': hdr },
      credentials: 'same-origin',
    }).then(function (r) {
      if (r.status === 200) {
        return r.json().then(function (j) { renderMenu(j.items || []); });
      } else if (r.status === 401) {
        lockHint.textContent = 'wrong password.';
        lockHint.classList.add('lock-err');
      } else {
        lockHint.textContent = 'auth unavailable.';
        lockHint.classList.add('lock-err');
      }
    }).catch(function () {
      lockHint.textContent = 'network error.';
      lockHint.classList.add('lock-err');
    });
  });

  // Render the unlocked drawer:
  //   - inline LIVE AUDIO player (streams icecast through the worker tunnel)
  //   - collapsible SETTINGS section (closed by default to avoid mis-clicks)
  //   - small ADVANCED TOOLS grid for the rest of BirdNET-Pi (still
  //     opens externally; rebuilding all of these in our design is on
  //     the follow-up list)
  function renderMenu(menu) {
    locked.style.display = 'none';
    items.classList.add('show');
    var liveAudioIcon = '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 2 L10 6 L3 10 Z"/></svg>';
    var stopIcon = '<svg viewBox="0 0 12 12" fill="currentColor"><rect x="3" y="3" width="6" height="6"/></svg>';
    var specOnIcon = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 9 L4 5 L6 8 L8 3 L10 7"/></svg>';
    // Build the diagnostic shortcuts (system / logs / tools). With
    // native:true they navigate in-page; otherwise they keep the old
    // open-in-new-tab behavior for the legacy BirdNET-Pi screens.
    var linksHtml = menu.map(function (it) {
      var label = (it.label || '');
      var attrs = it.native ? '' : ' target="_blank" rel="noopener"';
      var cls = it.native ? '' : ' class="ext"';
      return '<a' + cls + ' href="' + it.href + '"' + attrs + '><span>' + label + '</span></a>';
    }).join('');
    items.innerHTML =
      '<div class="live-audio" id="liveAudio" data-on="false">'
      + '  <div class="pulse"></div>'
      + '  <div class="label">Live audio<span class="hint">stream from the mic</span></div>'
      + '  <button type="button" id="liveAudioBtn">'
      +     liveAudioIcon + '<span>listen</span>'
      + '  </button>'
      + '</div>'
      // Spectrogram canvas is always present; it stays a dark inert
      // strip until the stream is on, then the FFT loop paints it in
      // real time. No separate toggle.
      + '<canvas class="live-spectro" id="liveSpectro" width="600" height="120" aria-label="live spectrogram"></canvas>'
      + '<div class="live-status" id="liveStatus"></div>'
      + '<div class="menu-links">' + linksHtml + '</div>';

    // Clicking a nav link (settings / system / logs / tools) collapses the
    // menu back into the button - it has opened (or navigated to) its page,
    // so leaving the drawer open is just clutter. The listen button and the
    // built-by / GitHub links deliberately DON'T close it (you stay in the
    // drawer to keep the stream going; those links open a new tab).
    var menuLinks = items.querySelector('.menu-links');
    if (menuLinks) menuLinks.addEventListener('click', function (ev) {
      if (ev.target.closest('a')) closeDd();
    });

    // Live audio + realtime spectrogram. The audio element and the
    // FFT analyser share one AudioContext; once .play() is called the
    // analyser starts painting the canvas via rAF. No timeout - we
    // surface the natural error event or success ("playing") only.
    var liveBox = document.getElementById('liveAudio');
    var liveBtn = document.getElementById('liveAudioBtn');
    var spectroEl = document.getElementById('liveSpectro');
    var statusEl = document.getElementById('liveStatus');
    var liveEl = null, audioCtx = null, srcNode = null, analyser = null;
    var specRaf = null;

    function setStatus(msg, isErr) {
      statusEl.textContent = msg || '';
      statusEl.className = 'live-status' + (isErr ? ' err' : '');
    }
    function startAudio() {
      // Create the Audio element and resolve on the first "playing"
      // event (success). The browser will hang the network request
      // open for an icecast stream - that's normal - and "playing"
      // fires as soon as the first audio frame is decoded. We don't
      // race a timeout because icecast can take 1-10s to warm up
      // depending on tunnel + bitrate.
      return new Promise(function (resolve, reject) {
        liveEl = new Audio('/stream?t=' + Date.now());
        // No crossOrigin - the stream is same-origin via the worker
        // and crossOrigin='anonymous' would require CORS headers
        // icecast doesn't send.
        var settled = false;
        liveEl.addEventListener('playing', function () {
          if (settled) return;
          settled = true; resolve();
        });
        liveEl.addEventListener('error', function () {
          if (settled) return;
          settled = true;
          reject(new Error('stream error - check /#admin=system'));
        });
        audioClaim(stopAudio);   // stop any card / modal-recording audio
        liveEl.play().catch(function (e) {
          if (settled) return;
          settled = true; reject(e);
        });
      });
    }
    function stopAudio() {
      audioRelease(stopAudio);
      if (specRaf) { cancelAnimationFrame(specRaf); specRaf = null; }
      if (liveEl) { try { liveEl.pause(); } catch (e) {} liveEl.src = ''; liveEl = null; }
      if (srcNode) { try { srcNode.disconnect(); } catch (e) {} srcNode = null; }
      if (analyser) { try { analyser.disconnect(); } catch (e) {} analyser = null; }
      liveBox.setAttribute('data-on', 'false');
      liveBtn.innerHTML = liveAudioIcon + '<span>listen</span>';
      // Clear the spectrogram canvas so it returns to its quiet state.
      var ctx = spectroEl.getContext('2d');
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--paper-2').trim() || '#efe8d8';
      ctx.fillRect(0, 0, spectroEl.width, spectroEl.height);
    }
    function attachSpectrogram() {
      if (!liveEl) return;
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      try {
        srcNode = audioCtx.createMediaElementSource(liveEl);
      } catch (e) {
        // MediaElementSource throws if the Audio is already wired up
        // (e.g. user toggled listen off then on). Best effort - let
        // the audio still play, just skip the spectrogram.
        return;
      }
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      srcNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      drawSpectrogram();
    }
    // Convert a CSS colour token (hex or rgb()) to [r,g,b] by letting the 2d
    // context normalise whatever form the variable is authored in.
    function toRGB(str, fallback) {
      var c = spectroEl.getContext('2d');
      c.fillStyle = fallback; c.fillStyle = str;   // invalid str leaves fallback
      var s = c.fillStyle;
      if (s.charAt(0) === '#') return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
      var m = s.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
    }
    function drawSpectrogram() {
      var ctx = spectroEl.getContext('2d');
      var W = spectroEl.width, H = spectroEl.height;
      // Read palette tokens so the live spectrogram follows the theme - a
      // charcoal ground with a light trace in dark mode, not a hardcoded
      // light-mode ramp - matching the recording-row + card spectrograms.
      var cs = getComputedStyle(document.documentElement);
      var paper = cs.getPropertyValue('--paper-2').trim() || '#efe8d8';
      var bg = toRGB(paper, '#efe8d8');
      var fg = toRGB(cs.getPropertyValue('--ink').trim() || '#1a1612', '#1a1612');
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);
      var bins = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        if (!analyser) return;
        var img = ctx.getImageData(1, 0, W - 1, H);
        ctx.putImageData(img, 0, 0);
        ctx.clearRect(W - 1, 0, 1, H);
        analyser.getByteFrequencyData(bins);
        var n = bins.length;
        var lo = Math.floor(n * 250 / 24000);
        var hi = Math.floor(n * 12000 / 24000);
        for (var y = 0; y < H; y++) {
          var t = 1 - y / H;
          var idx = Math.round(lo + (hi - lo) * Math.pow(t, 1.6));
          var v = (bins[idx] || 0) / 255;
          var e = v * v * (3 - 2 * v);
          // Ground (paper) -> trace (ink) ramp, per the active theme.
          var r = bg[0] + Math.round((fg[0] - bg[0]) * e);
          var g = bg[1] + Math.round((fg[1] - bg[1]) * e);
          var b = bg[2] + Math.round((fg[2] - bg[2]) * e);
          ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
          ctx.fillRect(W - 1, y, 1, 1);
        }
        specRaf = requestAnimationFrame(tick);
      }
      tick();
    }

    // Paint the spectrogram in its quiet/initial state.
    (function () {
      var ctx = spectroEl.getContext('2d');
      var paper = getComputedStyle(document.documentElement)
        .getPropertyValue('--paper-2').trim() || '#efe8d8';
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, spectroEl.width, spectroEl.height);
    })();

    liveBtn.addEventListener('click', function (ev) {
      // Important: stop the click from propagating up to the
      // document-level "click outside drawer" handler, which would
      // close the dropdown.
      ev.stopPropagation();
      var on = liveBox.getAttribute('data-on') === 'true';
      if (on) { setStatus(''); stopAudio(); return; }
      liveBox.setAttribute('data-on', 'true');
      liveBtn.innerHTML = stopIcon + '<span>stop</span>';
      setStatus('connecting...');
      startAudio()
        .then(function () { setStatus('streaming from pi'); attachSpectrogram(); })
        .catch(function (err) {
          stopAudio();
          var msg = (err && err.message) || 'stream unavailable';
          if (msg.indexOf('NotAllowed') !== -1 || msg.indexOf('user') !== -1) {
            setStatus('browser blocked autoplay - tap listen again', true);
          } else {
            setStatus(msg, true);
          }
        });
    });
  }

  // Pending changes (key -> value), saved on click of the Save button.
  var pending = {};

  function setSaveState(msg, cls) {
    var el = document.getElementById('saveState');
    if (el) { el.textContent = msg || ''; el.className = 'save-state' + (cls ? ' ' + cls : ''); }
    var btn = document.getElementById('saveBtn');
    if (btn) btn.disabled = Object.keys(pending).length === 0;
  }

  function loadSettings() {
    fetch('./avian/api/config.php', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (cfg) {
        var v = cfg.values || {};
        var preserve = cfg.preserve;
        var html = ''
          + settingsToggle('preserve', 'Preserve all recordings', "don't auto-delete", preserve)
          + settingsSlider('CONFIDENCE',  'Confidence threshold', 'min score to log a detection', v.CONFIDENCE,  0.1, 0.95, 0.05, 2)
          + settingsSlider('SENSITIVITY', 'Sensitivity',          'analyzer sensitivity',          v.SENSITIVITY, 0.5, 1.5,  0.05, 2)
          + settingsSlider('OVERLAP',     'Chunk overlap',        'seconds analyzed per pass',     v.OVERLAP,     0,   2.5,  0.1,  1)
          + settingsSegmented('FULL_DISK', 'When disk fills', '', v.FULL_DISK, [
              { v: 'keep',  label: 'keep' },
              { v: 'purge', label: 'purge' },
            ])
          + '<div class="menu-save-row">'
          + '  <span class="save-state" id="saveState"></span>'
          + '  <button type="button" id="saveBtn" disabled>save</button>'
          + '</div>';
        var body = document.getElementById('settingsBody');
        if (body) body.innerHTML = html;
        wireSettingsControls();
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveSettings);
      })
      .catch(function (err) {
        var body = document.getElementById('settingsBody');
        if (body) body.innerHTML =
          '<div class="menu-row"><span class="label">Failed to load <small class="hint">' + err + '</small></span></div>';
      });
  }

  function settingsToggle(key, label, hint, on) {
    return ''
      + '<div class="menu-row">'
      + '  <div><span class="label">' + label + '</span>'
      +     (hint ? '<span class="hint">' + hint + '</span>' : '')
      + '  </div>'
      + '  <button type="button" class="switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-key="' + key + '"></button>'
      + '</div>';
  }
  function settingsSlider(key, label, hint, val, min, max, step, digits) {
    return ''
      + '<div class="slider-row">'
      + '  <div class="head">'
      + '    <div class="label-block">'
      + '      <span class="label">' + label + '</span>'
      +       (hint ? '<span class="hint">' + hint + '</span>' : '')
      + '    </div>'
      + '    <span class="value" data-value-for="' + key + '">' + (+val).toFixed(digits) + '</span>'
      + '  </div>'
      + '  <div class="slider-track">'
      + '    <input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-key="' + key + '" data-digits="' + digits + '">'
      + '  </div>'
      + '</div>';
  }
  function settingsSegmented(key, label, hint, val, opts) {
    var btns = opts.map(function (o) {
      return '<button type="button" data-v="' + o.v + '" aria-current="' + (o.v === val ? 'true' : 'false') + '">' + o.label + '</button>';
    }).join('');
    return ''
      + '<div class="menu-row">'
      + '  <div><span class="label">' + label + '</span>'
      +     (hint ? '<span class="hint">' + hint + '</span>' : '')
      + '  </div>'
      + '  <div class="seg" data-key="' + key + '">' + btns + '</div>'
      + '</div>';
  }
  function wireSettingsControls(scope) {
    scope = scope || document;
    scope.querySelectorAll('.switch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        var on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        pending[sw.dataset.key] = on;
        setSaveState('change pending');
      });
    });
    scope.querySelectorAll('input[type="range"]').forEach(function (sl) {
      sl.addEventListener('input', function () {
        var v = +sl.value;
        var digits = +sl.dataset.digits || 2;
        var label = scope.querySelector('[data-value-for="' + sl.dataset.key + '"]');
        if (label) label.textContent = v.toFixed(digits);
        pending[sl.dataset.key] = v;
        setSaveState('change pending');
      });
    });
    scope.querySelectorAll('.seg:not([data-theme-seg])').forEach(function (seg) {
      seg.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
          pending[seg.dataset.key] = b.dataset.v;
          setSaveState('change pending');
        });
      });
    });
  }

  function saveSettings() {
    if (Object.keys(pending).length === 0) return;
    var body = JSON.stringify(pending);
    setSaveState('saving...');
    fetch('./avian/api/config.php', {
      method: 'POST', body: body,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) {
          pending = {};
          setSaveState('saved ✓', 'ok');
          setTimeout(function () { setSaveState(''); }, 1800);
        } else {
          setSaveState('save failed', 'err');
        }
      })
      .catch(function () { setSaveState('network error', 'err'); });
  }

  // ---- Hash routing + atlas detail modal ----
  // When a collage tile or stats row is clicked it sets
  // location.hash = '#sci=<name>'. On arrival we switch to the atlas
  // view, highlight the matching card, AND open the detail modal with
  // expanded info (Wikipedia summary, taxonomy, all past recordings).
  function readHash() {
    var m = location.hash.match(/^#sci=([^&]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  }
  function highlightAtlas(sci) {
    var grid = document.getElementById('atlasGrid');
    if (!grid) return;
    grid.querySelectorAll('.bird-card[data-active="true"]').forEach(function (c) {
      c.removeAttribute('data-active');
    });
    if (!sci) return;
    var attempts = 0;
    (function find() {
      var card = grid.querySelector('.bird-card[data-sci="' + sci.replace(/"/g, '\"') + '"]');
      if (!card) {
        if (attempts++ < 10) return setTimeout(find, 80);
        return;
      }
      card.setAttribute('data-active', 'true');
      card.setAttribute('data-pulse', 'true');
      setTimeout(function () { card.removeAttribute('data-pulse'); }, 520);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })();
  }

  // ---- Detail modal ----
  // Caches per-sci species info so opening the same modal twice doesn't
  // re-fetch. Wikipedia + per-species endpoints are slow over the
  // tunnel; one fetch per session is plenty.
  var SPECIES_CACHE = {};
  var WIKI_CACHE = {};
  var modalAudio = null;
  var modalRecBtn = null;
  var __modalSci = null;   // species currently shown in the detail modal
  function fmtRecTime(d, t) {
    // Either a date "2026-05-15" with a separate time t="20:25:29", or a
    // single full timestamp that already carries its own time - e.g.
    // "2026-07-09T04:47:17+02:00" (ISO, offset) or "2026-07-09 04:47:17".
    // When d already holds a time, parse the whole string; otherwise the
    // ISO 'T'/offset would be mangled by appending 'T'+t.
    if (!d) return '-';
    var date = /[T ]\d\d:/.test(d) ? new Date(d) : new Date((d || '') + 'T' + (t || '00:00:00'));
    if (isNaN(date.getTime())) return t ? (d + ' ' + t) : d;
    var now = Date.now();
    var ago = Math.floor((now - date.getTime()) / 1000);
    if (ago < 60) return relTimeAgo(ago, 'second', ago + 's ago');
    var mins = Math.floor(ago / 60);
    if (ago < 3600) return relTimeAgo(mins, 'minute', mins + 'm ago');
    var hrs = Math.floor(ago / 3600);
    if (ago < 86400) return relTimeAgo(hrs, 'hour', hrs + 'h ago');
    var days = Math.floor(ago / 86400);
    return relTimeAgo(days, 'day', days + 'd ago');
  }
  function fmtDateLine(d, t) {
    if (!d) return '';
    try {
      var date = new Date(d + 'T' + (t || '00:00:00'));
      return date.toLocaleDateString(BCP47, { month: 'short', day: 'numeric' }) +
        ' · ' + (t ? t.slice(0, 5) : '');
    } catch (e) { return d + ' ' + (t || ''); }
  }
  function rarityLabel(total, firstSeenIso) {
    if (!total) return '-';
    var days = 1;
    if (firstSeenIso) {
      var t = Date.parse((firstSeenIso || '').replace(' ', 'T'));
      if (!isNaN(t)) days = Math.max(1, Math.ceil((Date.now() - t) / 86400000));
    }
    var perDay = total / days;
    if (perDay >= 5) return 'common';
    if (perDay >= 1) return 'regular';
    if (perDay >= 0.2) return 'occasional';
    return 'rare';
  }
  // rAF-driven cursor smoothing. timeupdate fires ~4Hz which feels
  // janky; we sample audio.currentTime every animation frame and
  // interpolate to a 60Hz update so the playback knob glides.
  var modalCursorRaf = null;
  function startCursorLoop() {
    if (modalCursorRaf) return;
    var tick = function () {
      if (!modalAudio || !modalRecBtn) { modalCursorRaf = null; return; }
      var row = modalRecBtn.closest('.rec-row');
      if (row && modalAudio.duration) {
        var strip = row.querySelector('.rec-spectro');
        var played = strip && strip.querySelector('.rec-spectro-played');
        var cursor = strip && strip.querySelector('.rec-spectro-cursor');
        var pct = (modalAudio.currentTime / modalAudio.duration) * 100;
        if (played) played.style.width = pct.toFixed(3) + '%';
        if (cursor) cursor.style.left = pct.toFixed(3) + '%';
      }
      modalCursorRaf = requestAnimationFrame(tick);
    };
    modalCursorRaf = requestAnimationFrame(tick);
  }
  function stopCursorLoop() {
    if (modalCursorRaf) { cancelAnimationFrame(modalCursorRaf); modalCursorRaf = null; }
  }

  // Pause the currently-playing modal recording but KEEP the audio
  // element alive so the user can scrub (audio.currentTime is still
  // mutable on a paused element) and then resume from the same spot.
  // The cursor stays visible at its last position.
  function pauseModalAudio() {
    stopCursorLoop();
    if (modalAudio) { try { modalAudio.pause(); } catch (e) {} }
    if (modalRecBtn) {
      modalRecBtn.removeAttribute('data-active');
      modalRecBtn.innerHTML = ICON_PLAY;
    }
  }
  // Hard-stop: pause + tear down the audio + clear cursor. Used when
  // switching rows or closing the modal.
  function stopModalAudio() {
    audioRelease(stopModalAudio);
    stopCursorLoop();
    if (modalAudio) { try { modalAudio.pause(); } catch (e) {} modalAudio = null; }
    if (modalRecBtn) {
      var prevRow = modalRecBtn.closest('.rec-row');
      if (prevRow) {
        var strip = prevRow.querySelector('.rec-spectro');
        if (strip) {
          strip.classList.remove('armed');
          var played = strip.querySelector('.rec-spectro-played');
          var cur = strip.querySelector('.rec-spectro-cursor');
          if (played) played.style.width = '0%';
          if (cur) cur.style.left = '0%';
        }
      }
      modalRecBtn.removeAttribute('data-active');
      modalRecBtn.innerHTML = ICON_PLAY;
      modalRecBtn = null;
    }
  }

  // ---- Reference-call playback ----
  // Plays the Xeno-Canto reference call resolved by resolveReferenceCall.
  // Shares the single-audio coordinator so starting it pauses any
  // capture / live stream and vice versa. Reference recordings play at
  // normal volume, so - unlike the quiet detection clips - they skip the
  // WebAudio boost (which also avoids needing CORS on the XC media CDN).
  var refAudio = null;
  var refBtn = null;       // the modal "reference call" button, when used
  var __refSci = null;     // species whose ref call is loaded (modal or tap)
  function _refBtnLabel(icon) { return icon + '<span>reference call</span>'; }
  function stopRefCall() {
    audioRelease(stopRefCall);
    if (refAudio) { try { refAudio.pause(); } catch (e) {} refAudio = null; }
    if (refBtn) {
      refBtn.removeAttribute('data-active');
      refBtn.classList.remove('loading');
      refBtn.innerHTML = _refBtnLabel(ICON_PLAY);
      refBtn = null;
    }
    __refSci = null;
  }
  // Play the first candidate that loads; fall through to the next if one
  // won't play in the browser. onCredit(info) fires for the candidate
  // being attempted; onAllFail() when none of them play. Plain <audio>
  // (no boost / no crossOrigin): XC media plays fine direct.
  function _playRefCandidates(cands, idx, onPlaying, onAllFail) {
    idx = idx || 0;
    if (!cands || idx >= cands.length) { if (onAllFail) onAllFail(); return; }
    var info = cands[idx];
    var audio = new Audio(info.url);
    refAudio = audio;
    var moved = false;
    function advance() {
      if (moved || refAudio !== audio) return;   // already moved / superseded
      moved = true;
      clearTimeout(stallT);
      try { audio.pause(); } catch (e) {}
      _playRefCandidates(cands, idx + 1, onPlaying, onAllFail);
    }
    // A dead URL usually fires 'error' (we move on), but some hang or
    // return non-audio with no event at all - so also move on if nothing
    // has started playing within a few seconds. Short reference calls
    // start well under this, so a real one is never skipped.
    var stallT = setTimeout(advance, 6000);
    audio.addEventListener('ended', stopRefCall);
    // Credit the recording that ACTUALLY plays - not each one we skip
    // past - so the attribution never flickers through dead candidates.
    audio.addEventListener('playing', function () {
      clearTimeout(stallT);
      if (refAudio === audio && onPlaying) onPlaying(info);
    });
    audio.addEventListener('error', function () {
      if (refAudio !== audio) return;   // superseded by a newer play
      try { console.warn('[bird-card] ref call would not play, trying next:', info.url); } catch (e) {}
      advance();
    });
    audio.play().catch(function () { /* autoplay policy: needs a gesture */ });
  }
  // Map a resolve error to a user-facing line - distinguishes "none
  // exist", rate-limit, and other HTTP errors so the cause is obvious.
  function _refErrMsg(err) {
    var m = String((err && err.message) || err || '');
    if (/no recording/.test(m)) return tt('refcall.none');
    if (/xc-http-429/.test(m)) return tt('refcall.busy');
    var code = (m.match(/xc-http-(\d+)/) || [])[1];
    return code ? tt('refcall.unavailableCode', { code: code }) : tt('refcall.unavailable');
  }
  // Per-species memory of the recording that actually played, so repeat
  // presses (and later sessions) skip straight to it instead of falling
  // through the dead candidates again. Stored in localStorage by slug.
  function _refSaveWorking(sci, info) {
    if (info && info.url) writeLS('bird:refcall:' + slugify(sci), JSON.stringify(info));
  }
  function _refCallOrder(sci, cands) {
    var raw = readLS('bird:refcall:' + slugify(sci), '');
    if (!raw) return cands;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return cands; }
    if (!saved || !saved.url) return cands;
    // Known-good recording first; drop its duplicate from the fetched
    // list. If it 404s later, playback falls through as usual and the
    // next winner overwrites the memory.
    return [saved].concat(cands.filter(function (c) { return c.url !== saved.url; }));
  }
  // Modal button: full play / pause toggle, with attribution credit.
  function toggleModalRefCall(btn, sci) {
    if (refBtn === btn && refAudio) {           // same button -> pause/resume
      if (refAudio.paused) {
        audioClaim(stopRefCall);
        refAudio.play().catch(function () {});
        btn.setAttribute('data-active', 'true');
        btn.innerHTML = _refBtnLabel(ICON_PAUSE);
      } else {
        refAudio.pause();
        btn.removeAttribute('data-active');
        btn.innerHTML = _refBtnLabel(ICON_PLAY);
      }
      return;
    }
    stopRefCall();
    stopModalAudio();              // stop a playing capture
    audioClaim(stopRefCall);       // and anything else (atlas / live stream)
    refBtn = btn;
    __refSci = sci;
    btn.classList.add('loading');
    btn.setAttribute('data-active', 'true');
    btn.innerHTML = _refBtnLabel(ICON_PAUSE);
    setRefCredit('');
    resolveReferenceCall(sci).then(function (cands) {
      if (refBtn !== btn) return;  // user moved on
      // Keep the loading state through any fall-through; clear it only
      // when a recording actually starts playing.
      _playRefCandidates(_refCallOrder(sci, cands), 0,
        function (info) { if (refBtn === btn) { btn.classList.remove('loading'); setRefCredit(info, true); _refSaveWorking(sci, info); } },
        function () { if (refBtn === btn) { stopRefCall(); setRefCredit(tt('refcall.cantPlay')); } });
    }).catch(function (err) {
      if (refBtn !== btn) return;
      stopRefCall();
      setRefCredit(_refErrMsg(err));
    });
  }
  // Tap-to-play (tap_action='call'): no modal, just play. Tapping the
  // same bird again restarts it; a different bird switches.
  function tapPlayRefCall(sci) {
    stopRefCall();
    stopModalAudio();
    audioClaim(stopRefCall);
    __refSci = sci;
    resolveReferenceCall(sci).then(function (cands) {
      if (__refSci !== sci) return;
      _playRefCandidates(_refCallOrder(sci, cands), 0,
        function (info) { _refSaveWorking(sci, info); },
        function () { try { console.warn('[bird-card] reference call: no candidate would play for', sci); } catch (e) {} });
    }).catch(function (err) {
      if (__refSci !== sci) return;
      try { console.warn('[bird-card] reference call:', _refErrMsg(err)); } catch (e) {}
    });
  }
  // Attribution line under the Recordings header. Xeno-Canto's CC
  // licenses require crediting the recordist + license. Pass an info
  // object with isInfo=true for a credit; pass a plain string for a
  // status message; pass '' to clear.
  function setRefCredit(infoOrMsg, isInfo) {
    var el = document.getElementById('modalRefCredit');
    if (!el) return;
    if (!infoOrMsg) { el.hidden = true; el.innerHTML = ''; return; }
    if (!isInfo) { el.hidden = false; el.textContent = infoOrMsg; return; }
    var info = infoOrMsg;
    // Only ever link http(s) URLs - never let an unexpected scheme
    // (e.g. javascript:) from the API become a clickable href.
    var httpUrl = function (u) { return /^https?:\/\//i.test(u || '') ? u : ''; };
    var lic = httpUrl(info.lic), page = httpUrl(info.page);
    var html = esc(tt('refcall.credit') + (info.rec ? tt('refcall.recBy', { rec: info.rec }) : ''));
    if (lic) html += ' · <a href="' + esc(lic) + '" target="_blank" rel="noopener">' + esc(tt('refcall.license')) + '</a>';
    if (page) html += ' · <a href="' + esc(page) + '" target="_blank" rel="noopener">XC' + esc(info.id) + '</a>';
    el.hidden = false;
    el.innerHTML = html;
  }

  // Bird-tap dispatcher - the collage and atlas grid route taps here.
  // tap_action picks the info modal (default), the reference call, or
  // both. 'call'/'both' fall back to the modal when no XC key is set.
  function handleBirdTap(sci) {
    if (!sci) return;
    var act = (AV_CFG && AV_CFG.tapAction) || 'info';
    if (act === 'call' && refCallEnabled()) { tapPlayRefCall(sci); return; }
    if (act === 'both') {
      openDetailModal(sci);
      if (refCallEnabled()) {
        var btn = document.getElementById('modalRefCall');
        if (btn) toggleModalRefCall(btn, sci);
      }
      return;
    }
    openDetailModal(sci);   // 'info', or call/both with no key configured
  }

  function sketchSrc(sci, pose) {
    // Bundled static illustration. The modal's HEAD probes hit these same
    // URLs, so a missing pose file 404s and its toggle button hides.
    return assetSrc(sci, +pose || 1) + '?v=' + SKETCH_VERSION;
  }
  function openDetailModal(sci) {
    if (!sci) return;
    var modal = document.getElementById('detail-modal');
    var img = document.getElementById('modalImg');
    var poseToggle = document.getElementById('modalPoseToggle');
    var poseBtns = [].slice.call(poseToggle.querySelectorAll('button'));

    // Reset the toggle: assume nothing's available, set pose 1 (perched
    // cutout - every species has it) as the optimistic default. HEAD
    // probes below toggle each button on/off and pick the best default.
    poseToggle.removeAttribute('data-unavailable');
    poseBtns.forEach(function (b) {
      b.setAttribute('data-unavailable', 'true');
      b.setAttribute('aria-current', 'false');
    });
    var p1 = poseToggle.querySelector('button[data-pose="1"]');
    if (p1) {
      p1.removeAttribute('data-unavailable');
      p1.setAttribute('aria-current', 'true');
    }
    // Reset the fallback chain - this <img> is reused across modal opens,
    // and a previous species may have ended hidden at the chain's end.
    img.style.visibility = '';
    img.setAttribute('data-slug', slugify(sci));
    img.setAttribute('data-sci', sci);
    img.setAttribute('data-fb', '1');   // perched start: next stop is the photo cutout
    img.onerror = function () { window.__birdImgErr(img); };
    img.src = sketchSrc(sci, 1);
    img.alt = sci;

    // Probe each pose's image with HEAD. Build a list of available
    // poses, then pick the highest-numbered as the default (in-flight
    // > perched, etc.). When only one pose remains, hide the toggle
    // entirely - no choice means no UI.
    var probes = poseBtns.map(function (b) {
      var pose = +b.dataset.pose;
      return fetch(sketchSrc(sci, pose), { method: 'HEAD', cache: 'no-store' })
        .then(function (r) { return { pose: pose, btn: b, ok: r.ok }; })
        .catch(function () { return { pose: pose, btn: b, ok: false }; });
    });
    Promise.all(probes).then(function (results) {
      var available = results.filter(function (r) { return r.ok; });
      available.forEach(function (r) { r.btn.removeAttribute('data-unavailable'); });
      results.filter(function (r) { return !r.ok; }).forEach(function (r) {
        r.btn.setAttribute('data-unavailable', 'true');
      });
      // Default to the highest-numbered available pose (in-flight if
      // present, else fall back to perched).
      var pick = available.sort(function (a, b) { return b.pose - a.pose; })[0];
      if (pick) {
        poseBtns.forEach(function (b) {
          b.setAttribute('aria-current', b === pick.btn ? 'true' : 'false');
        });
        img.src = sketchSrc(sci, pick.pose);
      }
      // Single-option => hide the chrome.
      if (available.length <= 1) {
        poseToggle.setAttribute('data-unavailable', 'true');
      }
      // Slide the white pill to the active button.
      syncPill(poseToggle);
    });
    document.getElementById('modalSci').textContent = sci;
    document.getElementById('modalGenus').textContent = (sci.split(' ')[0] || '-');
    document.getElementById('modalCommon').textContent = '-';
    document.getElementById('modalAllTime').textContent = '-';
    document.getElementById('modalWindow').textContent = '-';
    // Window stat label tracks the picker; the whole stat is hidden for
    // the "all time" window since it would just echo the all-time count.
    var modalWinStat = document.getElementById('modalWindowStat');
    if (currentHours >= 1000000) {
      modalWinStat.style.display = 'none';
    } else {
      modalWinStat.style.display = '';
      document.getElementById('modalWindowLbl').textContent = windowLabel(currentHours);
    }
    document.getElementById('modalFirstSeen').textContent = '-';
    document.getElementById('modalRarity').textContent = '-';
    document.getElementById('modalRarity').classList.remove('rare');
    document.getElementById('modalDesc').textContent = tt('modal.loadingDesc');
    document.getElementById('modalDesc').classList.add('placeholder');
    document.getElementById('modalRecordings').innerHTML = '<li class="rec-empty">' + esc(tt('modal.loadingRecordings')) + '</li>';
    document.getElementById('modalRecCount').textContent = '';
    // Reference-call button: stop any prior playback, reset it, and show
    // it only when an XC key is configured.
    stopRefCall();
    __modalSci = sci;
    var refBtnEl = document.getElementById('modalRefCall');
    if (refBtnEl) {
      refBtnEl.hidden = !refCallEnabled();
      refBtnEl.innerHTML = _refBtnLabel(ICON_PLAY);
      refBtnEl.removeAttribute('data-active');
      refBtnEl.classList.remove('loading');
    }
    setRefCredit('');
    document.getElementById('modalWiki').href = wikiUrl(sci);
    document.getElementById('modalEbird').href = ebirdUrl(sci);
    // FLIP-style morph: scale + translate the modal-card from the
    // clicked atlas card's position to its natural centered size, so
    // the card *expands* into the detail view instead of just fading
    // in. The outer modal MUST become visible (aria-hidden=false)
    // before we apply the initial transform - the browser skips
    // layout for opacity-0 trees, which would freeze the morph at the
    // starting frame.
    var sourceCard = atlasGridEl
      ? atlasGridEl.querySelector('.bird-card[data-sci="' + sci.replace(/"/g, '\"') + '"]')
      : null;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    morphModalOpen(modal.querySelector('.modal-card'), sourceCard);

    // Species detail (lifelist row + every detection).
    var loadSpecies = SPECIES_CACHE[sci]
      ? Promise.resolve(SPECIES_CACHE[sci])
      : fetchJson('./avian/api/birdnet-api.php?action=species&sci=' + encodeURIComponent(sci)).then(function (j) {
          SPECIES_CACHE[sci] = j;
          return j;
        });
    loadSpecies.then(function (j) {
      var s = j.summary || {};
      document.getElementById('modalCommon').textContent = s.com || sci;
      document.getElementById('modalAllTime').textContent = fmtN(+s.total || 0);
      var winRow = ((DATA.recent && DATA.recent.species) || []).filter(function (x) { return x.sci === sci; })[0];
      document.getElementById('modalWindow').textContent = fmtN(winRow ? +winRow.n : 0);
      document.getElementById('modalFirstSeen').textContent = s.first_seen ? fmtRecTime(s.first_seen) : '-';
      var rar = rarityLabel(+s.total || 0, s.first_seen);
      var rarEl = document.getElementById('modalRarity');
      rarEl.textContent = rar === '-' ? '-' : tt('rarity.' + rar);
      if (rar === 'rare') rarEl.classList.add('rare');
      var dets = j.detections || [];
      document.getElementById('modalRecCount').textContent = tt('modal.captured', { n: dets.length });
      document.getElementById('modalRecordings').innerHTML = dets.length
        ? dets.map(function (d) {
            return '<li class="rec-row" data-file="' + esc(d.file || '') + '" data-date="' + esc(d.d || '') + '">'
              + '<button class="play" type="button" aria-label="' + esc(tt('modal.play')) + '">' + ICON_PLAY + '</button>'
              + '<span class="when">' + esc(fmtRecTime(d.d, d.t)) + '<small>' + esc(fmtDateLine(d.d, d.t)) + '</small></span>'
              // Review write-back needs a detection id - present with the
              // API data source, absent over MQTT history. Sits just left
              // of the confidence; a ghost x that arms on first tap.
              + (d.file ? '<button class="flag" type="button" data-state="idle" title="' + esc(tt('flag.report')) + '" aria-label="' + esc(tt('flag.report')) + '">\u2715</button>' : '')
              + '<span class="conf">' + ((+d.conf || 0) * 100).toFixed(0) + '%</span>'
              + '<div class="rec-spectro" aria-hidden="true">'
              +   '<div class="rec-spectro-loading">' + esc(tt('spectro.loading')) + '</div>'
              +   '<div class="rec-spectro-played"></div>'
              +   '<div class="rec-spectro-cursor"></div>'
              +   '<div class="rec-spectro-scrub" role="slider" aria-label="' + esc(tt('modal.scrub')) + '" tabindex="0"></div>'
              + '</div>'
              + '</li>';
          }).join('')
        : '<li class="rec-empty">' + esc(tt('modal.noRecordings')) + '</li>';
    }).catch(function () {
      document.getElementById('modalRecordings').innerHTML = '<li class="rec-empty">' + esc(tt('modal.recordingsFailed')) + '</li>';
    });

    // Wikipedia summary (description + genus / family). Cached per
    // scientific name AND resolved wiki language (language is fixed per
    // session, but the compound key is future-proof).
    var wikiKey = sci + '|' + WIKI_LANG;
    var loadWiki = WIKI_CACHE[wikiKey]
      ? Promise.resolve(WIKI_CACHE[wikiKey])
      : fetchJson('./avian/api/wiki.php?sci=' + encodeURIComponent(sci)).then(function (j) {
          WIKI_CACHE[wikiKey] = j; return j;
        });
    loadWiki.then(function (j) {
      var desc = document.getElementById('modalDesc');
      desc.textContent = j.extract || 'No description available.';
      desc.classList.toggle('placeholder', !j.extract);
      // Point the external link at the article the extract came from,
      // preferring the summary response's own url/title when present so a
      // localized (or English-fallback) fetch lands on the matching wiki.
      if (sci === __modalSci) {
        var wEl = document.getElementById('modalWiki');
        if (wEl) {
          if (j.url) wEl.href = j.url;
          else if (j.title) wEl.href = wikiUrl(j.title, j.lang || WIKI_LANG);
        }
      }
    }).catch(function () {
      var desc = document.getElementById('modalDesc');
      desc.textContent = 'No description available.';
      desc.classList.add('placeholder');
    });
  }
  function closeDetailModal() {
    var modal = document.getElementById('detail-modal');
    stopModalAudio();
    stopRefCall();
    // Reverse-morph back into the source atlas card so the modal
    // appears to *retract* to where it came from. Look the card up
    // fresh - the user may have switched the time window or sort
    // since opening the modal, so the source card may have moved.
    var sci = (document.getElementById('modalSci').textContent || '').trim();
    var sourceCard = sci && atlasGridEl
      ? atlasGridEl.querySelector('.bird-card[data-sci="' + sci.replace(/"/g, '\"') + '"]')
      : null;
    morphModalClose(modal.querySelector('.modal-card'), sourceCard, function () {
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  }

  // Shared-element morph: the modal-card scales+translates from the
  // clicked atlas card's exact rect to its natural centred rect, so the
  // little card appears to expand into the big one (and retract on
  // close). Only the card transforms; the container's opacity does the
  // single fade for backdrop + card together - no double-fade, and the
  // transform is cleared only once hidden so there's no mid-close snap.
  var atlasGridEl = document.getElementById('atlasGrid');
  function morphTransform(modalCard, sourceCard) {
    if (!modalCard || !sourceCard) return null;
    var s = sourceCard.getBoundingClientRect();
    // Source off-screen (opened from stats mid-slide, or scrolled away)
    // -> skip the morph and just fade, rather than fly in from nowhere.
    if (!s.width || s.bottom < 0 || s.top > window.innerHeight ||
        s.right < 0 || s.left > window.innerWidth) return null;
    var m = modalCard.getBoundingClientRect();
    if (!m.width) return null;
    var scale = Math.max(0.1, s.width / m.width);
    var dx = (s.left + s.width / 2) - (m.left + m.width / 2);
    var dy = (s.top + s.height / 2) - (m.top + m.height / 2);
    return 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) scale(' + scale.toFixed(4) + ')';
  }
  // Run cb once the transform transition finishes, with a timeout
  // fallback for environments where transitionend doesn't fire.
  function onceTransformEnd(el, cb, fallbackMs) {
    var fired = false;
    function handler(ev) {
      if (ev && ev.propertyName && ev.propertyName !== 'transform') return;
      if (fired) return;
      fired = true;
      el.removeEventListener('transitionend', handler);
      cb();
    }
    el.addEventListener('transitionend', handler);
    setTimeout(handler, fallbackMs);
  }
  function morphModalOpen(modalCard, sourceCard) {
    var modal = document.getElementById('detail-modal');
    if (!modalCard) { modal.classList.add('is-open'); return; }
    // Identity first so we can measure the card's natural rect, then jump
    // it (no transition) to the source card's position + scale.
    modalCard.classList.remove('is-morphing');
    modalCard.style.transform = '';
    void modalCard.offsetWidth;
    var start = morphTransform(modalCard, sourceCard);
    if (start) {
      modalCard.style.transform = start;
      void modalCard.offsetWidth;
    }
    // Next tick: fade the container in and glide the card to identity.
    // setTimeout (not rAF) - rAF can stall in non-painting/headless
    // contexts; the forced reflow above already commits the start
    // transform so the transition interpolates cleanly from it.
    setTimeout(function () {
      modal.classList.add('is-open');
      if (start) {
        modalCard.classList.add('is-morphing');
        modalCard.style.transform = 'translate3d(0,0,0) scale(1)';
      }
    }, 0);
    if (start) {
      onceTransformEnd(modalCard, function () {
        modalCard.classList.remove('is-morphing');
        modalCard.style.transform = '';
      }, 360);
    }
  }
  function morphModalClose(modalCard, sourceCard, done) {
    var modal = document.getElementById('detail-modal');
    // Fade the container out (backdrop + card) and retract the card to
    // the source rect at the same time.
    modal.classList.remove('is-open');
    var end = modalCard ? morphTransform(modalCard, sourceCard) : null;
    var finish = function () {
      if (modalCard) {
        modalCard.classList.remove('is-morphing');
        modalCard.style.transform = '';
      }
      if (done) done();
    };
    if (modalCard && end) {
      modalCard.classList.add('is-morphing');
      void modalCard.offsetWidth;
      modalCard.style.transform = end;
      onceTransformEnd(modalCard, finish, 360);
    } else {
      // No morph -> let the container opacity fade run, then hide.
      setTimeout(finish, 280);
    }
  }

  // The narrow-layout description is clamped to a few lines - tapping
  // it toggles the full text.
  var __descEl = document.getElementById('modalDesc');
  if (__descEl) {
    __descEl.addEventListener('click', function () {
      __descEl.classList.toggle('expanded');
    });
  }

  // Pose toggle inside the modal - swaps the sketch between perched
  // (default) and in-flight alt pose. A short opacity transition makes
  // the swap feel intentional rather than a hard cut.
  document.getElementById('modalPoseToggle').addEventListener('click', function (ev) {
    var toggle = document.getElementById('modalPoseToggle');
    var btn = ev.target.closest && ev.target.closest('button');
    if (!btn || btn.getAttribute('data-unavailable') === 'true') return;
    // Doubles as a toggle: this control's two buttons tile its whole width,
    // so there's no open space for wireToggleAdvance to catch. Clicking the
    // already-active pose therefore advances to the other available one.
    if (btn.getAttribute('aria-current') === 'true') {
      var avail = [].slice.call(toggle.querySelectorAll('button')).filter(function (b) {
        return !b.disabled && b.getAttribute('data-unavailable') !== 'true';
      });
      if (avail.length < 2) return;   // only one pose exists - nothing to flip to
      btn = avail[(avail.indexOf(btn) + 1) % avail.length];
    }
    var pose = +btn.dataset.pose;
    [].slice.call(toggle.querySelectorAll('button')).forEach(function (b) {
      b.setAttribute('aria-current', b === btn ? 'true' : 'false');
    });
    syncPill(toggle);
    var img = document.getElementById('modalImg');
    var sci = document.getElementById('modalSci').textContent;
    img.classList.add('swapping');
    setTimeout(function () {
      img.src = sketchSrc(sci, pose);
      img.addEventListener('load', function once() {
        img.classList.remove('swapping');
        img.removeEventListener('load', once);
      });
    }, 180);
  });

  // Expose for debugging during dev - also lets the modal be opened
  // from outside the IIFE if needed.
  window.__openDetailModal = openDetailModal;
  window.__closeDetailModal = closeDetailModal;

  // Reference-call button in the detail modal: play/compare the canonical
  // Xeno-Canto call against the station's own captures listed beside it.
  (function () {
    var refBtnEl = document.getElementById('modalRefCall');
    if (refBtnEl) {
      refBtnEl.addEventListener('click', function () {
        if (__modalSci) toggleModalRefCall(refBtnEl, __modalSci);
      });
    }
  })();

  // ===== Admin overlay (settings / system / logs / tools) =====
  // Lives in the same shell as the rest of the app - the menu button
  // and return-to-atlas pill stay put. The slider hides; this overlay
  // takes over the body. Navigation is via the drawer menu, NOT
  // internal tabs (the drawer is the canonical nav surface).
  var adminEl = document.getElementById('adminScreen');
  var adminBody = document.getElementById('adminBody');
  var adminTitle = document.getElementById('adminTitle');
  var adminPollT = null;
  var adminSect = null;
  var ADMIN_TITLES = {
    settings: 'Settings',
    system: 'System',
    logs: 'Logs',
    tools: 'Tools',
  };
  function adminEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function adminFmtBytes(n) {
    if (!n) return '0 B';
    var u = ['B','KB','MB','GB','TB'];
    var i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(n < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
  }
  function adminFmtAge(s) {
    if (s == null) return '-';
    if (s < 60) return s + 's';
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
  }
  // Admin endpoints rely on the session cookie set by /api/auth/login -
  // no Authorization header needed (and nothing sensitive in JS-readable
  // storage). credentials: 'same-origin' is the default but spelled out
  // for clarity.
  function adminApi(url) {
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  }
  function openAdmin(section) {
    document.body.classList.add('admin-on');
    adminEl.setAttribute('aria-hidden', 'false');
    adminTitle.textContent = ADMIN_TITLES[section] || section;
    if (adminPollT) { clearInterval(adminPollT); adminPollT = null; }
    adminSect = section;
    if (section === 'settings') renderAdminSettings();
    else if (section === 'system') renderAdminSystem();
    else if (section === 'logs') renderAdminLogs();
    else if (section === 'tools') renderAdminTools();
  }
  function closeAdmin() {
    document.body.classList.remove('admin-on');
    adminEl.setAttribute('aria-hidden', 'true');
    if (adminPollT) { clearInterval(adminPollT); adminPollT = null; }
    adminSect = null;
  }

  function adminCard(title, value, sub, cls) {
    return '<div class="admin-card ' + (cls || '') + '">'
      + '<h3>' + adminEsc(title) + '</h3>'
      + '<div class="v">' + adminEsc(value) + '</div>'
      + (sub ? '<div class="sub">' + adminEsc(sub) + '</div>' : '')
      + '</div>';
  }
  function adminUnreachableHtml(reason) {
    return '<div class="admin-unreachable">Pi unreachable - ' + adminEsc(reason || 'no data') + '</div>';
  }

  function renderAdminSettings() {
    adminBody.innerHTML = '<p style="font:11px ui-monospace,monospace;color:var(--ink-soft);text-align:center">loading settings...</p>';
    fetch('./avian/api/config.php', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (cfg) {
        var v = cfg.values || {};
        var preserve = cfg.preserve;
        adminBody.innerHTML =
          '<div class="admin-settings">'
          + settingsToggle('preserve', 'Preserve all recordings', "don't auto-delete", preserve)
          + settingsSlider('CONFIDENCE',  'Confidence threshold', 'min score to log a detection', v.CONFIDENCE,  0.1, 0.95, 0.05, 2)
          + settingsSlider('SENSITIVITY', 'Sensitivity',          'analyzer sensitivity',          v.SENSITIVITY, 0.5, 1.5,  0.05, 2)
          + settingsSlider('OVERLAP',     'Chunk overlap',        'seconds analyzed per pass',     v.OVERLAP,     0,   2.5,  0.1,  1)
          + settingsSegmented('FULL_DISK', 'When disk fills', '', v.FULL_DISK, [
              { v: 'keep',  label: 'keep' },
              { v: 'purge', label: 'purge' },
            ])
          + '<div class="menu-save-row">'
          + '  <span class="save-state" id="saveState"></span>'
          + '  <button type="button" id="saveBtn" disabled>save</button>'
          + '</div>'
          + '</div>';
        wireSettingsControls(adminBody);
        adminBody.querySelectorAll('.seg').forEach(wireToggleAdvance);   // open-space advance
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveSettings);
      })
      .catch(function (err) {
        adminBody.innerHTML = adminUnreachableHtml('settings load failed (' + err + ')');
      });
  }

  function renderAdminSystem() {
    adminBody.innerHTML = '<p style="font:11px ui-monospace,monospace;color:var(--ink-soft);text-align:center">loading...</p>';
    function tick() {
      adminApi('./avian/api/birdnet-status.php?action=diag')
        .then(function (r) { return r.text().then(function (raw) { return { status: r.status, raw: raw }; }); })
        .then(function (res) {
          var j = null;
          try { j = JSON.parse(res.raw); } catch (e) {}
          if (res.status !== 200 || !j) {
            adminBody.innerHTML = adminUnreachableHtml(
              !j ? 'birdnet-status.php not installed on the pi' : (j.error || 'HTTP ' + res.status)
            );
            return;
          }
          adminBody.innerHTML = adminSystemMarkup(j);
          wireAdminRestarts();
        })
        .catch(function (e) { adminBody.innerHTML = adminUnreachableHtml(e.message); });
    }
    tick();
    adminPollT = setInterval(tick, 6000);
  }
  function adminSystemMarkup(j) {
    var sys = j.system || {}, svc = j.services || {}, recLogs = j.recent_logs || {};
    var stream = sys.stream_data || {}, db = sys.birds_db || {};
    var streamAlert = !stream.exists || stream.newest_age_s == null || stream.newest_age_s > 600;
    var dbAlert = db.exists && db.modified_s > 3600;
    var keySvcs = ['birdnet_recording', 'birdnet_analysis', 'birdnet_log'];
    var dead = keySvcs.filter(function (n) { return svc[n] && svc[n].active !== 'active'; });
    var html = '<div class="admin-grid">';
    html += adminCard('recording pipeline', dead.length === 0 ? 'live' : (dead.length + ' down'),
      dead.length === 0 ? 'all services active' : dead.join(', '),
      dead.length === 0 ? '' : 'alert');
    html += adminCard('newest live audio',
      stream.newest_age_s == null ? 'no chunks' : adminFmtAge(stream.newest_age_s) + ' ago',
      stream.newest_name || '',
      streamAlert ? 'alert' : '');
    html += adminCard('birds.db updated',
      db.exists ? adminFmtAge(db.modified_s) + ' ago' : 'missing',
      db.mtime || '',
      dbAlert ? 'warn' : '');
    html += adminCard('uptime', (sys.uptime || {}).pretty || '-',
      'load ' + ((sys.uptime || {}).load || []).map(function (n) { return n.toFixed(2); }).join(' / '));
    html += adminCard('cpu temp',
      sys.temp_c != null ? sys.temp_c.toFixed(1) + '°C' : '-',
      sys.hostname + ' · ' + sys.kernel,
      sys.temp_c != null && sys.temp_c > 75 ? 'warn' : '');
    html += adminCard('memory used', sys.mem ? sys.mem.used_pct + '%' : '-',
      sys.mem ? adminFmtBytes(sys.mem.used_bytes) + ' / ' + adminFmtBytes(sys.mem.total_bytes) : '',
      sys.mem && sys.mem.used_pct > 92 ? 'warn' : '');
    html += adminCard('disk (birdsongs)', sys.disk_birds ? sys.disk_birds.used_pct + '%' : '-',
      sys.disk_birds ? adminFmtBytes(sys.disk_birds.total_bytes - sys.disk_birds.free_bytes) + ' / ' + adminFmtBytes(sys.disk_birds.total_bytes) : '',
      sys.disk_birds && sys.disk_birds.used_pct > 92 ? 'warn' : '');
    var audio = sys.audio || {}, cards = audio.arecord_l || [];
    var mic = cards.find ? cards.find(function (c) { return /usb-audio|microphone|mic/i.test(c); }) : null;
    // Without a USB mic, /proc/asound/cards only lists the Pi's HDMI
    // audio outputs - which aren't an input source. Flag that clearly
    // rather than showing "audio device: vc4hdmi0" as if it were a mic.
    html += adminCard('audio device',
      mic || (cards.length ? 'no microphone attached' : 'no audio devices'),
      mic ? '' : (cards[0] || ''),
      mic ? '' : 'warn');
    html += '</div>';

    html += '<h2 class="admin-section-head">services</h2>';
    html += '<table class="admin-tbl"><thead><tr><th>unit</th><th>state</th><th>enabled</th><th>since</th><th></th></tr></thead><tbody>';
    Object.keys(svc).forEach(function (name) {
      var s = svc[name];
      var pill = (s.active === 'active') ? 'active' : (s.active === 'failed' ? 'failed' : 'inactive');
      html += '<tr>'
        + '<td>' + adminEsc(name) + '</td>'
        + '<td><span class="pill ' + pill + '">' + adminEsc(s.active) + '</span></td>'
        + '<td>' + adminEsc(s.enabled) + '</td>'
        + '<td>' + adminEsc(s.since || '-') + '</td>'
        + '<td><button class="restart" data-unit="' + adminEsc(name) + '">restart</button></td>'
        + '</tr>';
    });
    html += '</tbody></table>';

    var conf = (sys.conf || {}).values || {};
    var rows = Object.keys(conf).map(function (k) {
      return '<tr><td>' + adminEsc(k) + '</td><td>' + adminEsc(conf[k]) + '</td></tr>';
    }).join('');
    if (rows) {
      html += '<h2 class="admin-section-head">birdnet.conf</h2>';
      html += '<table class="admin-tbl"><tbody>' + rows + '</tbody></table>';
    }
    if (Object.keys(recLogs).length) {
      html += '<h2 class="admin-section-head">recent journal</h2>';
      Object.keys(recLogs).forEach(function (u) {
        html += '<h3 style="font:9.5px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin:12px 0 6px">' + adminEsc(u) + '</h3>';
        html += '<div class="admin-logs-pane">' + adminEsc(recLogs[u] || '(empty)') + '</div>';
      });
    }
    return html;
  }
  function wireAdminRestarts() {
    adminBody.querySelectorAll('button.restart').forEach(function (b) {
      b.addEventListener('click', function () {
        var unit = b.dataset.unit;
        if (!confirm('Restart ' + unit + '?')) return;
        b.disabled = true; var old = b.textContent; b.textContent = '...';
        fetch('./avian/api/birdnet-status.php?action=restart&unit=' + encodeURIComponent(unit), {
          method: 'POST', credentials: 'same-origin',
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            b.textContent = j.ok ? 'ok' : 'fail';
            setTimeout(function () { b.disabled = false; b.textContent = old; renderAdminSystem(); }, 1200);
          })
          .catch(function () { b.textContent = 'err'; b.disabled = false; setTimeout(function () { b.textContent = old; }, 1500); });
      });
    });
  }

  function renderAdminLogs() {
    var unit = 'birdnet_recording', lines = 120, autoScroll = true;
    adminBody.innerHTML =
      '<div class="admin-logs-toolbar">'
      + '  <label>unit</label><select id="adminLogsUnit">'
      // php-fpm unit name differs per Debian version (8.2 on Bookworm,
      // 8.4 on Trixie). List all three so the dropdown has the right one
      // regardless of host - birdnet-status.php's ALLOWED_UNITS already
      // skips ones systemd doesn't know about.
      + ['birdnet_recording','birdnet_analysis','birdnet_log','birdnet_stats','spectrogram_viewer','livestream','icecast2','caddy','php8.4-fpm','php8.3-fpm','php8.2-fpm']
          .map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('')
      + '  </select>'
      + '  <label>lines</label><input id="adminLogsLines" type="number" value="120" min="20" max="500" step="20">'
      + '</div>'
      + '<div class="admin-logs-pane" id="adminLogsOut">loading...</div>';
    var pane = document.getElementById('adminLogsOut');
    var sel = document.getElementById('adminLogsUnit');
    var linesIn = document.getElementById('adminLogsLines');
    sel.addEventListener('change', function () { unit = sel.value; tick(); });
    linesIn.addEventListener('change', function () { lines = +linesIn.value || 120; tick(); });
    pane.addEventListener('scroll', function () {
      autoScroll = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 20;
    });
    function tick() {
      adminApi('./avian/api/birdnet-status.php?action=logs&unit=' + encodeURIComponent(unit) + '&lines=' + lines)
        .then(function (r) { return r.text().then(function (raw) { return { status: r.status, raw: raw }; }); })
        .then(function (res) {
          var j = null;
          try { j = JSON.parse(res.raw); } catch (e) {}
          if (res.status !== 200 || !j) {
            pane.textContent = 'pi unreachable - ' + (j && j.error ? j.error : 'no data');
            return;
          }
          pane.textContent = j.text || '(empty)';
          if (autoScroll) pane.scrollTop = pane.scrollHeight;
        });
    }
    tick();
    adminPollT = setInterval(tick, 4000);
  }

  function renderAdminTools() {
    var actions = [
      ['restart birdnet_recording', 'picks up live audio from the mic. restart this first if detections stall.', 'birdnet_recording'],
      ['restart birdnet_analysis',  'runs the neural net on recorded chunks. restart if detections are stuck.', 'birdnet_analysis'],
      ['restart birdnet_log',       'writes the sqlite db. restart if api/stats stops updating.', 'birdnet_log'],
      ['restart spectrogram_viewer','live fft view (legacy) - used by /birdnet/spectrogram.', 'spectrogram_viewer'],
      ['restart livestream',        'icecast feed for the drawer live-audio button.', 'livestream'],
      ['restart icecast2',          'web audio streaming server (fronts livestream).', 'icecast2'],
    ];
    var html = '<div class="admin-actions-grid">';
    actions.forEach(function (a) {
      html += '<div class="admin-action">'
        + '<h4>' + adminEsc(a[0]) + '</h4>'
        + '<p>' + adminEsc(a[1]) + '</p>'
        + '<button class="run" type="button" data-unit="' + adminEsc(a[2]) + '">run</button>'
        + '<div class="out" data-out="' + adminEsc(a[2]) + '"></div>'
        + '</div>';
    });
    html += '</div>';
    html += '<h2 class="admin-section-head">heal / update</h2>';
    html += '<div class="admin-actions-grid">';
    function deployCard(title, desc, lines) {
      return '<div class="admin-action deploy">'
        + '<h4>' + adminEsc(title) + '</h4>'
        + '<p>' + adminEsc(desc) + '</p>'
        + '<pre>' + adminEsc(lines.join('\n')) + '</pre>'
        + '<button class="copy" type="button">copy</button>'
        + '</div>';
    }
    html += deployCard('pull latest from github',
      'fetches the newest AvianVisitors + BirdNET-Pi changes; the symlinks already in /BirdSongs/Extracted/ pick up new code on the next request.',
      [
        'cd ~/BirdNET-Pi && git pull',
        '# substitute the right php-fpm unit if your debian ships a different version:',
        'sudo systemctl reload caddy "$(systemctl list-unit-files \'php*-fpm.service\' --no-legend | awk \'{print $1; exit}\')"',
      ]);
    html += deployCard('rerun install_services.sh',
      'refreshes every symlink + service file. safe to run anytime; only takes ~10 seconds.',
      [
        'cd ~/BirdNET-Pi && ./scripts/install_services.sh',
      ]);
    html += '</div>';
    adminBody.innerHTML = html;
    // Wire restart buttons + copy buttons.
    adminBody.querySelectorAll('.admin-action button.run').forEach(function (b) {
      b.addEventListener('click', function () {
        var unit = b.dataset.unit;
        if (!confirm('restart ' + unit + '?')) return;
        b.disabled = true; var old = b.textContent; b.textContent = '...';
        var out = adminBody.querySelector('.out[data-out="' + unit.replace(/[^a-z0-9_.-]/gi,'_') + '"]');
        fetch('./avian/api/birdnet-status.php?action=restart&unit=' + encodeURIComponent(unit), {
          method: 'POST', credentials: 'same-origin',
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            b.textContent = j.ok ? 'restarted' : 'failed';
            if (out) out.textContent = (j.ok ? 'ok' : 'rc=' + j.rc) + (j.out ? '\n' + j.out : '');
            setTimeout(function () { b.disabled = false; b.textContent = old; }, 2000);
          })
          .catch(function (e) {
            b.textContent = 'error'; b.disabled = false;
            if (out) out.textContent = e.message || 'request failed';
            setTimeout(function () { b.textContent = old; }, 2000);
          });
      });
    });
    adminBody.querySelectorAll('.admin-action button.copy').forEach(function (b) {
      b.addEventListener('click', function () {
        var pre = b.previousElementSibling;
        if (!pre) return;
        navigator.clipboard.writeText(pre.textContent).then(function () {
          var old = b.textContent; b.textContent = 'copied ✓';
          setTimeout(function () { b.textContent = old; }, 1400);
        });
      });
    });
  }

  // Initial load: if URL has a sci hash, jump to atlas, highlight, and
  // open the modal.
  if (readHash()) { go(2); highlightAtlas(readHash()); openDetailModal(readHash()); }
  // Admin overlay routing: #admin=system|logs|tools opens the admin
  // screen with that sub-tab. Clearing the hash closes it.
  function readAdminHash() {
    var m = location.hash.match(/^#admin=([a-z]+)/);
    return m ? m[1] : null;
  }
  // #about - brief explainer popup; reached via /about (302 -> /#about)
  // or the masthead eyebrow. aria-hidden drives the CSS fade/slide.
  function openAbout()  { document.getElementById('about-modal').setAttribute('aria-hidden', 'false'); }
  function closeAbout() { document.getElementById('about-modal').setAttribute('aria-hidden', 'true'); }
  function syncRouter() {
    window.__lastHashchange = Date.now();
    var sci = readHash();
    var adm = readAdminHash();
    if (location.hash === '#about') openAbout(); else closeAbout();
    if (adm) { openAdmin(adm); return; }
    closeAdmin();
    if (sci) { go(2); highlightAtlas(sci); openDetailModal(sci); }
    else     { highlightAtlas(null); closeDetailModal(); }
  }
  if (readAdminHash()) openAdmin(readAdminHash());
  if (location.hash === '#about') openAbout();
  window.addEventListener('hashchange', syncRouter);

  // Modal interactions: backdrop / close button -> clear the hash.
  document.getElementById('detail-modal').addEventListener('click', function (ev) {
    if (ev.target.dataset && ev.target.dataset.close === '1') {
      if (location.hash) { location.hash = ''; } else { closeDetailModal(); }
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' &&
        document.getElementById('detail-modal').getAttribute('aria-hidden') === 'false') {
      if (location.hash) { location.hash = ''; } else { closeDetailModal(); }
    }
  });

  // About popup: backdrop / close / explore button all carry data-close,
  // which clears the hash and routes through syncRouter -> closeAbout.
  // The masthead eyebrow opens it; Escape dismisses it.
  document.getElementById('about-modal').addEventListener('click', function (ev) {
    if (ev.target.dataset && ev.target.dataset.close === '1') {
      if (location.hash) { location.hash = ''; } else { closeAbout(); }
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' &&
        document.getElementById('about-modal').getAttribute('aria-hidden') === 'false') {
      if (location.hash) { location.hash = ''; } else { closeAbout(); }
    }
  });
  document.getElementById('aboutLink').addEventListener('click', function () {
    location.hash = '#about';
  });

  // Shared decode context for spectrogram generation. Lives once for
  // the page; lazily created on first expand to avoid bootstrapping
  // WebAudio if no one ever opens a row.
  var _specAudioCtx = null;
  function getSpecCtx() {
    if (!_specAudioCtx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) _specAudioCtx = new C();
    }
    return _specAudioCtx;
  }

  // Cache decoded AudioBuffers per file so repeated expand/collapse on
  // the same row doesn't re-fetch + re-decode the mp3.
  var _decodedCache = {};

  // Minimal in-place Cooley-Tukey radix-2 FFT (n must be a power of 2).
  // Operates on parallel real/imag Float32Array buffers. ~30 lines and
  // fast enough for our ~1024-sample windows of 3-second clips.
  function _fft(real, imag) {
    var n = real.length;
    var j = 0;
    for (var i = 0; i < n - 1; i++) {
      if (i < j) {
        var tr = real[i]; real[i] = real[j]; real[j] = tr;
        var ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
      }
      var k = n >> 1;
      while (k <= j) { j -= k; k >>= 1; }
      j += k;
    }
    for (var stage = 2; stage <= n; stage *= 2) {
      var half = stage >> 1;
      var ang = -2 * Math.PI / stage;
      var wR = Math.cos(ang), wI = Math.sin(ang);
      for (var sBase = 0; sBase < n; sBase += stage) {
        var cR = 1, cI = 0;
        for (var sb = 0; sb < half; sb++) {
          var a = sBase + sb;
          var b = a + half;
          var trA = real[b] * cR - imag[b] * cI;
          var tiA = real[b] * cI + imag[b] * cR;
          real[b] = real[a] - trA;
          imag[b] = imag[a] - tiA;
          real[a] = real[a] + trA;
          imag[a] = imag[a] + tiA;
          var nR = cR * wR - cI * wI;
          cI = cR * wI + cI * wR;
          cR = nR;
        }
      }
    }
  }

  // Paint an STFT spectrogram onto the strip's canvas. y-axis is the
  // bird audible band (~200 Hz - ~10 kHz) on a mildly compressed log
  // scale; x-axis is time across the whole clip; colour is dB
  // magnitude mapped to our warm ink palette over the dark paper-ink
  // ground.
  function paintSpectrogram(canvas, audioBuffer) {
    // Defer to the next animation frame so the canvas has been laid out
    // (the parent strip may still be mid-transition expanding from 0).
    // Without this, subsequent expansions paint onto a zero-sized canvas.
    requestAnimationFrame(function () {
      _paintSpectrogramNow(canvas, audioBuffer);
    });
  }
  function _paintSpectrogramNow(canvas, audioBuffer) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    // Read parent strip's box, not the canvas (canvas might be 0-sized
    // briefly during expansion). The strip's expanded height is 88px;
    // width is the row width.
    var strip = canvas.parentElement;
    var cssW = strip ? strip.clientWidth : (canvas.clientWidth || 600);
    var cssH = strip ? strip.clientHeight : (canvas.clientHeight || 88);
    if (cssW < 32 || cssH < 32) {
      // Strip still collapsing in. Retry a frame later.
      requestAnimationFrame(function () { _paintSpectrogramNow(canvas, audioBuffer); });
      return;
    }
    var W = Math.max(1, Math.floor(cssW * dpr));
    var H = Math.max(1, Math.floor(cssH * dpr));
    canvas.width = W; canvas.height = H;

    var ctx = canvas.getContext('2d');
    var samples = audioBuffer.getChannelData(0);
    var sr = audioBuffer.sampleRate;
    var FFT_SIZE = 1024;
    var bins = FFT_SIZE >> 1;
    var nyquist = sr / 2;

    // Frequency-band mapping (Hz -> bin) for the bird-relevant band.
    // Most North American songbirds + corvids range 250 Hz - 8 kHz, but
    // hummingbirds, kinglets, and warblers reach 12 kHz. Push the cap
    // up so we don't miss the high-frequency tail.
    var fLo = 200, fHi = Math.min(12000, nyquist);
    var binLo = Math.max(1, Math.floor(fLo / nyquist * bins));
    var binHi = Math.min(bins - 1, Math.ceil(fHi / nyquist * bins));

    // Hann window
    var win = new Float32Array(FFT_SIZE);
    for (var i = 0; i < FFT_SIZE; i++) {
      win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
    }

    // Choose a hop that lays exactly W columns over the whole clip.
    var hop = Math.max(1, Math.floor((samples.length - FFT_SIZE) / Math.max(1, W - 1)));
    var real = new Float32Array(FFT_SIZE);
    var imag = new Float32Array(FFT_SIZE);

    var imgData = ctx.createImageData(W, H);
    var data = imgData.data;

    // Paper ground; ink intensifies where there's audio energy. Theme-
    // aware so dark mode gets a charcoal ground with a light trace instead
    // of a glaring light rectangle (matches --paper / --ink per theme).
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var BG_R = dark ? 23  : 245, BG_G = dark ? 24  : 240, BG_B = dark ? 28  : 230;
    var FG_R = dark ? 236 : 26,  FG_G = dark ? 232 : 22,  FG_B = dark ? 225 : 18;
    for (var p = 0; p < data.length; p += 4) {
      data[p] = BG_R; data[p + 1] = BG_G; data[p + 2] = BG_B; data[p + 3] = 255;
    }

    // Precompute row -> bin map (log-ish so low freqs get more space).
    var rowToBin = new Int32Array(H);
    for (var row = 0; row < H; row++) {
      var t = 1 - row / (H - 1); // 1 at top, 0 at bottom
      var bin = Math.round(binLo + (binHi - binLo) * Math.pow(t, 1.55));
      rowToBin[row] = Math.max(binLo, Math.min(binHi, bin));
    }

    for (var col = 0; col < W; col++) {
      var start = col * hop;
      if (start + FFT_SIZE > samples.length) break;
      for (var s = 0; s < FFT_SIZE; s++) {
        real[s] = samples[start + s] * win[s];
        imag[s] = 0;
      }
      _fft(real, imag);
      for (var row2 = 0; row2 < H; row2++) {
        var bin2 = rowToBin[row2];
        var re = real[bin2], im = imag[bin2];
        var mag = Math.sqrt(re * re + im * im);
        // log compress; -75 .. -10 dB -> 0 .. 1
        var db = 20 * Math.log10(mag + 1e-9);
        var v = (db + 75) / 65;
        if (v < 0) v = 0; else if (v > 1) v = 1;
        // Ink-on-paper palette: low energy -> paper, high energy -> ink.
        // Smoothstep for a softer falloff between the two extremes.
        var e = v * v * (3 - 2 * v);
        var r = BG_R + Math.round((FG_R - BG_R) * e);
        var g = BG_G + Math.round((FG_G - BG_G) * e);
        var b = BG_B + Math.round((FG_B - BG_B) * e);
        var px = (row2 * W + col) * 4;
        data[px] = r; data[px + 1] = g; data[px + 2] = b; data[px + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    canvas.classList.add('ready');
  }

  // Lazy-add + paint the canvas-based spectrogram for a row's strip.
  // Decoded buffers are cached per file so re-expanding is instant.
  function ensureSpectroImage(row) {
    var file = row && row.dataset.file;
    if (!file) return;
    var strip = row.querySelector('.rec-spectro');
    if (!strip) return;
    var loadingEl = strip.querySelector('.rec-spectro-loading');
    var canvas = strip.querySelector('canvas');
    if (canvas && canvas.classList.contains('ready')) {
      if (loadingEl) loadingEl.style.display = 'none';
      return;
    }
    if (!canvas) {
      canvas = document.createElement('canvas');
      var played = strip.querySelector('.rec-spectro-played');
      strip.insertBefore(canvas, played);
    }
    if (loadingEl) {
      loadingEl.style.display = '';
      loadingEl.textContent = tt('spectro.rendering');
    }

    function done() {
      if (loadingEl) loadingEl.style.display = 'none';
    }
    function fail(reason) {
      if (loadingEl) {
        loadingEl.style.display = '';
        loadingEl.textContent = reason || tt('spectro.unavailable');
      }
    }

    if (_decodedCache[file]) {
      paintSpectrogram(canvas, _decodedCache[file]);
      done();
      return;
    }
    var ctx = getSpecCtx();
    if (!ctx) { fail(tt('spectro.noWebAudio')); return; }
    fetch(bgAudioUrl(file))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (audioBuffer) {
        _decodedCache[file] = audioBuffer;
        paintSpectrogram(canvas, audioBuffer);
        done();
      })
      .catch(function (e) {
        fail(tt('spectro.failed') + (e && e.message ? e.message : ''));
      });
  }

  // Per-recording row interactions in the modal:
  //   - Clicking anywhere on the row toggles the spectrogram strip
  //     (independent of playback). Click again to collapse.
  //   - Clicking the play button toggles audio playback. Playback shows
  //     the moving cursor on whatever strip is already expanded; if the
  //     strip is collapsed, playing also expands it.
  //   - Clicking on the spectrogram itself scrubs (handled in the
  //     mousedown/touchstart wiring further down).
  document.getElementById('modalRecordings').addEventListener('click', function (ev) {
    if (!ev.target.closest) return;
    // Scrub-region clicks are handled by the mousedown wiring below.
    if (ev.target.closest('.rec-spectro-scrub')) return;

    // "not it?" - write a false-positive review back to BirdNET-Go.
    // Two-tap arm/confirm so a stray touch can't flag a detection.
    var flagBtn = ev.target.closest('.flag');
    if (flagBtn) {
      var frow = flagBtn.closest('.rec-row');
      var fid = frow && frow.getAttribute('data-file');
      if (!fid || flagBtn.disabled) return;
      var setFlag = function (state, text, title) {
        flagBtn.setAttribute('data-state', state);
        flagBtn.textContent = text;
        if (title) flagBtn.title = title;
      };
      if (flagBtn.getAttribute('data-state') === 'idle') {
        setFlag('armed', tt('flag.armed'), tt('flag.armedTitle'));
        setTimeout(function () {
          if (flagBtn.getAttribute('data-state') === 'armed') setFlag('idle', '\u2715', tt('flag.report'));
        }, 3500);
        return;
      }
      if (flagBtn.getAttribute('data-state') !== 'armed') return;
      flagBtn.disabled = true;
      setFlag('saving', '\u22ef');
      bgReview(fid, 'false_positive').then(function () {
        frow.classList.add('flagged');
        setFlag('done', '\u2713', tt('flag.done'));
        // BirdNET-Go's analytics fold reviews in - refetch so the
        // collage/counts follow the correction.
        _bgMemo = {};
        _haMemo = {};
        refreshAll();
      }).catch(function (err) {
        flagBtn.disabled = false;
        // Tooltips don't exist on touch - put a short reason IN the pill.
        var isPath = typeof err === 'string' && err.indexOf('needs-ingress') === 0;
        var label = isPath ? tt('flag.noPath')
          : (typeof err === 'number' ? tt('flag.errCode', { code: err }) : tt('flag.failed'));
        var why = isPath
          ? tt('flag.needsIngress', { detail: err.slice('needs-ingress: '.length) })
          : tt('flag.refused', { err: err });
        try { console.warn('[bird-card] review write failed:', err); } catch (e) {}
        setFlag('failed', label, tt('flag.couldNotSave', { why: why }));
        setTimeout(function () {
          if (flagBtn.getAttribute('data-state') === 'failed') setFlag('idle', '\u2715', tt('flag.report'));
        }, 5000);
      });
      return;
    }

    var playBtn = ev.target.closest('.play');
    if (playBtn) {
      // Play / pause toggle. Three cases:
      //   (a) clicking the playing row's button -> pause (KEEP audio
      //       alive so the user can scrub then resume).
      //   (b) clicking a paused row's button (it's still modalRecBtn,
      //       audio still alive, just paused) -> resume from cursor.
      //   (c) clicking a different row's button -> stop the old, start
      //       the new.
      var prow = playBtn.closest('.rec-row');
      var pfile = prow && prow.dataset.file;
      if (!pfile) return;

      if (modalRecBtn === playBtn && modalAudio) {
        // Same row's button - toggle pause/resume.
        if (modalAudio.paused) {
          playBtn.setAttribute('data-active', 'true');
          playBtn.innerHTML = ICON_PAUSE;
          audioClaim(stopModalAudio);   // stop any card / live-stream audio
          modalAudio.play().catch(function () {});
        } else {
          pauseModalAudio();
        }
        return;
      }

      // Different row (or no current playback) - stop any current,
      // start fresh.
      stopModalAudio();
      audioClaim(stopModalAudio);   // stop any card / live-stream audio
      playBtn.setAttribute('data-active', 'true');
      playBtn.innerHTML = ICON_PAUSE;
      modalRecBtn = playBtn;
      prow.classList.add('expanded');
      ensureSpectroImage(prow);
      var strip = prow.querySelector('.rec-spectro');
      var audio = makeAudio(bgAudioUrl(pfile));
      modalAudio = audio;
      audio.addEventListener('loadedmetadata', function () {
        strip.classList.add('armed');
      });
      audio.addEventListener('playing', startCursorLoop);
      audio.addEventListener('pause', stopCursorLoop);
      audio.addEventListener('ended', function () {
        // Natural end: rewind cursor + keep audio so user can replay.
        stopCursorLoop();
        var p = strip.querySelector('.rec-spectro-played');
        var c = strip.querySelector('.rec-spectro-cursor');
        if (p) p.style.width = '0%';
        if (c) c.style.left = '0%';
        if (modalAudio) modalAudio.currentTime = 0;
        if (modalRecBtn) {
          modalRecBtn.removeAttribute('data-active');
          modalRecBtn.innerHTML = ICON_PLAY;
        }
      });
      audio.addEventListener('error', function () {
        stopModalAudio();
        playBtn.innerHTML = '<span style="font-size:8px">!</span>';
        setTimeout(function () { playBtn.innerHTML = ICON_PLAY; }, 1500);
      });
      audio.play().catch(function () { stopModalAudio(); });
      return;
    }

    // Row click anywhere else -> toggle strip open/closed.
    var row = ev.target.closest('.rec-row');
    if (!row) return;
    var willExpand = !row.classList.contains('expanded');
    if (willExpand) {
      row.classList.add('expanded');
      ensureSpectroImage(row);
    } else {
      // Collapsing the row where playback is happening also stops audio
      // (the cursor would just be hidden otherwise).
      if (modalRecBtn && modalRecBtn.closest('.rec-row') === row) stopModalAudio();
      row.classList.remove('expanded');
    }
  });

  // Scrub by clicking / dragging on the spectrogram strip.
  (function () {
    var dragRow = null;
    function seekFromEvent(row, clientX) {
      if (!modalAudio || !modalAudio.duration) return;
      var rowBtn = row.querySelector('.play');
      if (rowBtn !== modalRecBtn) return;
      var strip = row.querySelector('.rec-spectro');
      var rect = strip.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      modalAudio.currentTime = pct * modalAudio.duration;
      // Repaint cursor + played immediately so the user sees the scrub
      // even when audio is paused (rAF loop isn't running then).
      var pctStr = (pct * 100).toFixed(2) + '%';
      var played = strip.querySelector('.rec-spectro-played');
      var cur = strip.querySelector('.rec-spectro-cursor');
      if (played) played.style.width = pctStr;
      if (cur) cur.style.left = pctStr;
    }
    document.getElementById('modalRecordings').addEventListener('mousedown', function (ev) {
      var s = ev.target.closest && ev.target.closest('.rec-spectro-scrub');
      if (!s) return;
      var row = s.closest('.rec-row');
      if (!row || !row.classList.contains('expanded')) return;
      dragRow = row;
      seekFromEvent(row, ev.clientX);
      ev.preventDefault();
    });
    document.addEventListener('mousemove', function (ev) {
      if (!dragRow) return;
      seekFromEvent(dragRow, ev.clientX);
    });
    document.addEventListener('mouseup', function () { dragRow = null; });
    // Touch.
    document.getElementById('modalRecordings').addEventListener('touchstart', function (ev) {
      var s = ev.target.closest && ev.target.closest('.rec-spectro-scrub');
      if (!s) return;
      var row = s.closest('.rec-row');
      if (!row || !row.classList.contains('expanded')) return;
      dragRow = row;
      seekFromEvent(row, ev.touches[0].clientX);
      ev.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', function (ev) {
      if (!dragRow) return;
      seekFromEvent(dragRow, ev.touches[0].clientX);
    });
    document.addEventListener('touchend', function () { dragRow = null; });
  })();

  // Any element with data-sci is a "jump to that bird's atlas card"
  // affordance: atlas cards themselves, stats list rows (top species /
  // first detections), stats heatmap rows, and any future surface
  // that wants to point at a bird. Action chips inside cards stop
  // propagation themselves.
  function jumpToSci(sci) {
    if (!sci) return;
    // Tap a bird from any surface (atlas card, stats row, heatmap):
    // info modal (default), reference call, or both, per tap_action.
    // (This used to navigate to the atlas first; with single-view cards
    // the current view stays put, and in-place feels better anyway.)
    handleBirdTap(sci);
  }
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest) return;
    var card = ev.target.closest('.bird-card');
    if (card) {
      if (ev.target.closest('.actions, .spectro-wrap')) return;
      return jumpToSci(card.dataset.sci);
    }
    var row = ev.target.closest('li[data-sci]');
    if (row) return jumpToSci(row.dataset.sci);
    var hmRow = ev.target.closest('.stats-hm-row[data-sci]');
    if (hmRow) return jumpToSci(hmRow.dataset.sci);
  });

  // After the atlas re-renders (window change, fresh fetch), re-apply
  // any active hash so the highlight survives a rebuild.
  var _origRenderAtlas = renderAtlas;
  renderAtlas = function (animate) {
    _origRenderAtlas(animate);
    var s = readHash();
    if (s) highlightAtlas(s);
  };

  // ===========================================================================
  // Wall-display extras (HA build)
  // ===========================================================================
  // Opt-in widgets for wall-mounted dashboards: a clock + current weather
  // living in a corner of the collage itself (renderCollage stamps their
  // box into the packing grid so the birds nest around the numerals), and
  // idle cursor hiding for kiosk browsers. Enabled per-install via
  // config.js `wall: {...}`, or per-display via the URL - `?wall` turns on
  // clock + weather + cursor hiding, `?corner=top-left` repositions - so
  // one install can serve both a desk browser and a kiosk.
  //
  // Weather sources, in order of preference:
  //   1. Home Assistant itself (wall.haToken set): the page is served by
  //      HA, so /api/* is same-origin - we read the weather entity (HA's
  //      configured integration, in HA's configured units) and sun.sun
  //      for sunrise/sunset.
  //   2. BirdNET-Go's /api/v2/weather/latest (no token needed; yr.no by
  //      default). wall.fahrenheit converts its Celsius for display.
  (function wallDisplay() {
    var WALL = AV_CFG.wall || {};
    function urlFlag(name) {
      return new RegExp('[?&]' + name + '(=|&|$)').test(location.search);
    }
    function urlStr(name) {
      var m = location.search.match(new RegExp('[?&]' + name + '=([\\w-]+)'));
      return m ? m[1] : '';
    }
    var wallOn      = urlFlag('wall');
    var showClock   = !!WALL.clock || wallOn;
    var showWeather = !!WALL.weather || wallOn;
    var hideCursor  = !!WALL.hideCursor || wallOn;

    var wrap = document.getElementById('wallWidgets');
    if (!wrap) return;
    var corner = urlStr('corner') || WALL.corner || 'bottom-right';
    if (['top-left', 'top-right', 'bottom-left', 'bottom-right'].indexOf(corner) >= 0) {
      wrap.setAttribute('data-corner', corner);
    }
    if (showClock || showWeather) wrap.hidden = false;

    // The widget box is a packing obstacle, so whenever its size settles
    // or changes (first weather paint, mostly) the collage re-packs
    // around the new footprint. The 30s data poll re-packs anyway; this
    // just avoids a visibly-overlapped first half-minute.
    var lastW = 0, lastH = 0;
    function repackIfGrown() {
      var r = wrap.getBoundingClientRect();
      if (Math.abs(r.width - lastW) > 6 || Math.abs(r.height - lastH) > 6) {
        lastW = r.width; lastH = r.height;
        renderCollageFromData();
      }
    }

    // ---- Clock ----
    // Minute precision; re-renders on the minute boundary so it never
    // drifts visibly. Locale decides 12/24h and date wording.
    if (showClock) {
      var clockEl = document.getElementById('wwClock');
      var timeEl = document.getElementById('wwTime');
      var dateEl = document.getElementById('wwDate');
      clockEl.hidden = false;
      var drawClock = function () {
        var now = new Date();
        timeEl.textContent = now.toLocaleTimeString(BCP47, { hour: 'numeric', minute: '2-digit' });
        dateEl.textContent = now.toLocaleDateString(BCP47, { weekday: 'short', month: 'short', day: 'numeric' });
        setTimeout(drawClock, (61 - now.getSeconds()) * 1000);
      };
      drawClock();
    }

    // ---- Weather ----
    if (showWeather) {
      var wxEl = document.getElementById('wwWeather');
      var tempEl = document.getElementById('wwTemp');
      var condEl = document.getElementById('wwCond');
      var sunEl = document.getElementById('wwSun');
      var hhmm = function (iso) {
        var d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleTimeString(BCP47, { hour: 'numeric', minute: '2-digit' });
      };
      var paintWeather = function (temp, cond, rise, set) {
        if (typeof temp !== 'number' || isNaN(temp)) return;
        tempEl.textContent = Math.round(temp) + '\u00b0';
        condEl.textContent = (cond || '').toLowerCase();
        sunEl.textContent = (rise && set) ? ('sun ' + rise + ' \u2013 ' + set) : '';
        wxEl.hidden = false;
        var rule = document.getElementById('wwRule');
        if (rule && showClock) rule.hidden = false;
        repackIfGrown();
      };

      // -- Source 1: Home Assistant (same-origin /api with a long-lived
      // token). Weather entity comes from wall.weatherEntity, or is
      // auto-discovered as the first available weather.* entity.
      var haEntity = WALL.weatherEntity || '';
      var haJson = function (path) {
        return fetch('/api' + path, {
          cache: 'no-store',
          headers: { 'Authorization': 'Bearer ' + WALL.haToken },
        }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
      };
      // HA condition slugs -> printable words. Standalone/fallback path:
      // the weather.* table carries the standard HA condition slugs (en
      // reproduces the original wording verbatim); unknown slugs fall back
      // to plain de-hyphenation. The card build prefers hass's own
      // localized text before this (see drawWeatherHass).
      var haCond = function (s) {
        s = String(s || '');
        if (!s) return '';
        var key = 'weather.' + s;
        if (key in (I18N.en || {})) return tt(key);
        // Fallbacks (also cover the case where no i18n table is loaded):
        // the two multi-word slugs, then plain de-hyphenation.
        if (s === 'partlycloudy') return 'partly cloudy';
        if (s === 'windy-variant') return 'windy';
        return s.replace(/-/g, ' ');
      };
      var drawWeatherHA = function () {
        var entityP = haEntity
          ? Promise.resolve(haEntity)
          : haJson('/states').then(function (all) {
              var hit = (all || []).filter(function (e) {
                return /^weather\./.test(e.entity_id) && e.state !== 'unavailable';
              })[0];
              if (!hit) throw new Error('no weather entity');
              haEntity = hit.entity_id;
              return haEntity;
            });
        return entityP.then(function (ent) {
          return Promise.all([
            haJson('/states/' + ent),
            haJson('/states/sun.sun').catch(function () { return null; }),
          ]);
        }).then(function (parts) {
          var w = parts[0] || {}, attrs = w.attributes || {};
          var sun = (parts[1] || {}).attributes || {};
          paintWeather(
            attrs.temperature,
            haCond(w.state),
            sun.next_rising ? hhmm(sun.next_rising) : '',
            sun.next_setting ? hhmm(sun.next_setting) : ''
          );
        });
      };

      // -- Source 2: BirdNET-Go. Metric at the source; wall.fahrenheit
      // converts for display. HA values come already in HA's units.
      var drawWeatherBG = function () {
        return bgJson('/weather/latest').then(function (j) {
          var h = (j && j.hourly) || {};
          if (typeof h.temperature !== 'number') return;
          var t = WALL.fahrenheit ? (h.temperature * 9 / 5 + 32) : h.temperature;
          var daily = j.daily || {};
          paintWeather(
            t,
            h.weather_desc || h.weather_main || '',
            daily.sunrise ? hhmm(daily.sunrise) : '',
            daily.sunset ? hhmm(daily.sunset) : ''
          );
        });
      };

      // -- Source 0: an injected live `hass` object (the custom-card build
      // passes a getter via AV_CONFIG.__getHass). Same data as the token
      // path - HA's weather entity in HA's units, sun.sun for sun times -
      // but with the card's own authenticated connection, so no token.
      var drawWeatherHass = function () {
        var hass = AV_CFG.__getHass && AV_CFG.__getHass();
        if (!hass || !hass.states) return Promise.reject('no hass');
        var ent = haEntity;
        if (!ent) {
          var ids = Object.keys(hass.states);
          for (var i = 0; i < ids.length; i++) {
            if (ids[i].indexOf('weather.') === 0 && hass.states[ids[i]].state !== 'unavailable') {
              ent = ids[i];
              break;
            }
          }
        }
        var w = ent && hass.states[ent];
        if (!w) return Promise.reject('no weather entity');
        haEntity = ent;
        var attrs = w.attributes || {};
        var sun = (hass.states['sun.sun'] || {}).attributes || {};
        // Prefer HA's own localized condition text (it follows the HA UI
        // language); fall back to the card's weather.* table via haCond.
        var cond = '';
        try {
          if (typeof hass.formatEntityState === 'function') cond = hass.formatEntityState(w);
          else if (typeof hass.localize === 'function') {
            cond = hass.localize('component.weather.entity_component._.state.' + w.state);
          }
        } catch (e) { cond = ''; }
        if (!cond) cond = haCond(w.state);
        paintWeather(
          attrs.temperature,
          cond,
          sun.next_rising ? hhmm(sun.next_rising) : '',
          sun.next_setting ? hhmm(sun.next_setting) : ''
        );
        return Promise.resolve();
      };

      var drawWeather = function () {
        (AV_CFG.__getHass
          ? drawWeatherHass().catch(function () { return drawWeatherBG(); })
          : WALL.haToken ? drawWeatherHA()
          : drawWeatherBG())
          .catch(function () { /* source unavailable - widget stays hidden */ });
      };
      drawWeather();
      setInterval(drawWeather, 10 * 60 * 1000);
    }

    // ---- Idle cursor hiding ----
    // Kiosk browsers usually park the pointer dead-centre; hide it after
    // 8s of stillness and bring it back on any movement.
    if (hideCursor) {
      var idleT = null;
      var wake = function () {
        document.body.classList.remove('ww-cursor-hidden');
        clearTimeout(idleT);
        idleT = setTimeout(function () {
          document.body.classList.add('ww-cursor-hidden');
        }, 8000);
      };
      ['pointermove', 'pointerdown', 'keydown'].forEach(function (ev) {
        document.addEventListener(ev, wake, { passive: true });
      });
      wake();
    }
  })();
})();
