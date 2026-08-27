// HABirdDashboard - Portuguese (pt) UI strings.
//
// A standalone, self-registering translation: keys mirror en.js exactly;
// values are natural European Portuguese. Any key omitted here falls back to
// the en reference table by design. Scientific names and the stable
// rarity/label CODES are never translated - only the display strings for
// existing keys. {name} placeholders are preserved and filled by
// tt(key, {name: value}).
(window.HABIRD_I18N = window.HABIRD_I18N || {}).pt = {
  // ---- View slider ----
  'view.collage': 'colagem',
  'view.stats': 'estatísticas',
  'view.atlas': 'atlas',
  'view.aria': 'Vista',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7D',
  'winpick.all': 'TUDO',

  // ---- Static head / about affordance ----
  'head.about': 'as suas aves',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Ouvidas recentemente',
  'title.avianVisitors': 'Visitantes alados',

  // ---- Section aria-labels ----
  'aria.collage': 'Colagem de aves',
  'aria.stats': 'Estatísticas',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'esta hora',
  'window.past12h': 'últimas 12h',
  'window.today': 'hoje',
  'window.thisWeek': 'esta semana',
  'window.allTime': 'sempre',

  // ---- Collage tooltip units ----
  'unit.call': 'chamada',
  'unit.calls': 'chamadas',
  'unit.visit': 'visita',
  'unit.visits': 'visitas',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'Por período',
  'stats.byPeriodSub': 'deteções, agrupadas por recência',
  'stats.badgeNow': 'AGORA',
  'stats.badgeToday': 'HOJE',
  'stats.badgeWeek': 'SEMANA',
  'stats.badgeAll': 'TUDO',
  'stats.lastHour': 'última hora',
  'stats.today': 'hoje',
  'stats.last7days': 'últimos 7 dias',
  'stats.allTime': 'sempre',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Principais espécies',
  'stats.topSpecCap': 'mais ouvidas, {window}',
  'stats.noneInWindow': 'sem deteções no período',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'Primeiras deteções',
  'stats.firstDetectionsSub': 'as adições mais recentes à lista de espécies',
  'stats.daysAgo': 'há {n}d',
  'stats.noneYet': 'ainda sem deteções',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'sem deteções neste período',
  'stats.heatmapTotal': 'tudo',
  'stats.byHourCap': 'deteções por hora · {window}',
  'stats.byHourDayCap': 'deteções por hora do dia · últimos 7 dias',
  'stats.heatmapTrim': '{max} mais ouvidas de {total}',

  // ---- Atlas ----
  'atlas.sort': 'ordenar atlas',
  'atlas.mostHeard': 'mais ouvidas',
  'atlas.mostRecent': 'mais recentes',
  'atlas.alphabetical': 'alfabética',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'Ainda não foram detetadas aves.',
  'atlas.emptyHint': 'O atlas preenche-se à medida que novas espécies são identificadas.',
  'atlas.noWindowTitle': 'Sem deteções neste período.',
  'atlas.noWindowHint': 'Experimente um período mais longo.',
  'atlas.allTime': 'sempre',
  'atlas.new': 'nova',
  'atlas.newTitle': 'primeira vez que esta espécie foi ouvida aqui',

  // ---- Detail modal: chrome ----
  'modal.close': 'Fechar',
  'modal.pose': 'Postura',
  'modal.perched': 'pousada',
  'modal.inFlight': 'em voo',
  'modal.genus': 'género',
  'modal.rarity': 'raridade',
  'modal.allTime': 'sempre',
  'modal.firstHeard': 'ouvida pela primeira vez',
  'modal.visits': 'visitas',
  'modal.visitsWindow': 'visitas {window}',
  'modal.recordings': 'Gravações',
  'modal.refCall': 'chamada de referência',
  'modal.playRefCall': 'reproduzir chamada de referência',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'A carregar descrição...',
  'modal.loadingRecordings': 'A carregar gravações...',
  'modal.noRecordings': 'Ainda sem gravações.',
  'modal.recordingsFailed': 'Falha ao carregar gravações.',
  'modal.noDescription': 'Sem descrição disponível.',
  'modal.captured': 'capturas: {n}',
  'modal.play': 'reproduzir',
  'modal.scrub': 'arrastar',

  // ---- Rarity labels ----
  'rarity.common': 'comum',
  'rarity.regular': 'regular',
  'rarity.occasional': 'ocasional',
  'rarity.rare': 'rara',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'sem chamada de referência no Xeno-Canto para esta espécie',
  'refcall.busy': 'o Xeno-Canto está ocupado (limite de taxa) — tente novamente dentro de momentos',
  'refcall.unavailableCode': 'chamada de referência indisponível (Xeno-Canto {code})',
  'refcall.unavailable': 'chamada de referência indisponível',
  'refcall.cantPlay': 'não foi possível reproduzir esta chamada de referência',
  'refcall.credit': 'Chamada de referência: Xeno-Canto',
  'refcall.recBy': ' · grav. {rec}',
  'refcall.license': 'licença',

  // ---- Spectrogram ----
  'spectro.loading': 'a carregar espectrograma...',
  'spectro.rendering': 'a gerar espectrograma...',
  'spectro.unavailable': 'espectrograma indisponível',
  'spectro.noWebAudio': 'WebAudio não disponível',
  'spectro.failed': 'falha no espectrograma: ',

  // ---- False-positive flag pill ----
  'flag.report': 'reportar como falso positivo',
  'flag.armed': 'não é esta?',
  'flag.armedTitle': 'toque novamente para reportar como falso positivo',
  'flag.done': 'reportado como falso positivo',
  'flag.failed': 'falhou',
  'flag.noPath': 'sem caminho',
  'flag.errCode': 'erro {code}',
  'flag.couldNotSave': 'não foi possível guardar: {why}',
  'flag.needsIngress': 'requer a ligação ingress do HA - {detail}',
  'flag.refused': 'o BirdNET-Go recusou ({err})',

  // ---- Weather conditions (standalone / fallback path) ----
  // Keyed by Home Assistant's weather condition slugs. In the card build HA's
  // own localized text is preferred; this table is the standalone/fallback.
  'weather.clear-night': 'noite limpa',
  'weather.cloudy': 'nublado',
  'weather.exceptional': 'excecional',
  'weather.fog': 'nevoeiro',
  'weather.hail': 'granizo',
  'weather.lightning': 'trovoada',
  'weather.lightning-rainy': 'trovoada com chuva',
  'weather.partlycloudy': 'parcialmente nublado',
  'weather.pouring': 'chuva forte',
  'weather.rainy': 'chuvoso',
  'weather.snowy': 'nevoso',
  'weather.snowy-rainy': 'neve e chuva',
  'weather.sunny': 'ensolarado',
  'weather.windy': 'ventoso',
  'weather.windy-variant': 'ventoso',

  // ---- About modal ----
  'about.title': 'As aves do outro lado da sua janela',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'Um pequeno microfone identifica cada ave que passa com o <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, construído sobre o <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a> da Cornell. Cada espécie surge como uma ilustração na colagem, com o tamanho proporcional à frequência com que foi ouvida. As deteções mais confiantes pousam; as incertas voam de passagem.',
  'about.explore': 'explorar as aves →',
};
