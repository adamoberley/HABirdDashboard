// HABirdDashboard - user configuration.
// Loaded before apt.js so the dashboard knows where your BirdNET-Go
// instance lives and how to choose each bird's pose.
window.AV_CONFIG = {
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

  // Sitting-or-flying rule. A species shows its perched ("sitting")
  // illustration when its best detection confidence in the current
  // time window is at or above this value; below it, the bird renders
  // in its flight pose (when a flight illustration exists). The idea:
  // a loud, unmistakable bird is probably settled nearby - a faint,
  // uncertain one is just passing through.
  sitConfidence: 0.96,

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
    // LAN. Use a token from a dedicated, non-administrator HA user.
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
