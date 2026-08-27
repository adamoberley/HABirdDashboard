// HABirdDashboard - German (de) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural German. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).de = {
  // ---- View slider ----
  'view.collage': 'Collage',
  'view.stats': 'Statistik',
  'view.atlas': 'Atlas',
  'view.aria': 'Ansicht',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7T',
  'winpick.all': 'ALLE',

  // ---- Static head / about affordance ----
  'head.about': 'deine Vögel',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Kürzlich gehört',
  'title.avianVisitors': 'Gefiederte Gäste',

  // ---- Section aria-labels ----
  'aria.collage': 'Vogelcollage',
  'aria.stats': 'Statistik',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'diese Stunde',
  'window.past12h': 'letzte 12 Stunden',
  'window.today': 'heute',
  'window.thisWeek': 'diese Woche',
  'window.allTime': 'insgesamt',

  // ---- Collage tooltip units ----
  'unit.call': 'Ruf',
  'unit.calls': 'Rufe',
  'unit.visit': 'Besuch',
  'unit.visits': 'Besuche',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Nach Zeitraum',
  'stats.byPeriodSub': 'Erkennungen, gruppiert nach Aktualität',
  'stats.badgeNow': 'JETZT',
  'stats.badgeToday': 'HEUTE',
  'stats.badgeWeek': 'WOCHE',
  'stats.badgeAll': 'ALLE',
  'stats.lastHour': 'letzte Stunde',
  'stats.today': 'heute',
  'stats.last7days': 'letzte 7 Tage',
  'stats.allTime': 'insgesamt',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Top-Arten',
  'stats.topSpecCap': 'am häufigsten gehört, {window}',
  'stats.noneInWindow': 'keine Erkennungen in diesem Zeitraum',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Erste Erkennungen',
  'stats.firstDetectionsSub': 'neueste Ergänzungen der Artenliste',
  'stats.daysAgo': 'vor {n}T',
  'stats.noneYet': 'noch keine Erkennungen',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'keine Erkennungen in diesem Zeitraum',
  'stats.heatmapTotal': 'alle',
  'stats.byHourCap': 'Erkennungen nach Stunde · {window}',
  'stats.byHourDayCap': 'Erkennungen nach Tageszeit · letzte 7 Tage',
  'stats.heatmapTrim': '{max} meistgehörte von {total}',

  // ---- Atlas ----
  'atlas.sort': 'Atlas sortieren',
  'atlas.mostHeard': 'meistgehört',
  'atlas.mostRecent': 'neueste',
  'atlas.alphabetical': 'alphabetisch',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'Noch keine Vögel erkannt.',
  'atlas.emptyHint': 'Der Atlas füllt sich, sobald neue Arten identifiziert werden.',
  'atlas.noWindowTitle': 'Keine Erkennungen in diesem Zeitraum.',
  'atlas.noWindowHint': 'Versuche einen längeren Zeitraum.',
  'atlas.allTime': 'insgesamt',
  'atlas.new': 'neu',
  'atlas.newTitle': 'diese Art wurde hier noch nie zuvor gehört',

  // ---- Detail modal: chrome ----
  'modal.close': 'Schließen',
  'modal.pose': 'Haltung',
  'modal.perched': 'sitzend',
  'modal.inFlight': 'im Flug',
  'modal.genus': 'Gattung',
  'modal.rarity': 'Seltenheit',
  'modal.allTime': 'insgesamt',
  'modal.firstHeard': 'zuerst gehört',
  'modal.visits': 'Besuche',
  'modal.visitsWindow': 'Besuche {window}',
  'modal.recordings': 'Aufnahmen',
  'modal.refCall': 'Referenzruf',
  'modal.playRefCall': 'Referenzruf abspielen',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Beschreibung wird geladen...',
  'modal.loadingRecordings': 'Aufnahmen werden geladen...',
  'modal.noRecordings': 'Noch keine Aufnahmen.',
  'modal.recordingsFailed': 'Aufnahmen konnten nicht geladen werden.',
  'modal.noDescription': 'Keine Beschreibung verfügbar.',
  'modal.captured': '{n} aufgenommen',
  'modal.play': 'abspielen',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'häufig',
  'rarity.regular': 'regelmäßig',
  'rarity.occasional': 'gelegentlich',
  'rarity.rare': 'selten',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'kein Referenzruf auf Xeno-Canto für diese Art',
  'refcall.busy': 'Xeno-Canto ist ausgelastet (Ratenbegrenzung) — versuch es gleich noch einmal',
  'refcall.unavailableCode': 'Referenzruf nicht verfügbar (Xeno-Canto {code})',
  'refcall.unavailable': 'Referenzruf nicht verfügbar',
  'refcall.cantPlay': 'dieser Referenzruf konnte nicht abgespielt werden',
  'refcall.credit': 'Referenzruf: Xeno-Canto',
  'refcall.recBy': ' · Aufn. {rec}',
  'refcall.license': 'Lizenz',

  // ---- Spectrogram ----
  'spectro.loading': 'Spektrogramm wird geladen...',
  'spectro.rendering': 'Spektrogramm wird gerendert...',
  'spectro.unavailable': 'Spektrogramm nicht verfügbar',
  'spectro.noWebAudio': 'WebAudio nicht verfügbar',
  'spectro.failed': 'Spektrogramm fehlgeschlagen: ',

  // ---- False-positive flag pill ----
  'flag.report': 'als Fehlerkennung melden',
  'flag.armed': 'nicht die?',
  'flag.armedTitle': 'nochmal tippen, um als Fehlerkennung zu melden',
  'flag.done': 'als Fehlerkennung gemeldet',
  'flag.failed': 'fehlgeschlagen',
  'flag.noPath': 'kein Pfad',
  'flag.errCode': 'Fehler {code}',
  'flag.couldNotSave': 'konnte nicht gespeichert werden: {why}',
  'flag.needsIngress': 'benötigt die HA-Ingress-Verbindung - {detail}',
  'flag.refused': 'BirdNET-Go hat abgelehnt ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'klare Nacht',
  'weather.cloudy': 'bewölkt',
  'weather.exceptional': 'außergewöhnlich',
  'weather.fog': 'Nebel',
  'weather.hail': 'Hagel',
  'weather.lightning': 'Blitze',
  'weather.lightning-rainy': 'Gewitter mit Regen',
  'weather.partlycloudy': 'teilweise bewölkt',
  'weather.pouring': 'starker Regen',
  'weather.rainy': 'regnerisch',
  'weather.snowy': 'Schnee',
  'weather.snowy-rainy': 'Schneeregen',
  'weather.sunny': 'sonnig',
  'weather.windy': 'windig',
  'weather.windy-variant': 'windig',

  // ---- About modal ----
  'about.title': 'Die Vögel vor deinem Fenster',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Ein winziges Mikrofon erkennt jeden vorbeifliegenden Vogel mit <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, das auf Cornells <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> aufbaut. Jede Art erscheint als Illustration in der Collage, deren Größe sich danach richtet, wie oft sie gehört wurde. Sichere Erkennungen sitzen, unsichere fliegen vorbei.',
  'about.explore': 'die Vögel erkunden →',
};
