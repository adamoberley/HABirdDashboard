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

  // Sitting-or-flying rule. A species shows its perched ("sitting")
  // illustration when its best detection confidence in the current
  // time window is at or above this value; below it, the bird renders
  // in its flight pose (when a flight illustration exists). The idea:
  // a loud, unmistakable bird is probably settled nearby - a faint,
  // uncertain one is just passing through.
  sitConfidence: 0.96,

  // Wall-mounted display extras. All off by default for desk browsing.
  //
  // Tip: instead of (or in addition to) these, you can switch them on
  // per-display from the URL, so one install serves both your laptop
  // and the hallway tablet:
  //   /local/habird/index.html?wall            clock + weather + cursor hiding
  //   /local/habird/index.html?wall&cycle=45   ...plus rotate views every 45s
  wall: {
    clock: false,        // time + date, top right, matching the page style
    weather: false,      // current conditions + sunrise/sunset, straight from
                         // BirdNET-Go's weather support (yr.no by default -
                         // no API key; hides itself if you've disabled it)
    fahrenheit: false,   // BirdNET-Go reports Celsius; true converts for display
    cycleSeconds: 0,     // auto-rotate collage -> stats -> atlas every N
                         // seconds (0 = off); any touch postpones the hop
    hideCursor: false,   // hide the mouse cursor after 8s idle (kiosks)
  },
};
