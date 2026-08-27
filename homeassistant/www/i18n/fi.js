// HABirdDashboard - Finnish (fi) UI strings.
(window.HABIRD_I18N = window.HABIRD_I18N || {}).fi = {
  // ---- View slider ----
  'view.collage': 'kollaasi',
  'view.stats': 'tilastot',
  'view.atlas': 'atlas',
  'view.aria': 'Näkymä',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1T',
  'winpick.12h': '12T',
  'winpick.24h': '24T',
  'winpick.7d': '7VRK',
  'winpick.all': 'KAIKKI',

  // ---- Static head / about affordance ----
  'head.about': 'lintusi',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Äskettäin kuultu',
  'title.avianVisitors': 'Siivekkäät vieraat',

  // ---- Section aria-labels ----
  'aria.collage': 'Lintukollaasi',
  'aria.stats': 'Tilastot',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'tällä tunnilla',
  'window.past12h': 'viimeiset 12 t',
  'window.today': 'tänään',
  'window.thisWeek': 'tällä viikolla',
  'window.allTime': 'kautta aikojen',

  // ---- Collage tooltip units ----
  'unit.call': 'kutsu',
  'unit.calls': 'kutsua',
  'unit.visit': 'käynti',
  'unit.visits': 'käyntiä',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Ajanjaksoittain',
  'stats.byPeriodSub': 'havainnot, ryhmitelty tuoreuden mukaan',
  'stats.badgeNow': 'NYT',
  'stats.badgeToday': 'TÄNÄÄN',
  'stats.badgeWeek': 'VIIKKO',
  'stats.badgeAll': 'KAIKKI',
  'stats.lastHour': 'viimeinen tunti',
  'stats.today': 'tänään',
  'stats.last7days': 'viimeiset 7 päivää',
  'stats.allTime': 'kautta aikojen',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Suosituimmat lajit',
  'stats.topSpecCap': 'eniten kuultu, {window}',
  'stats.noneInWindow': 'ei havaintoja tällä aikavälillä',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Ensihavainnot',
  'stats.firstDetectionsSub': 'uusimmat lisäykset lajilistaan',
  'stats.daysAgo': '{n} pv sitten',
  'stats.noneYet': 'ei vielä havaintoja',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'ei havaintoja tällä aikavälillä',
  'stats.heatmapTotal': 'kaikki',
  'stats.byHourCap': 'havainnot tunneittain · {window}',
  'stats.byHourDayCap': 'havainnot vuorokaudenajan mukaan · viimeiset 7 päivää',
  'stats.heatmapTrim': '{max} eniten kuultua {total}:sta',

  // ---- Atlas ----
  'atlas.sort': 'järjestä atlas',
  'atlas.mostHeard': 'eniten kuultu',
  'atlas.mostRecent': 'uusin',
  'atlas.alphabetical': 'aakkosjärjestys',
  'atlas.atoz': 'a → ö',
  'atlas.emptyTitle': 'Ei vielä havaittuja lintuja.',
  'atlas.emptyHint': 'Atlas täyttyy sitä mukaa kun uusia lajeja tunnistetaan.',
  'atlas.noWindowTitle': 'Ei havaintoja tällä aikavälillä.',
  'atlas.noWindowHint': 'Kokeile pidempää aikaväliä.',
  'atlas.allTime': 'kautta aikojen',
  'atlas.new': 'uusi',
  'atlas.newTitle': 'ensimmäinen kerta, kun tämä laji on kuultu täällä',

  // ---- Detail modal: chrome ----
  'modal.close': 'Sulje',
  'modal.pose': 'Asento',
  'modal.perched': 'istuva',
  'modal.inFlight': 'lennossa',
  'modal.genus': 'suku',
  'modal.rarity': 'harvinaisuus',
  'modal.allTime': 'kautta aikojen',
  'modal.firstHeard': 'ensi kerran kuultu',
  'modal.visits': 'käynnit',
  'modal.visitsWindow': 'käyntejä {window}',
  'modal.recordings': 'Tallenteet',
  'modal.refCall': 'vertailuääni',
  'modal.playRefCall': 'toista vertailuääni',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Ladataan kuvausta...',
  'modal.loadingRecordings': 'Ladataan tallenteita...',
  'modal.noRecordings': 'Ei vielä tallenteita.',
  'modal.recordingsFailed': 'Tallenteiden lataaminen epäonnistui.',
  'modal.noDescription': 'Kuvausta ei ole saatavilla.',
  'modal.captured': '{n} otosta',
  'modal.play': 'toista',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'yleinen',
  'rarity.regular': 'säännöllinen',
  'rarity.occasional': 'satunnainen',
  'rarity.rare': 'harvinainen',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'ei vertailuääntä Xeno-Cantossa tälle lajille',
  'refcall.busy': 'Xeno-Canto on varattu (nopeusrajoitus) — yritä hetken kuluttua uudelleen',
  'refcall.unavailableCode': 'vertailuääni ei ole saatavilla (Xeno-Canto {code})',
  'refcall.unavailable': 'vertailuääni ei ole saatavilla',
  'refcall.cantPlay': 'tätä vertailuääntä ei voitu toistaa',
  'refcall.credit': 'Vertailuääni: Xeno-Canto',
  'refcall.recBy': ' · ään. {rec}',
  'refcall.license': 'lisenssi',

  // ---- Spectrogram ----
  'spectro.loading': 'ladataan spektrogrammia...',
  'spectro.rendering': 'muodostetaan spektrogrammia...',
  'spectro.unavailable': 'spektrogrammi ei ole saatavilla',
  'spectro.noWebAudio': 'WebAudio ei ole käytettävissä',
  'spectro.failed': 'spektrogrammi epäonnistui: ',

  // ---- False-positive flag pill ----
  'flag.report': 'ilmoita virhetunnistukseksi',
  'flag.armed': 'ei tämä?',
  'flag.armedTitle': 'napauta uudelleen ilmoittaaksesi virhetunnistuksena',
  'flag.done': 'ilmoitettu virhetunnistuksena',
  'flag.failed': 'epäonnistui',
  'flag.noPath': 'ei polkua',
  'flag.errCode': 'virhe {code}',
  'flag.couldNotSave': 'tallennus epäonnistui: {why}',
  'flag.needsIngress': 'vaatii HA:n ingress-yhteyden - {detail}',
  'flag.refused': 'BirdNET-Go kieltäytyi ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'selkeää',
  'weather.cloudy': 'pilvistä',
  'weather.exceptional': 'poikkeuksellista',
  'weather.fog': 'sumuista',
  'weather.hail': 'raekuuroja',
  'weather.lightning': 'ukkosta',
  'weather.lightning-rainy': 'ukkoskuuroja',
  'weather.partlycloudy': 'puolipilvistä',
  'weather.pouring': 'kaatosadetta',
  'weather.rainy': 'sateista',
  'weather.snowy': 'lumisadetta',
  'weather.snowy-rainy': 'räntäsadetta',
  'weather.sunny': 'aurinkoista',
  'weather.windy': 'tuulista',
  'weather.windy-variant': 'tuulista ja pilvistä',

  // ---- About modal ----
  'about.title': 'Linnut ikkunasi takana',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Pieni mikrofoni tunnistaa jokaisen ohilentävän linnun käyttäen sovellusta <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, joka perustuu Cornellin <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>-malliin. Jokainen laji näkyy kollaasissa kuvituksena, jonka koko riippuu siitä, kuinka usein sitä on kuultu. Varmat havainnot istuvat; epävarmat lentävät ohi.',
  'about.explore': 'tutustu lintuihin →',
};
