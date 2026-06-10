// AvianVisitors for Home Assistant + BirdNET-Go - user configuration.
// Loaded before apt.js so the dashboard knows where your BirdNET-Go
// instance lives and how to choose each bird's pose.
window.AV_CONFIG = {
  // Base URL of your BirdNET-Go instance (no trailing slash).
  //
  // Leave '' (empty) to auto-derive it as the host this page is served
  // from, on port 8080 - which is correct for the stock alexbelgium
  // birdnet-go add-on running on the same Home Assistant box, however
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
};
