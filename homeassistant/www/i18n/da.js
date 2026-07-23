// HABirdDashboard - Danish (da) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Danish. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).da = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'statistik',
  'view.atlas': 'atlas',
  'view.aria': 'Visning',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1T',
  'winpick.12h': '12T',
  'winpick.24h': '24T',
  'winpick.7d': '7D',
  'winpick.all': 'ALLE',

  // ---- Static head / about affordance ----
  'head.about': 'dine fugle',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Hørt for nylig',
  'title.avianVisitors': 'Fjerklædte gæster',

  // ---- Section aria-labels ----
  'aria.collage': 'Fuglecollage',
  'aria.stats': 'Statistik',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'denne time',
  'window.past12h': 'seneste 12t',
  'window.today': 'i dag',
  'window.thisWeek': 'denne uge',
  'window.allTime': 'nogensinde',

  // ---- Collage tooltip units ----
  'unit.call': 'kald',
  'unit.calls': 'kald',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Efter periode',
  'stats.byPeriodSub': 'registreringer, grupperet efter hvor nye de er',
  'stats.badgeNow': 'NU',
  'stats.badgeToday': 'I DAG',
  'stats.badgeWeek': 'UGE',
  'stats.badgeAll': 'ALLE',
  'stats.lastHour': 'seneste time',
  'stats.today': 'i dag',
  'stats.last7days': 'seneste 7 dage',
  'stats.allTime': 'nogensinde',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Toparter',
  'stats.topSpecCap': 'mest hørt, {window}',
  'stats.noneInWindow': 'ingen registreringer i perioden',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Første registreringer',
  'stats.firstDetectionsSub': 'nyeste tilføjelser til artslisten',
  'stats.daysAgo': 'for {n}d siden',
  'stats.noneYet': 'ingen registreringer endnu',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'ingen registreringer i denne periode',
  'stats.heatmapTotal': 'alle',
  'stats.byHourCap': 'registreringer pr. time · {window}',
  'stats.byHourDayCap': 'registreringer efter tid på dagen · seneste 7 dage',
  'stats.heatmapTrim': '{max} mest hørte af {total}',

  // ---- Atlas ----
  'atlas.sort': 'sortér atlas',
  'atlas.mostHeard': 'mest hørt',
  'atlas.mostRecent': 'nyeste',
  'atlas.alphabetical': 'alfabetisk',
  'atlas.atoz': 'a → å',
  'atlas.emptyTitle': 'Ingen fugle registreret endnu.',
  'atlas.emptyHint': 'Atlasset fyldes op, efterhånden som nye arter identificeres.',
  'atlas.noWindowTitle': 'Ingen registreringer i denne periode.',
  'atlas.noWindowHint': 'Prøv en længere tidsperiode.',
  'atlas.allTime': 'nogensinde',
  'atlas.new': 'ny',
  'atlas.newTitle': 'første gang denne art nogensinde er hørt her',

  // ---- Detail modal: chrome ----
  'modal.close': 'Luk',
  'modal.pose': 'Positur',
  'modal.perched': 'siddende',
  'modal.inFlight': 'i flugt',
  'modal.genus': 'slægt',
  'modal.rarity': 'sjældenhed',
  'modal.allTime': 'nogensinde',
  'modal.firstHeard': 'først hørt',
  'modal.recordings': 'Optagelser',
  'modal.refCall': 'referencekald',
  'modal.playRefCall': 'afspil referencekald',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Indlæser beskrivelse...',
  'modal.loadingRecordings': 'Indlæser optagelser...',
  'modal.noRecordings': 'Ingen optagelser endnu.',
  'modal.recordingsFailed': 'Kunne ikke indlæse optagelser.',
  'modal.noDescription': 'Ingen beskrivelse tilgængelig.',
  'modal.captured': '{n} optaget',
  'modal.play': 'afspil',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'almindelig',
  'rarity.regular': 'regelmæssig',
  'rarity.occasional': 'lejlighedsvis',
  'rarity.rare': 'sjælden',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'intet referencekald på Xeno-Canto for denne art',
  'refcall.busy': 'Xeno-Canto er optaget (hastighedsgrænse) — prøv igen om et øjeblik',
  'refcall.unavailableCode': 'referencekald utilgængeligt (Xeno-Canto {code})',
  'refcall.unavailable': 'referencekald utilgængeligt',
  'refcall.cantPlay': 'kunne ikke afspille dette referencekald',
  'refcall.credit': 'Referencekald: Xeno-Canto',
  'refcall.recBy': ' · opt. {rec}',
  'refcall.license': 'licens',

  // ---- Spectrogram ----
  'spectro.loading': 'indlæser spektrogram...',
  'spectro.rendering': 'gengiver spektrogram...',
  'spectro.unavailable': 'spektrogram utilgængeligt',
  'spectro.noWebAudio': 'WebAudio ikke tilgængelig',
  'spectro.failed': 'spektrogram mislykkedes: ',

  // ---- False-positive flag pill ----
  'flag.report': 'rapportér som falsk positiv',
  'flag.armed': 'ikke den?',
  'flag.armedTitle': 'tryk igen for at rapportere som falsk positiv',
  'flag.done': 'rapporteret som falsk positiv',
  'flag.failed': 'mislykkedes',
  'flag.noPath': 'ingen sti',
  'flag.errCode': 'fejl {code}',
  'flag.couldNotSave': 'kunne ikke gemme: {why}',
  'flag.needsIngress': 'kræver HA ingress-forbindelsen - {detail}',
  'flag.refused': 'BirdNET-Go afviste ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'klar nat',
  'weather.cloudy': 'skyet',
  'weather.exceptional': 'usædvanligt',
  'weather.fog': 'tåge',
  'weather.hail': 'hagl',
  'weather.lightning': 'lyn',
  'weather.lightning-rainy': 'lyn og regn',
  'weather.partlycloudy': 'delvist skyet',
  'weather.pouring': 'styrtregn',
  'weather.rainy': 'regn',
  'weather.snowy': 'sne',
  'weather.snowy-rainy': 'slud',
  'weather.sunny': 'solrigt',
  'weather.windy': 'blæsende',
  'weather.windy-variant': 'blæsende',

  // ---- About modal ----
  'about.title': 'Fuglene uden for dit vindue',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'En lille mikrofon identificerer hver forbipasserende fugl med <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, bygget på Cornells <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>. Hver art vises som en illustration i collagen, i en størrelse efter hvor ofte den er hørt. Sikre registreringer sidder; usikre flyver forbi.',
  'about.explore': 'udforsk fuglene →',
};
