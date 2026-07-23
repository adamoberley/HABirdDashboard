// HABirdDashboard - user configuration.
// Loaded before apt.js so the dashboard knows where your BirdNET-Go
// instance lives and how to choose each bird's pose.
window.AV_CONFIG = {
  // UI language override (optional). Leave unset to auto-detect: the HACS
  // card follows Home Assistant's UI language, and this standalone page
  // follows the browser (navigator.language). Set a code here to force it,
  // e.g. 'da' or 'pt-BR'. Any string the card's own UI hasn't been
  // translated to falls back to English. (Bird names come from BirdNET-Go
  // and are not affected by this setting.)
  // language: 'da',

  // Base URL of your BirdNET-Go instance (no trailing slash).
  //
  // Leave '' (empty) to auto-derive it as the host this page is served
  // from, on port 8080 - which is correct for the stock alexbelgium
  // birdnet-go app (add-on) running on the same Home Assistant box, however
  // you reach it (IP, homeassistant.local, hostname).
  //
  // Set it explicitly if BirdNET-Go runs elsewhere or on another port,
  // e.g. 'http://192.168.1.50:8080'.
  birdnetGoUrl: '',

  // Data source. 'auto' (default) reads BirdNET-Go's REST API and, if
  // that's unreachable from this browser, falls back to rebuilding the
  // detection stream from Home Assistant's history of the BirdNET-Go
  // MQTT sensors (enable MQTT in BirdNET-Go's integration settings).
  // 'api' / 'ha' force one source. The HA source needs wall.haToken set
  // (or the custom-card build, which uses its own HA connection), can't
  // play audio clips, and reaches back only as far as HA's recorder
  // keeps history (historyDays, default 10).
  dataSource: 'auto',
  historyDays: 10,

  // Recording playback boost in dB, 0-48 (0 = off). Applied in the
  // browser at playback and routed through a compressor that curbs
  // clipping. Faint clips (weak mics) get much louder; at the top of
  // the range the loudest clips can still distort a little.
  audioBoostDb: 24,

  // What a TAP on a bird does:
  //   'both' (default) - open the detail modal AND play the reference call
  //   'info'           - just open the detail modal (counts, captures, info)
  //   'call'           - just play the species' reference call (no modal)
  // 'call'/'both' need xenoCantoKey; without one they fall back to 'info'.
  tapAction: 'both',

  // Free Xeno-Canto API key for the "reference call" feature: a clean
  // example call/song per species, separate from the recordings YOUR
  // station captured, so you can compare them in the detail modal.
  // Get a key at https://xeno-canto.org/account . Left '', the feature
  // is off: the reference-call button hides and 'call'/'both' tap modes
  // fall back to opening the info modal.
  xenoCantoKey: '',

  // Sitting-or-flying rule. A species shows its perched ("sitting")
  // illustration when its best detection confidence in the current
  // time window is at or above this value; below it, the bird renders
  // in its flight pose (when a flight illustration exists). The idea:
  // a loud, unmistakable bird is probably settled nearby - a faint,
  // uncertain one is just passing through.
  // Extremes work too: 0 = everyone always perches, 1.01 = everyone
  // always flies (confidence never exceeds 1.0).
  sitConfidence: 0.90,

  // Collage fill: how much of the screen the flock claims, as a rough
  // fraction of the viewport area (0.1 - 1.0). 0.5 (the default) targets
  // about half the screen; 1.0 packs the birds nearly edge-to-edge. The
  // bird count nudges it automatically - a busy day spreads a little
  // wider, a quiet one pulls in - so at the 0.5 default the collage aims
  // for ~0.45 / 0.50 / 0.55 of the screen from sparse to crowded. Birds
  // always shrink to fit, so larger values are safe (they just fill more).
  collageFill: 0.5,

  // Size contrast: how much bigger your most-heard birds are drawn than
  // the rest (0 - 0.8). Lower keeps every bird closer to the same size;
  // higher lets the loudest few dominate. 0.5 (default) makes the top
  // birds a few times bigger than a quiet one - noticeable but not
  // overpowering. At 0 every bird is drawn essentially the same size,
  // regardless of how common it is. (The old fixed value was 0.65, which
  // felt top-heavy.)
  sizeContrast: 0.5,

  // Collage shape: how the flock is arranged on the plate.
  //   'cluster' (default) - birds pack outward from the centre into one
  //              dense blob, largest in the middle.
  //   'ring'    - birds pack into a halo around an open centre, so the
  //              flock reads as a circle of birds in flight (the look
  //              from the original Avian Visitors poster). Same artwork,
  //              same packing - just a circular keep-out in the middle.
  // Per-display override on the static page: add `?ring` to the URL (or
  // `?shape=cluster` to force the blob), and `?hole=0.5` to size the gap.
  collageShape: 'cluster',

  // Ring hole: size of the open centre when collageShape is 'ring', as a
  // fraction of the shorter screen axis (0.1 - 0.7). Bigger = a more
  // prominent void with the flock pushed out toward the edges. Ring mode
  // scatters birds across the WHOLE frame around this hole, so it looks
  // fullest with a busy flock (a long time window / chatty station);
  // with only a handful of species, 'cluster' reads better. Ignored in
  // 'cluster' mode.
  collageHole: 0.5,

  // Ring flow: in 'ring' mode, bank every in-flight bird so it follows the
  // ring's tangent - nose along the circle, belly toward the centre - so the
  // whole flock wheels like a murmuration (far-side birds roll fully over).
  //   'cw'  (default) - clockwise
  //   'ccw'           - counter-clockwise
  //   'off'           - birds keep their natural orientation (the plain ring)
  // Needs the per-illustration DIRS heading table (built by
  // avian/scripts/build_dirs.py and baked into masks.js); birds without a
  // heading stay upright. Ignored unless collageShape is 'ring'. Per-display
  // override on the static page: ?flow=cw / ?flow=ccw / ?flow=off.
  collageFlow: 'cw',

  // Flow strength (0 - 1): how strictly birds align to the tangent. 1.0 (the
  // default) is a full head-to-tail wheel; lower values keep more of each
  // bird's own pose for a gentler bank. URL override: ?strength=0.6
  collageFlowStrength: 1,

  // Spacing (0 - 1): how much air sits between birds, for any shape. Birds
  // never overlap regardless; this just tunes the gap. 0 (the default) packs
  // them tightest (densest, a touch bigger); higher gives more breathing room.
  // URL override on the static page: ?spacing=0.3
  collageSpacing: 0,

  // Paper background colour, per theme (hex). Left '', each theme uses its
  // built-in ground (near-white #fcfcfb light, charcoal #1a1a1a dark). Set
  // these to taste - e.g. a warm cream by day, a near-black by night - to make
  // the collage read more like a print on coloured paper.
  paperColor: '',       // light theme
  paperColorDark: '',   // dark theme

  // Paper grain: a faint grayscale noise laid over the background so it looks
  // like a print on washi/canvas rather than flat colour. 0 = off, ~0.06 is a
  // gentle grain, higher is coarser.
  paperTexture: 0,

  // Wall-mounted display extras. All off by default for desk browsing.
  //
  // The clock/weather block lives in a corner of the collage itself, and
  // the bird-packing treats it as one of the flock: if enough birds show
  // up to reach that corner, they nest around the numerals the same way
  // they nest around each other.
  //
  // Tip: instead of (or in addition to) these, you can switch them on
  // per-display from the URL, so one install serves both your laptop
  // and the hallway tablet:
  //   /local/habird/index.html?wall                   clock + weather + cursor hiding
  //   /local/habird/index.html?wall&corner=top-left   ...in a different corner
  wall: {
    clock: false,          // time + date
    weather: false,        // current conditions + sunrise/sunset
    corner: 'bottom-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    hideCursor: false,     // hide the mouse cursor after 8s idle (kiosks)

    // Weather source. With haToken set, conditions come from Home
    // Assistant itself - your configured weather integration, in HA's
    // units, plus sunrise/sunset from sun.sun. Create the token under
    // your HA profile -> Security -> Long-lived access tokens.
    //
    // SECURITY NOTE: /config/www files are served without authentication,
    // so this token is readable by anyone who can reach your HA on the
    // LAN. Treat it as a LAST RESORT: the HACS card needs no token at
    // all (it rides HA's own connection), and BirdNET-Go's built-in
    // weather needs no token either. If you do set one, use a token
    // from a dedicated, non-administrator HA user.
    //
    // Left empty, weather falls back to BirdNET-Go's built-in support
    // (yr.no by default - zero setup; hides itself if you disabled it).
    haToken: '',
    weatherEntity: '',     // e.g. 'weather.forecast_home'; empty = first
                           // weather.* entity found in HA
    fahrenheit: false,     // BirdNET-Go source only (it reports Celsius);
                           // the HA source already uses your HA units
  },
};
