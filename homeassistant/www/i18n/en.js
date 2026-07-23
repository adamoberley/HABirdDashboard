// HABirdDashboard - English UI strings (the complete reference set).
//
// Each language is a standalone, self-registering file: a new language is
// a single new sibling file (e.g. da.js) that touches nothing else. `en`
// carries EVERY key and is the fallback for any string a translation omits.
// The `= x || {}`-then-assign pattern makes load order irrelevant.
//
// Interpolation: values may contain {name} placeholders filled by t(key,
// {name: value}) at the call site.
(window.HABIRD_I18N = window.HABIRD_I18N || {}).en = {
  // ---- View slider ----
  'view.collage': 'collage',
  'view.stats': 'stats',
  'view.atlas': 'atlas',
  'view.aria': 'View',

  // ---- Window picker (abbreviations) ----
  'winpick.1h': '1H',
  'winpick.12h': '12H',
  'winpick.24h': '24H',
  'winpick.7d': '7D',
  'winpick.all': 'ALL',

  // ---- Static head / about affordance ----
  'head.about': 'your birds',
  // ---- View titles (dynamic, one per view) ----
  'title.heardRecently': 'Heard Recently',
  'title.avianVisitors': 'Avian Visitors',

  // ---- Section aria-labels ----
  'aria.collage': 'Bird collage',
  'aria.stats': 'Stats',
  'aria.atlas': 'Atlas',

  // ---- Time-window labels (windowLabel) ----
  'window.thisHour': 'this hour',
  'window.past12h': 'past 12h',
  'window.today': 'today',
  'window.thisWeek': 'this week',
  'window.allTime': 'all time',

  // ---- Collage tooltip units ----
  'unit.call': 'call',
  'unit.calls': 'calls',

  // ---- Stats: By Period ----
  'stats.byPeriod': 'By Period',
  'stats.byPeriodSub': 'detections, grouped by recency',
  'stats.badgeNow': 'NOW',
  'stats.badgeToday': 'TODAY',
  'stats.badgeWeek': 'WEEK',
  'stats.badgeAll': 'ALL',
  'stats.lastHour': 'last hour',
  'stats.today': 'today',
  'stats.last7days': 'last 7 days',
  'stats.allTime': 'all time',
  // ---- Stats: Top Species ----
  'stats.topSpecies': 'Top Species',
  'stats.topSpecCap': 'most-heard, {window}',
  'stats.noneInWindow': 'no detections in window',
  // ---- Stats: First Detections ----
  'stats.firstDetections': 'First Detections',
  'stats.firstDetectionsSub': 'newest additions to the life list',
  'stats.daysAgo': '{n}d ago',
  'stats.noneYet': 'no detections yet',
  // ---- Stats: activity heatmap ----
  'stats.heatmapEmpty': 'no detections in this window',
  'stats.heatmapTotal': 'all',
  'stats.byHourCap': 'detections by hour · {window}',
  'stats.byHourDayCap': 'detections by hour of day · last 7 days',
  'stats.heatmapTrim': '{max} most-heard of {total}',

  // ---- Atlas ----
  'atlas.sort': 'sort atlas',
  'atlas.mostHeard': 'most heard',
  'atlas.mostRecent': 'most recent',
  'atlas.alphabetical': 'alphabetical',
  'atlas.atoz': 'a → z',
  'atlas.emptyTitle': 'No birds detected yet.',
  'atlas.emptyHint': 'The atlas fills up as new species are identified.',
  'atlas.noWindowTitle': 'No detections in this window.',
  'atlas.noWindowHint': 'Try a longer time window.',
  'atlas.allTime': 'all time',
  'atlas.new': 'new',
  'atlas.newTitle': 'first time this species has ever been heard here',

  // ---- Detail modal: chrome ----
  'modal.close': 'Close',
  'modal.pose': 'Pose',
  'modal.perched': 'perched',
  'modal.inFlight': 'in flight',
  'modal.genus': 'genus',
  'modal.rarity': 'rarity',
  'modal.allTime': 'all time',
  'modal.firstHeard': 'first heard',
  'modal.recordings': 'Recordings',
  'modal.refCall': 'reference call',
  'modal.playRefCall': 'play reference call',
  'modal.wiki': 'wiki',
  'modal.ebird': 'ebird',
  // ---- Detail modal: dynamic ----
  'modal.loadingDesc': 'Loading description...',
  'modal.loadingRecordings': 'Loading recordings...',
  'modal.noRecordings': 'No recordings yet.',
  'modal.recordingsFailed': 'Failed to load recordings.',
  'modal.noDescription': 'No description available.',
  'modal.captured': '{n} captured',
  'modal.play': 'play',
  'modal.scrub': 'scrub',

  // ---- Rarity labels ----
  'rarity.common': 'common',
  'rarity.regular': 'regular',
  'rarity.occasional': 'occasional',
  'rarity.rare': 'rare',

  // ---- Reference call (Xeno-Canto) ----
  'refcall.none': 'no reference call on Xeno-Canto for this species',
  'refcall.busy': 'Xeno-Canto is busy (rate limit) — try again in a moment',
  'refcall.unavailableCode': 'reference call unavailable (Xeno-Canto {code})',
  'refcall.unavailable': 'reference call unavailable',
  'refcall.cantPlay': 'couldn’t play this reference call',
  'refcall.credit': 'Reference call: Xeno-Canto',
  'refcall.recBy': ' · rec. {rec}',
  'refcall.license': 'license',

  // ---- Spectrogram ----
  'spectro.loading': 'loading spectrogram...',
  'spectro.rendering': 'rendering spectrogram...',
  'spectro.unavailable': 'spectrogram unavailable',
  'spectro.noWebAudio': 'WebAudio not available',
  'spectro.failed': 'spectrogram failed: ',

  // ---- False-positive flag pill ----
  'flag.report': 'report as a false positive',
  'flag.armed': 'not it?',
  'flag.armedTitle': 'tap again to report as a false positive',
  'flag.done': 'reported as a false positive',
  'flag.failed': 'failed',
  'flag.noPath': 'no path',
  'flag.errCode': 'err {code}',
  'flag.couldNotSave': 'could not save: {why}',
  'flag.needsIngress': 'needs the HA ingress connection - {detail}',
  'flag.refused': 'BirdNET-Go refused ({err})',

  // ---- About modal ----
  'about.title': 'The birds outside your window',
  // Rich string (assigned via innerHTML - static, trusted markup).
  'about.body': 'A tiny microphone identifies every passing bird with <a href="https://github.com/tphakala/birdnet-go" target="_blank" rel="noopener">BirdNET-Go</a>, built on Cornell\'s <a href="https://birdnet.cornell.edu/" target="_blank" rel="noopener">BirdNET</a>. Each species shows up as an illustration in the collage, sized by how often it\'s been heard. Confident detections perch; uncertain ones fly past.',
  'about.explore': 'explore the birds →',
};
