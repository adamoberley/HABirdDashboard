// HABirdDashboard - Polish (pl) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Polish. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).pl = {
  // ---- View slider ----
  'view.collage': 'kolaż',
  'view.stats': 'statystyki',
  'view.atlas': 'atlas',
  'view.aria': 'Widok',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7D',
  'winpick.all': 'WSZ',

  // ---- Static head / about affordance ----
  'head.about': 'twoje ptaki',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Ostatnio słyszane',
  'title.avianVisitors': 'Skrzydlaci goście',

  // ---- Section aria-labels ----
  'aria.collage': 'Kolaż ptaków',
  'aria.stats': 'Statystyki',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'ostatnia godzina',
  'window.past12h': 'ostatnie 12 godz.',
  'window.today': 'dziś',
  'window.thisWeek': 'ten tydzień',
  'window.allTime': 'zawsze',

  // ---- Collage tooltip units ----
  'unit.call': 'głos',
  'unit.calls': 'głosów',
  'unit.visit': 'wizyta',
  'unit.visits': 'wizyt',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Według okresu',
  'stats.byPeriodSub': 'wykrycia pogrupowane według aktualności',
  'stats.badgeNow': 'TERAZ',
  'stats.badgeToday': 'DZIŚ',
  'stats.badgeWeek': 'TYDZIEŃ',
  'stats.badgeAll': 'ZAWSZE',
  'stats.lastHour': 'ostatnia godzina',
  'stats.today': 'dziś',
  'stats.last7days': 'ostatnie 7 dni',
  'stats.allTime': 'zawsze',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Top gatunki',
  'stats.topSpecCap': 'najczęściej słyszane, {window}',
  'stats.noneInWindow': 'brak wykryć w tym okresie',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Pierwsze wykrycia',
  'stats.firstDetectionsSub': 'najnowsze pozycje na liście życiowej',
  'stats.daysAgo': '{n}d temu',
  'stats.noneYet': 'brak wykryć',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'brak wykryć w tym okresie',
  'stats.heatmapTotal': 'wszystkie',
  'stats.byHourCap': 'wykrycia według godzin · {window}',
  'stats.byHourDayCap': 'wykrycia według pory dnia · ostatnie 7 dni',
  'stats.heatmapTrim': '{max} najczęściej słyszanych z {total}',

  // ---- Atlas ----
  'atlas.sort': 'sortuj atlas',
  'atlas.mostHeard': 'najczęściej słyszane',
  'atlas.mostRecent': 'najnowsze',
  'atlas.alphabetical': 'alfabetycznie',
  'atlas.atoz': 'a → ż',
  'atlas.emptyTitle': 'Nie wykryto jeszcze żadnych ptaków.',
  'atlas.emptyHint': 'Atlas wypełnia się w miarę identyfikowania nowych gatunków.',
  'atlas.noWindowTitle': 'Brak wykryć w tym okresie.',
  'atlas.noWindowHint': 'Spróbuj dłuższego okresu.',
  'atlas.allTime': 'zawsze',
  'atlas.new': 'nowy',
  'atlas.newTitle': 'pierwszy raz, gdy ten gatunek został tutaj usłyszany',

  // ---- Detail modal: chrome ----
  'modal.close': 'Zamknij',
  'modal.pose': 'Poza',
  'modal.perched': 'siedzący',
  'modal.inFlight': 'w locie',
  'modal.genus': 'rodzaj',
  'modal.rarity': 'rzadkość',
  'modal.allTime': 'zawsze',
  'modal.firstHeard': 'pierwsze usłyszenie',
  'modal.visits': 'wizyty',
  'modal.visitsWindow': 'wizyty {window}',
  'modal.recordings': 'Nagrania',
  'modal.refCall': 'głos referencyjny',
  'modal.playRefCall': 'odtwórz głos referencyjny',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Wczytywanie opisu...',
  'modal.loadingRecordings': 'Wczytywanie nagrań...',
  'modal.noRecordings': 'Brak nagrań.',
  'modal.recordingsFailed': 'Nie udało się wczytać nagrań.',
  'modal.noDescription': 'Brak dostępnego opisu.',
  'modal.captured': 'zarejestrowano: {n}',
  'modal.play': 'odtwórz',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'pospolity',
  'rarity.regular': 'regularny',
  'rarity.occasional': 'sporadyczny',
  'rarity.rare': 'rzadki',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'brak głosu referencyjnego na Xeno-Canto dla tego gatunku',
  'refcall.busy': 'Xeno-Canto jest zajęte (limit zapytań) — spróbuj ponownie za chwilę',
  'refcall.unavailableCode': 'głos referencyjny niedostępny (Xeno-Canto {code})',
  'refcall.unavailable': 'głos referencyjny niedostępny',
  'refcall.cantPlay': 'nie udało się odtworzyć tego głosu referencyjnego',
  'refcall.credit': 'Głos referencyjny: Xeno-Canto',
  'refcall.recBy': ' · nagr. {rec}',
  'refcall.license': 'licencja',

  // ---- Spectrogram ----
  'spectro.loading': 'wczytywanie spektrogramu...',
  'spectro.rendering': 'renderowanie spektrogramu...',
  'spectro.unavailable': 'spektrogram niedostępny',
  'spectro.noWebAudio': 'WebAudio niedostępne',
  'spectro.failed': 'błąd spektrogramu: ',

  // ---- False-positive flag pill ----
  'flag.report': 'zgłoś jako błędne wykrycie',
  'flag.armed': 'to nie to?',
  'flag.armedTitle': 'dotknij ponownie, aby zgłosić jako błędne wykrycie',
  'flag.done': 'zgłoszono jako błędne wykrycie',
  'flag.failed': 'niepowodzenie',
  'flag.noPath': 'brak ścieżki',
  'flag.errCode': 'błąd {code}',
  'flag.couldNotSave': 'nie udało się zapisać: {why}',
  'flag.needsIngress': 'wymaga połączenia HA ingress - {detail}',
  'flag.refused': 'BirdNET-Go odmówiło ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'bezchmurna noc',
  'weather.cloudy': 'pochmurno',
  'weather.exceptional': 'wyjątkowe',
  'weather.fog': 'mgła',
  'weather.hail': 'grad',
  'weather.lightning': 'błyskawice',
  'weather.lightning-rainy': 'burza z piorunami',
  'weather.partlycloudy': 'częściowe zachmurzenie',
  'weather.pouring': 'ulewa',
  'weather.rainy': 'deszczowo',
  'weather.snowy': 'śnieg',
  'weather.snowy-rainy': 'deszcz ze śniegiem',
  'weather.sunny': 'słonecznie',
  'weather.windy': 'wietrznie',
  'weather.windy-variant': 'wietrznie',

  // ---- About modal ----
  'about.title': 'Ptaki za twoim oknem',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Malutki mikrofon rozpoznaje każdego przelatującego ptaka dzięki <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, zbudowanemu na bazie <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> Uniwersytetu Cornell. Każdy gatunek pojawia się w kolażu jako ilustracja, której rozmiar zależy od tego, jak często był słyszany. Pewne wykrycia siedzą, niepewne przelatują obok.',
  'about.explore': 'poznaj ptaki →',
};
