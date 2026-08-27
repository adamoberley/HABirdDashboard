// HABirdDashboard - Spanish (es) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural Spanish. Any key omitted here falls back to the en
// reference table by design. Scientific names and the stable rarity/label
// CODES are never translated - only the display strings for existing keys.
// {name} placeholders are preserved and filled by tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).es = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'estadísticas',
  'view.atlas': 'atlas',
  'view.aria': 'Vista',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7D',
  'winpick.all': 'TODO',

  // ---- Static head / about affordance ----
  'head.about': 'tus aves',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Escuchado recientemente',
  'title.avianVisitors': 'Visitantes alados',

  // ---- Section aria-labels ----
  'aria.collage': 'Collage de aves',
  'aria.stats': 'Estadísticas',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'esta hora',
  'window.past12h': 'últimas 12h',
  'window.today': 'hoy',
  'window.thisWeek': 'esta semana',
  'window.allTime': 'siempre',

  // ---- Collage tooltip units ----
  'unit.call': 'llamada',
  'unit.calls': 'llamadas',
  'unit.visit': 'visita',
  'unit.visits': 'visitas',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Por período',
  'stats.byPeriodSub': 'detecciones, agrupadas por antigüedad',
  'stats.badgeNow': 'AHORA',
  'stats.badgeToday': 'HOY',
  'stats.badgeWeek': 'SEMANA',
  'stats.badgeAll': 'TODO',
  'stats.lastHour': 'última hora',
  'stats.today': 'hoy',
  'stats.last7days': 'últimos 7 días',
  'stats.allTime': 'siempre',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Especies principales',
  'stats.topSpecCap': 'más escuchadas, {window}',
  'stats.noneInWindow': 'sin detecciones en este período',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Primeras detecciones',
  'stats.firstDetectionsSub': 'incorporaciones más recientes a la lista de vida',
  'stats.daysAgo': 'hace {n}d',
  'stats.noneYet': 'todavía sin detecciones',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'sin detecciones en este período',
  'stats.heatmapTotal': 'todas',
  'stats.byHourCap': 'detecciones por hora · {window}',
  'stats.byHourDayCap': 'detecciones por hora del día · últimos 7 días',
  'stats.heatmapTrim': '{max} más escuchadas de {total}',

  // ---- Atlas ----
  'atlas.sort': 'ordenar atlas',
  'atlas.mostHeard': 'más escuchadas',
  'atlas.mostRecent': 'más recientes',
  'atlas.alphabetical': 'alfabético',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'Aún no se ha detectado ninguna ave.',
  'atlas.emptyHint': 'El atlas se completa a medida que se identifican nuevas especies.',
  'atlas.noWindowTitle': 'Sin detecciones en este período.',
  'atlas.noWindowHint': 'Prueba con un período más largo.',
  'atlas.allTime': 'siempre',
  'atlas.new': 'nueva',
  'atlas.newTitle': 'primera vez que se escucha esta especie aquí',

  // ---- Detail modal: chrome ----
  'modal.close': 'Cerrar',
  'modal.pose': 'Postura',
  'modal.perched': 'posada',
  'modal.inFlight': 'en vuelo',
  'modal.genus': 'género',
  'modal.rarity': 'rareza',
  'modal.allTime': 'siempre',
  'modal.firstHeard': 'primera vez escuchada',
  'modal.visits': 'visitas',
  'modal.visitsWindow': 'visitas {window}',
  'modal.recordings': 'Grabaciones',
  'modal.refCall': 'llamada de referencia',
  'modal.playRefCall': 'reproducir llamada de referencia',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Cargando descripción...',
  'modal.loadingRecordings': 'Cargando grabaciones...',
  'modal.noRecordings': 'Aún no hay grabaciones.',
  'modal.recordingsFailed': 'No se pudieron cargar las grabaciones.',
  'modal.noDescription': 'No hay descripción disponible.',
  'modal.captured': 'capturas: {n}',
  'modal.play': 'reproducir',
  // 'modal.scrub' deliberately omitted -> falls back to the en value.

  // ---- Rarity labels ----
  'rarity.common': 'común',
  'rarity.regular': 'regular',
  'rarity.occasional': 'ocasional',
  'rarity.rare': 'rara',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'no hay llamada de referencia en Xeno-Canto para esta especie',
  'refcall.busy': 'Xeno-Canto está ocupado (límite de solicitudes) — inténtalo de nuevo en un momento',
  'refcall.unavailableCode': 'llamada de referencia no disponible (Xeno-Canto {code})',
  'refcall.unavailable': 'llamada de referencia no disponible',
  'refcall.cantPlay': 'no se pudo reproducir esta llamada de referencia',
  'refcall.credit': 'Llamada de referencia: Xeno-Canto',
  'refcall.recBy': ' · grab. {rec}',
  'refcall.license': 'licencia',

  // ---- Spectrogram ----
  'spectro.loading': 'cargando espectrograma...',
  'spectro.rendering': 'generando espectrograma...',
  'spectro.unavailable': 'espectrograma no disponible',
  'spectro.noWebAudio': 'WebAudio no disponible',
  'spectro.failed': 'error al generar el espectrograma: ',

  // ---- False-positive flag pill ----
  'flag.report': 'reportar como falso positivo',
  'flag.armed': '¿no es esta?',
  'flag.armedTitle': 'toca de nuevo para reportar como falso positivo',
  'flag.done': 'reportado como falso positivo',
  'flag.failed': 'error',
  'flag.noPath': 'sin ruta',
  'flag.errCode': 'error {code}',
  'flag.couldNotSave': 'no se pudo guardar: {why}',
  'flag.needsIngress': 'requiere la conexión ingress de HA - {detail}',
  'flag.refused': 'BirdNET-Go rechazó la solicitud ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'noche despejada',
  'weather.cloudy': 'nublado',
  'weather.exceptional': 'excepcional',
  'weather.fog': 'niebla',
  'weather.hail': 'granizo',
  'weather.lightning': 'tormenta eléctrica',
  'weather.lightning-rainy': 'tormenta con lluvia',
  'weather.partlycloudy': 'parcialmente nublado',
  'weather.pouring': 'fuertes lluvias',
  'weather.rainy': 'lluvia',
  'weather.snowy': 'nieve',
  'weather.snowy-rainy': 'aguanieve',
  'weather.sunny': 'despejado',
  'weather.windy': 'ventoso',
  'weather.windy-variant': 'ventoso',

  // ---- About modal ----
  'about.title': 'Las aves fuera de tu ventana',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Un pequeño micrófono identifica cada ave que pasa cerca con <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, construido sobre el <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> de Cornell. Cada especie aparece como una ilustración en el collage, con un tamaño según la frecuencia con la que se ha escuchado. Las detecciones seguras aparecen posadas; las inciertas, en vuelo.',
  'about.explore': 'explorar las aves →',
};
