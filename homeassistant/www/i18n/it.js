// HABirdDashboard - Italian (it) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Italian. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).it = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'statistiche',
  'view.atlas': 'atlante',
  'view.aria': 'Vista',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7G',
  'winpick.all': 'TUTTO',

  // ---- Static head / about affordance ----
  'head.about': 'i tuoi uccelli',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Ascoltati di recente',
  'title.avianVisitors': 'Visitatori alati',

  // ---- Section aria-labels ----
  'aria.collage': 'Collage di uccelli',
  'aria.stats': 'Statistiche',
  'aria.atlas': 'Atlante',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'quest’ora',
  'window.past12h': 'ultime 12h',
  'window.today': 'oggi',
  'window.thisWeek': 'questa settimana',
  'window.allTime': 'sempre',

  // ---- Collage tooltip units ----
  'unit.call': 'richiamo',
  'unit.calls': 'richiami',
  'unit.visit': 'visita',
  'unit.visits': 'visite',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Per periodo',
  'stats.byPeriodSub': 'rilevamenti, raggruppati per intervallo di tempo',
  'stats.badgeNow': 'ORA',
  'stats.badgeToday': 'OGGI',
  'stats.badgeWeek': 'SETTIMANA',
  'stats.badgeAll': 'TUTTO',
  'stats.lastHour': 'ultima ora',
  'stats.today': 'oggi',
  'stats.last7days': 'ultimi 7 giorni',
  'stats.allTime': 'sempre',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Specie principali',
  'stats.topSpecCap': 'più ascoltate, {window}',
  'stats.noneInWindow': 'nessun rilevamento nel periodo',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Primi rilevamenti',
  'stats.firstDetectionsSub': 'le aggiunte più recenti alla lista specie',
  'stats.daysAgo': '{n}g fa',
  'stats.noneYet': 'ancora nessun rilevamento',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'nessun rilevamento in questo periodo',
  'stats.heatmapTotal': 'tutte',
  'stats.byHourCap': 'rilevamenti per ora · {window}',
  'stats.byHourDayCap': 'rilevamenti per ora del giorno · ultimi 7 giorni',
  'stats.heatmapTrim': '{max} più ascoltate su {total}',

  // ---- Atlas ----
  'atlas.sort': 'ordina atlante',
  'atlas.mostHeard': 'più ascoltate',
  'atlas.mostRecent': 'più recenti',
  'atlas.alphabetical': 'alfabetico',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'Ancora nessun uccello rilevato.',
  'atlas.emptyHint': 'L’atlante si riempie man mano che vengono identificate nuove specie.',
  'atlas.noWindowTitle': 'Nessun rilevamento in questo periodo.',
  'atlas.noWindowHint': 'Prova un intervallo di tempo più lungo.',
  'atlas.allTime': 'sempre',
  'atlas.new': 'nuovo',
  'atlas.newTitle': 'prima volta che questa specie viene ascoltata qui',

  // ---- Detail modal: chrome ----
  'modal.close': 'Chiudi',
  'modal.pose': 'Posa',
  'modal.perched': 'appollaiato',
  'modal.inFlight': 'in volo',
  'modal.genus': 'genere',
  'modal.rarity': 'rarità',
  'modal.allTime': 'sempre',
  'modal.firstHeard': 'primo ascolto',
  'modal.visits': 'visite',
  'modal.visitsWindow': 'visite {window}',
  'modal.recordings': 'Registrazioni',
  'modal.refCall': 'richiamo di riferimento',
  'modal.playRefCall': 'riproduci richiamo di riferimento',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Caricamento descrizione...',
  'modal.loadingRecordings': 'Caricamento registrazioni...',
  'modal.noRecordings': 'Ancora nessuna registrazione.',
  'modal.recordingsFailed': 'Impossibile caricare le registrazioni.',
  'modal.noDescription': 'Nessuna descrizione disponibile.',
  'modal.captured': 'catturate: {n}',
  'modal.play': 'riproduci',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'comune',
  'rarity.regular': 'regolare',
  'rarity.occasional': 'occasionale',
  'rarity.rare': 'raro',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'nessun richiamo di riferimento su Xeno-Canto per questa specie',
  'refcall.busy': 'Xeno-Canto è occupato (limite di frequenza) — riprova tra un momento',
  'refcall.unavailableCode': 'richiamo di riferimento non disponibile (Xeno-Canto {code})',
  'refcall.unavailable': 'richiamo di riferimento non disponibile',
  'refcall.cantPlay': 'non è stato possibile riprodurre questo richiamo di riferimento',
  'refcall.credit': 'Richiamo di riferimento: Xeno-Canto',
  'refcall.recBy': ' · reg. {rec}',
  'refcall.license': 'licenza',

  // ---- Spectrogram ----
  'spectro.loading': 'caricamento spettrogramma...',
  'spectro.rendering': 'generazione spettrogramma...',
  'spectro.unavailable': 'spettrogramma non disponibile',
  'spectro.noWebAudio': 'WebAudio non disponibile',
  'spectro.failed': 'spettrogramma non riuscito: ',

  // ---- False-positive flag pill ----
  'flag.report': 'segnala come falso positivo',
  'flag.armed': 'non è questo?',
  'flag.armedTitle': 'tocca di nuovo per segnalare come falso positivo',
  'flag.done': 'segnalato come falso positivo',
  'flag.failed': 'non riuscito',
  'flag.noPath': 'nessun percorso',
  'flag.errCode': 'err {code}',
  'flag.couldNotSave': 'impossibile salvare: {why}',
  'flag.needsIngress': 'richiede la connessione ingress di HA - {detail}',
  'flag.refused': 'BirdNET-Go ha rifiutato ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'sereno notturno',
  'weather.cloudy': 'nuvoloso',
  'weather.exceptional': 'eccezionale',
  'weather.fog': 'nebbia',
  'weather.hail': 'grandine',
  'weather.lightning': 'fulmini',
  'weather.lightning-rainy': 'temporale',
  'weather.partlycloudy': 'parzialmente nuvoloso',
  'weather.pouring': 'pioggia intensa',
  'weather.rainy': 'pioggia',
  'weather.snowy': 'neve',
  'weather.snowy-rainy': 'nevischio',
  'weather.sunny': 'soleggiato',
  'weather.windy': 'ventoso',
  'weather.windy-variant': 'ventoso',

  // ---- About modal ----
  'about.title': 'Gli uccelli fuori dalla tua finestra',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Un piccolo microfono identifica ogni uccello di passaggio grazie a <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, basato sul <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> di Cornell. Ogni specie compare come un’illustrazione nel collage, con una dimensione proporzionale a quanto spesso è stata ascoltata. I rilevamenti sicuri sono appollaiati; quelli incerti volano via.',
  'about.explore': 'esplora gli uccelli →',
};
