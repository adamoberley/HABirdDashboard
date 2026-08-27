// HABirdDashboard - Dutch (nl) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Dutch. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).nl = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'statistieken',
  'view.atlas': 'atlas',
  'view.aria': 'Weergave',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1U',
  'winpick.12h': '12U',
  'winpick.24h': '24U',
  'winpick.7d': '7D',
  'winpick.all': 'ALLE',

  // ---- Static head / about affordance ----
  'head.about': 'je vogels',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Onlangs gehoord',
  'title.avianVisitors': 'Gevederde gasten',

  // ---- Section aria-labels ----
  'aria.collage': 'Vogelcollage',
  'aria.stats': 'Statistieken',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'dit uur',
  'window.past12h': 'afgelopen 12u',
  'window.today': 'vandaag',
  'window.thisWeek': 'deze week',
  'window.allTime': 'ooit',

  // ---- Collage tooltip units ----
  'unit.call': 'roep',
  'unit.calls': 'roepen',
  'unit.visit': 'bezoek',
  'unit.visits': 'bezoeken',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Per periode',
  'stats.byPeriodSub': 'detecties, gegroepeerd op hoe recent ze zijn',
  'stats.badgeNow': 'NU',
  'stats.badgeToday': 'VANDAAG',
  'stats.badgeWeek': 'WEEK',
  'stats.badgeAll': 'ALLE',
  'stats.lastHour': 'afgelopen uur',
  'stats.today': 'vandaag',
  'stats.last7days': 'afgelopen 7 dagen',
  'stats.allTime': 'ooit',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Topsoorten',
  'stats.topSpecCap': 'meest gehoord, {window}',
  'stats.noneInWindow': 'geen detecties in deze periode',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Eerste detecties',
  'stats.firstDetectionsSub': 'nieuwste toevoegingen aan de soortenlijst',
  'stats.daysAgo': '{n}d geleden',
  'stats.noneYet': 'nog geen detecties',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'geen detecties in deze periode',
  'stats.heatmapTotal': 'alle',
  'stats.byHourCap': 'detecties per uur · {window}',
  'stats.byHourDayCap': 'detecties per uur van de dag · afgelopen 7 dagen',
  'stats.heatmapTrim': '{max} meest gehoorde van {total}',

  // ---- Atlas ----
  'atlas.sort': 'atlas sorteren',
  'atlas.mostHeard': 'meest gehoord',
  'atlas.mostRecent': 'meest recent',
  'atlas.alphabetical': 'alfabetisch',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'Nog geen vogels gedetecteerd.',
  'atlas.emptyHint': 'De atlas vult zich naarmate nieuwe soorten worden herkend.',
  'atlas.noWindowTitle': 'Geen detecties in deze periode.',
  'atlas.noWindowHint': 'Probeer een langere periode.',
  'atlas.allTime': 'ooit',
  'atlas.new': 'nieuw',
  'atlas.newTitle': 'eerste keer dat deze soort hier ooit is gehoord',

  // ---- Detail modal: chrome ----
  'modal.close': 'Sluiten',
  'modal.pose': 'Houding',
  'modal.perched': 'zittend',
  'modal.inFlight': 'in vlucht',
  'modal.genus': 'geslacht',
  'modal.rarity': 'zeldzaamheid',
  'modal.allTime': 'ooit',
  'modal.firstHeard': 'voor het eerst gehoord',
  'modal.visits': 'bezoeken',
  'modal.visitsWindow': 'bezoeken {window}',
  'modal.recordings': 'Opnames',
  'modal.refCall': 'referentieroep',
  'modal.playRefCall': 'referentieroep afspelen',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Beschrijving laden...',
  'modal.loadingRecordings': 'Opnames laden...',
  'modal.noRecordings': 'Nog geen opnames.',
  'modal.recordingsFailed': 'Opnames laden mislukt.',
  'modal.noDescription': 'Geen beschrijving beschikbaar.',
  'modal.captured': '{n} vastgelegd',
  'modal.play': 'afspelen',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'algemeen',
  'rarity.regular': 'regelmatig',
  'rarity.occasional': 'incidenteel',
  'rarity.rare': 'zeldzaam',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'geen referentieroep op Xeno-Canto voor deze soort',
  'refcall.busy': 'Xeno-Canto is overbelast (snelheidslimiet) — probeer het straks opnieuw',
  'refcall.unavailableCode': 'referentieroep niet beschikbaar (Xeno-Canto {code})',
  'refcall.unavailable': 'referentieroep niet beschikbaar',
  'refcall.cantPlay': 'kon deze referentieroep niet afspelen',
  'refcall.credit': 'Referentieroep: Xeno-Canto',
  'refcall.recBy': ' · opn. {rec}',
  'refcall.license': 'licentie',

  // ---- Spectrogram ----
  'spectro.loading': 'spectrogram laden...',
  'spectro.rendering': 'spectrogram genereren...',
  'spectro.unavailable': 'spectrogram niet beschikbaar',
  'spectro.noWebAudio': 'WebAudio niet beschikbaar',
  'spectro.failed': 'spectrogram mislukt: ',

  // ---- False-positive flag pill ----
  'flag.report': 'melden als fout-positief',
  'flag.armed': 'niet de juiste?',
  'flag.armedTitle': 'tik nogmaals om te melden als fout-positief',
  'flag.done': 'gemeld als fout-positief',
  'flag.failed': 'mislukt',
  'flag.noPath': 'geen pad',
  'flag.errCode': 'fout {code}',
  'flag.couldNotSave': 'kon niet opslaan: {why}',
  'flag.needsIngress': 'vereist de HA ingress-verbinding - {detail}',
  'flag.refused': 'BirdNET-Go weigerde ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'heldere nacht',
  'weather.cloudy': 'bewolkt',
  'weather.exceptional': 'uitzonderlijk',
  'weather.fog': 'mist',
  'weather.hail': 'hagel',
  'weather.lightning': 'onweer',
  'weather.lightning-rainy': 'onweer met regen',
  'weather.partlycloudy': 'half bewolkt',
  'weather.pouring': 'stortregen',
  'weather.rainy': 'regenachtig',
  'weather.snowy': 'sneeuw',
  'weather.snowy-rainy': 'natte sneeuw',
  'weather.sunny': 'zonnig',
  'weather.windy': 'winderig',
  'weather.windy-variant': 'winderig',

  // ---- About modal ----
  'about.title': 'De vogels buiten je raam',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Een piepklein microfoontje herkent elke voorbijkomende vogel met <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, gebouwd op Cornell’s <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>. Elke soort verschijnt als illustratie in de collage, met een grootte die aangeeft hoe vaak hij gehoord is. Zekere detecties zitten; onzekere vliegen voorbij.',
  'about.explore': 'ontdek de vogels →',
};
