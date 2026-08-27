// HABirdDashboard - Norwegian Bokmål (nb) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Norwegian Bokmål. Any key omitted here falls back to
// the en reference table by design. Scientific names and the stable
// rarity/label CODES are never translated - only the display strings for
// existing keys. {name} placeholders are preserved and filled by
// tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).nb = {
  // ---- View slider ----
  'view.collage': 'kollasje',
  'view.stats': 'statistikk',
  'view.atlas': 'atlas',
  'view.aria': 'Visning',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1T',
  'winpick.12h': '12T',
  'winpick.24h': '24T',
  'winpick.7d': '7D',
  'winpick.all': 'ALLE',

  // ---- Static head / about affordance ----
  'head.about': 'dine fugler',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Hørt nylig',
  'title.avianVisitors': 'Fjærkledde gjester',

  // ---- Section aria-labels ----
  'aria.collage': 'Fuglekollasje',
  'aria.stats': 'Statistikk',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'denne timen',
  'window.past12h': 'siste 12t',
  'window.today': 'i dag',
  'window.thisWeek': 'denne uken',
  'window.allTime': 'noensinne',

  // ---- Collage tooltip units ----
  'unit.call': 'lyd',
  'unit.calls': 'lyder',
  'unit.visit': 'besøk',
  'unit.visits': 'besøk',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Etter periode',
  'stats.byPeriodSub': 'registreringer, gruppert etter hvor nye de er',
  'stats.badgeNow': 'NÅ',
  'stats.badgeToday': 'I DAG',
  'stats.badgeWeek': 'UKE',
  'stats.badgeAll': 'ALLE',
  'stats.lastHour': 'siste time',
  'stats.today': 'i dag',
  'stats.last7days': 'siste 7 dager',
  'stats.allTime': 'noensinne',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Mest hørte arter',
  'stats.topSpecCap': 'mest hørt, {window}',
  'stats.noneInWindow': 'ingen registreringer i perioden',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Første registreringer',
  'stats.firstDetectionsSub': 'nyeste tilskudd til artslisten',
  'stats.daysAgo': 'for {n}d siden',
  'stats.noneYet': 'ingen registreringer ennå',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'ingen registreringer i denne perioden',
  'stats.heatmapTotal': 'alle',
  'stats.byHourCap': 'registreringer per time · {window}',
  'stats.byHourDayCap': 'registreringer etter tid på dagen · siste 7 dager',
  'stats.heatmapTrim': '{max} mest hørte av {total}',

  // ---- Atlas ----
  'atlas.sort': 'sorter atlas',
  'atlas.mostHeard': 'mest hørt',
  'atlas.mostRecent': 'nyeste',
  'atlas.alphabetical': 'alfabetisk',
  'atlas.atoz': 'a → å',
  'atlas.emptyTitle': 'Ingen fugler registrert ennå.',
  'atlas.emptyHint': 'Atlaset fylles opp etter hvert som nye arter identifiseres.',
  'atlas.noWindowTitle': 'Ingen registreringer i denne perioden.',
  'atlas.noWindowHint': 'Prøv en lengre tidsperiode.',
  'atlas.allTime': 'noensinne',
  'atlas.new': 'ny',
  'atlas.newTitle': 'første gang denne arten noensinne er hørt her',

  // ---- Detail modal: chrome ----
  'modal.close': 'Lukk',
  'modal.pose': 'Positur',
  'modal.perched': 'sittende',
  'modal.inFlight': 'i flukt',
  'modal.genus': 'slekt',
  'modal.rarity': 'sjeldenhet',
  'modal.allTime': 'noensinne',
  'modal.firstHeard': 'først hørt',
  'modal.visits': 'besøk',
  'modal.visitsWindow': 'besøk {window}',
  'modal.recordings': 'Opptak',
  'modal.refCall': 'referanselyd',
  'modal.playRefCall': 'spill av referanselyd',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Laster beskrivelse...',
  'modal.loadingRecordings': 'Laster opptak...',
  'modal.noRecordings': 'Ingen opptak ennå.',
  'modal.recordingsFailed': 'Kunne ikke laste opptak.',
  'modal.noDescription': 'Ingen beskrivelse tilgjengelig.',
  'modal.captured': '{n} fanget',
  'modal.play': 'spill av',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'vanlig',
  'rarity.regular': 'regelmessig',
  'rarity.occasional': 'leilighetsvis',
  'rarity.rare': 'sjelden',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'ingen referanselyd på Xeno-Canto for denne arten',
  'refcall.busy': 'Xeno-Canto er opptatt (hastighetsgrense) — prøv igjen om et øyeblikk',
  'refcall.unavailableCode': 'referanselyd utilgjengelig (Xeno-Canto {code})',
  'refcall.unavailable': 'referanselyd utilgjengelig',
  'refcall.cantPlay': 'kunne ikke spille av denne referanselyden',
  'refcall.credit': 'Referanselyd: Xeno-Canto',
  'refcall.recBy': ' · oppt. {rec}',
  'refcall.license': 'lisens',

  // ---- Spectrogram ----
  'spectro.loading': 'laster spektrogram...',
  'spectro.rendering': 'genererer spektrogram...',
  'spectro.unavailable': 'spektrogram utilgjengelig',
  'spectro.noWebAudio': 'WebAudio ikke tilgjengelig',
  'spectro.failed': 'spektrogram mislyktes: ',

  // ---- False-positive flag pill ----
  'flag.report': 'rapporter som falsk positiv',
  'flag.armed': 'ikke den?',
  'flag.armedTitle': 'trykk igjen for å rapportere som falsk positiv',
  'flag.done': 'rapportert som falsk positiv',
  'flag.failed': 'mislyktes',
  'flag.noPath': 'ingen sti',
  'flag.errCode': 'feil {code}',
  'flag.couldNotSave': 'kunne ikke lagre: {why}',
  'flag.needsIngress': 'krever HA ingress-tilkoblingen - {detail}',
  'flag.refused': 'BirdNET-Go avviste ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'klar natt',
  'weather.cloudy': 'skyet',
  'weather.exceptional': 'eksepsjonelt',
  'weather.fog': 'tåke',
  'weather.hail': 'hagl',
  'weather.lightning': 'lyn',
  'weather.lightning-rainy': 'tordenvær og regn',
  'weather.partlycloudy': 'delvis skyet',
  'weather.pouring': 'styrtregn',
  'weather.rainy': 'regn',
  'weather.snowy': 'snø',
  'weather.snowy-rainy': 'sludd',
  'weather.sunny': 'sol',
  'weather.windy': 'vind',
  'weather.windy-variant': 'vind',

  // ---- About modal ----
  'about.title': 'Fuglene utenfor vinduet ditt',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'En liten mikrofon identifiserer hver forbipasserende fugl med <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, bygget på Cornells <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>. Hver art vises som en illustrasjon i kollasjen, i en størrelse etter hvor ofte den er hørt. Sikre registreringer sitter; usikre flyr forbi.',
  'about.explore': 'utforsk fuglene →',
};
