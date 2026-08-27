// HABirdDashboard - Swedish (sv) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Swedish. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).sv = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'statistik',
  'view.atlas': 'atlas',
  'view.aria': 'Vy',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1T',
  'winpick.12h': '12T',
  'winpick.24h': '24T',
  'winpick.7d': '7D',
  'winpick.all': 'ALLA',

  // ---- Static head / about affordance ----
  'head.about': 'dina fåglar',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Hörda nyligen',
  'title.avianVisitors': 'Fjäderklädda gäster',

  // ---- Section aria-labels ----
  'aria.collage': 'Fågelcollage',
  'aria.stats': 'Statistik',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'denna timme',
  'window.past12h': 'senaste 12 tim',
  'window.today': 'idag',
  'window.thisWeek': 'denna vecka',
  'window.allTime': 'någonsin',

  // ---- Collage tooltip units ----
  'unit.call': 'läte',
  'unit.calls': 'läten',
  'unit.visit': 'besök',
  'unit.visits': 'besök',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Efter period',
  'stats.byPeriodSub': 'registreringar, grupperade efter hur nya de är',
  'stats.badgeNow': 'NU',
  'stats.badgeToday': 'IDAG',
  'stats.badgeWeek': 'VECKA',
  'stats.badgeAll': 'ALLA',
  'stats.lastHour': 'senaste timmen',
  'stats.today': 'idag',
  'stats.last7days': 'senaste 7 dagarna',
  'stats.allTime': 'någonsin',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Toparter',
  'stats.topSpecCap': 'mest hörda, {window}',
  'stats.noneInWindow': 'inga registreringar i perioden',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Första registreringar',
  'stats.firstDetectionsSub': 'nyaste tillskotten till artlistan',
  'stats.daysAgo': 'för {n}d sedan',
  'stats.noneYet': 'inga registreringar än',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'inga registreringar i denna period',
  'stats.heatmapTotal': 'alla',
  'stats.byHourCap': 'registreringar per timme · {window}',
  'stats.byHourDayCap': 'registreringar efter tid på dygnet · senaste 7 dagarna',
  'stats.heatmapTrim': '{max} mest hörda av {total}',

  // ---- Atlas ----
  'atlas.sort': 'sortera atlas',
  'atlas.mostHeard': 'mest hörda',
  'atlas.mostRecent': 'senaste',
  'atlas.alphabetical': 'alfabetisk',
  'atlas.atoz': 'a → ö',
  'atlas.emptyTitle': 'Inga fåglar registrerade än.',
  'atlas.emptyHint': 'Atlasen fylls på i takt med att nya arter identifieras.',
  'atlas.noWindowTitle': 'Inga registreringar i denna period.',
  'atlas.noWindowHint': 'Prova en längre tidsperiod.',
  'atlas.allTime': 'någonsin',
  'atlas.new': 'ny',
  'atlas.newTitle': 'första gången denna art någonsin har hörts här',

  // ---- Detail modal: chrome ----
  'modal.close': 'Stäng',
  'modal.pose': 'Positur',
  'modal.perched': 'sittande',
  'modal.inFlight': 'i flykt',
  'modal.genus': 'släkte',
  'modal.rarity': 'sällsynthet',
  'modal.allTime': 'någonsin',
  'modal.firstHeard': 'först hörd',
  'modal.visits': 'besök',
  'modal.visitsWindow': 'besök {window}',
  'modal.recordings': 'Inspelningar',
  'modal.refCall': 'referensläte',
  'modal.playRefCall': 'spela upp referensläte',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Läser in beskrivning...',
  'modal.loadingRecordings': 'Läser in inspelningar...',
  'modal.noRecordings': 'Inga inspelningar än.',
  'modal.recordingsFailed': 'Det gick inte att läsa in inspelningar.',
  'modal.noDescription': 'Ingen beskrivning tillgänglig.',
  'modal.captured': '{n} inspelade',
  'modal.play': 'spela upp',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'vanlig',
  'rarity.regular': 'regelbunden',
  'rarity.occasional': 'tillfällig',
  'rarity.rare': 'sällsynt',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'inget referensläte på Xeno-Canto för denna art',
  'refcall.busy': 'Xeno-Canto är upptaget (hastighetsgräns) — försök igen om en stund',
  'refcall.unavailableCode': 'referensläte inte tillgängligt (Xeno-Canto {code})',
  'refcall.unavailable': 'referensläte inte tillgängligt',
  'refcall.cantPlay': 'det gick inte att spela upp detta referensläte',
  'refcall.credit': 'Referensläte: Xeno-Canto',
  'refcall.recBy': ' · insp. {rec}',
  'refcall.license': 'licens',

  // ---- Spectrogram ----
  'spectro.loading': 'läser in spektrogram...',
  'spectro.rendering': 'renderar spektrogram...',
  'spectro.unavailable': 'spektrogram inte tillgängligt',
  'spectro.noWebAudio': 'WebAudio inte tillgängligt',
  'spectro.failed': 'spektrogram misslyckades: ',

  // ---- False-positive flag pill ----
  'flag.report': 'rapportera som falsk positiv',
  'flag.armed': 'inte den?',
  'flag.armedTitle': 'tryck igen för att rapportera som falsk positiv',
  'flag.done': 'rapporterad som falsk positiv',
  'flag.failed': 'misslyckades',
  'flag.noPath': 'ingen sökväg',
  'flag.errCode': 'fel {code}',
  'flag.couldNotSave': 'det gick inte att spara: {why}',
  'flag.needsIngress': 'kräver HA-ingress-anslutningen - {detail}',
  'flag.refused': 'BirdNET-Go nekade ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'klart',
  'weather.cloudy': 'molnigt',
  'weather.exceptional': 'extremt',
  'weather.fog': 'dimma',
  'weather.hail': 'hagel',
  'weather.lightning': 'åska',
  'weather.lightning-rainy': 'åska med regn',
  'weather.partlycloudy': 'delvis molnigt',
  'weather.pouring': 'skyfall',
  'weather.rainy': 'regnigt',
  'weather.snowy': 'snöigt',
  'weather.snowy-rainy': 'snöblandat regn',
  'weather.sunny': 'soligt',
  'weather.windy': 'blåsigt',
  'weather.windy-variant': 'blåsigt',

  // ---- About modal ----
  'about.title': 'Fåglarna utanför ditt fönster',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'En liten mikrofon identifierar varje förbipasserande fågel med <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, byggt på Cornells <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>. Varje art visas som en illustration i collaget, med storlek efter hur ofta den har hörts. Säkra registreringar sitter; osäkra flyger förbi.',
  'about.explore': 'utforska fåglarna →',
};
