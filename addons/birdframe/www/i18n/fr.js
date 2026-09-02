// HABirdDashboard - French (fr) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural French. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).fr = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'stats',
  'view.atlas': 'atlas',
  'view.aria': 'Vue',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7J',
  'winpick.all': 'TOUT',

  // ---- Static head / about affordance ----
  'head.about': 'vos oiseaux',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Entendus récemment',
  'title.avianVisitors': 'Visiteurs ailés',

  // ---- Section aria-labels ----
  'aria.collage': 'Collage d’oiseaux',
  'aria.stats': 'Statistiques',
  'aria.atlas': 'Atlas',
  'names.aria': 'Espèces entendues',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'cette heure',
  'window.past12h': 'dernières 12h',
  'window.today': 'aujourd’hui',
  'window.thisWeek': 'cette semaine',
  'window.allTime': 'depuis toujours',

  // ---- Collage tooltip units ----
  'unit.call': 'cri',
  'unit.calls': 'cris',
  'unit.visit': 'visite',
  'unit.visits': 'visites',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Par période',
  'stats.byPeriodSub': 'détections, groupées par ancienneté',
  'stats.badgeNow': 'ACTUEL',
  'stats.badgeToday': 'AUJOURD’HUI',
  'stats.badgeWeek': 'SEMAINE',
  'stats.badgeAll': 'TOUT',
  'stats.lastHour': 'dernière heure',
  'stats.today': 'aujourd’hui',
  'stats.last7days': '7 derniers jours',
  'stats.allTime': 'depuis toujours',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Top espèces',
  'stats.topSpecCap': 'les plus entendues, {window}',
  'stats.noneInWindow': 'aucune détection sur cette période',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Premières détections',
  'stats.firstDetectionsSub': 'derniers ajouts à la liste des espèces',
  'stats.daysAgo': 'il y a {n}j',
  'stats.noneYet': 'aucune détection pour l’instant',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'aucune détection sur cette période',
  'stats.heatmapTotal': 'tout',
  'stats.byHourCap': 'détections par heure · {window}',
  'stats.byHourDayCap': 'détections par heure de la journée · 7 derniers jours',
  'stats.heatmapTrim': '{max} plus entendues sur {total}',

  // ---- Atlas ----
  'atlas.sort': 'trier l’atlas',
  'atlas.mostHeard': 'plus entendues',
  'atlas.mostRecent': 'plus récentes',
  'atlas.alphabetical': 'alphabétique',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'Aucun oiseau détecté pour l’instant.',
  'atlas.emptyHint': 'L’atlas se remplit au fur et à mesure que de nouvelles espèces sont identifiées.',
  'atlas.noWindowTitle': 'Aucune détection sur cette période.',
  'atlas.noWindowHint': 'Essayez une période plus longue.',
  'atlas.allTime': 'depuis toujours',
  'atlas.new': 'nouvelle',
  'atlas.newTitle': 'première fois que cette espèce est entendue ici',

  // ---- Detail modal: chrome ----
  'modal.close': 'Fermer',
  'modal.pose': 'Pose',
  'modal.perched': 'perché',
  'modal.inFlight': 'en vol',
  'modal.genus': 'genre',
  'modal.rarity': 'rareté',
  'modal.allTime': 'depuis toujours',
  'modal.firstHeard': 'première écoute',
  'modal.visits': 'visites',
  'modal.visitsWindow': 'visites {window}',
  'modal.recordings': 'Enregistrements',
  'modal.refCall': 'cri de référence',
  'modal.playRefCall': 'écouter le cri de référence',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Chargement de la description...',
  'modal.loadingRecordings': 'Chargement des enregistrements...',
  'modal.noRecordings': 'Aucun enregistrement pour l’instant.',
  'modal.recordingsFailed': 'Échec du chargement des enregistrements.',
  'modal.noDescription': 'Aucune description disponible.',
  'modal.captured': 'captures : {n}',
  'modal.play': 'lecture',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'commune',
  'rarity.regular': 'régulière',
  'rarity.occasional': 'occasionnelle',
  'rarity.rare': 'rare',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'aucun cri de référence sur Xeno-Canto pour cette espèce',
  'refcall.busy': 'Xeno-Canto est occupé (limite de débit) — réessayez dans un instant',
  'refcall.unavailableCode': 'cri de référence indisponible (Xeno-Canto {code})',
  'refcall.unavailable': 'cri de référence indisponible',
  'refcall.cantPlay': 'impossible de lire ce cri de référence',
  'refcall.credit': 'Cri de référence : Xeno-Canto',
  'refcall.recBy': ' · enr. {rec}',
  'refcall.license': 'licence',

  // ---- Spectrogram ----
  'spectro.loading': 'chargement du spectrogramme...',
  'spectro.rendering': 'génération du spectrogramme...',
  'spectro.unavailable': 'spectrogramme indisponible',
  'spectro.noWebAudio': 'WebAudio non disponible',
  'spectro.failed': 'échec du spectrogramme : ',

  // ---- False-positive flag pill ----
  'flag.report': 'signaler comme faux positif',
  'flag.armed': 'pas le bon ?',
  'flag.armedTitle': 'appuyez à nouveau pour signaler comme faux positif',
  'flag.done': 'signalé comme faux positif',
  'flag.failed': 'échec',
  'flag.noPath': 'aucun chemin',
  'flag.errCode': 'erreur {code}',
  'flag.couldNotSave': 'impossible d’enregistrer : {why}',
  'flag.needsIngress': 'nécessite la connexion ingress HA - {detail}',
  'flag.refused': 'BirdNET-Go a refusé ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'nuit claire',
  'weather.cloudy': 'nuageux',
  'weather.exceptional': 'exceptionnel',
  'weather.fog': 'brouillard',
  'weather.hail': 'grêle',
  'weather.lightning': 'orageux',
  'weather.lightning-rainy': 'pluie orageuse',
  'weather.partlycloudy': 'partiellement nuageux',
  'weather.pouring': 'pluie battante',
  'weather.rainy': 'pluvieux',
  'weather.snowy': 'neigeux',
  'weather.snowy-rainy': 'neige et pluie',
  'weather.sunny': 'ensoleillé',
  'weather.windy': 'venteux',
  'weather.windy-variant': 'venteux',

  // ---- About modal ----
  'about.title': 'Les oiseaux à votre fenêtre',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Un minuscule microphone identifie chaque oiseau de passage grâce à <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, construit sur le <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> de Cornell. Chaque espèce apparaît sous forme d’illustration dans le collage, dont la taille dépend de la fréquence à laquelle elle a été entendue. Les détections sûres se perchent ; les incertaines s’envolent.',
  'about.explore': 'explorer les oiseaux →',
};
