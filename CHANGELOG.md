# Changelog

## v1.0.0 — 2026-06-11

First public release of **Bird Card** (`custom:habird-card`), a live bird
collage card for Home Assistant fed by BirdNET-Go.

### The card
- Silhouette-mask collage: every species heard in the configured window,
  nested by actual bird outlines with no overlaps, sized by call count,
  smooth reconciled updates (arrivals bloom in, departures fade out,
  changes glide — no flashing rebuilds).
- Sitting-or-flying poses by detection confidence (`sit_confidence`,
  default 0.90; 0 = always perched, 1.01 = always flying).
- Stats view (detection timeline + by-period / top species / first
  detections) and Atlas view (field-guide grid with audio playback and
  client-rendered spectrograms), each usable as a standalone card
  (`view`, `view_selector`).
- Detail popups in place over any view: recordings with scrubbable
  spectrograms, Wikipedia description, genus/rarity, and a "not it?"
  flag that writes a false-positive review back to BirdNET-Go.
- Optional clock + weather (from your HA weather integration; BirdNET-Go
  weather as fallback) living in a collage corner — birds pack around
  them, and around a custom title, like they pack around each other.
- Audio boost (default +24 dB through a compressor) for quiet clips.

### Data
- BirdNET-Go REST API v2 as the primary source; automatic fallback to
  the recorder history of BirdNET-Go's MQTT sensors when the API is
  unreachable; MQTT sensor updates push refreshes within ~1 second.
- HTTPS pages (Nabu Casa) route the full API — audio included — through
  HA ingress automatically.

### Looks
- Transparent background, HA system font, and HA light/dark by default —
  all reversible per card (`background: paper`, `font: serif`,
  `theme`). Layout responds to the card's own box via container queries.
- Artwork lazy-loads per species from this repo's CDN; `image_base`
  points at a local copy for offline installs; the generation pipeline
  (`avian/scripts/`) renders style-matched art for any region — including
  exactly your station's life list via `pregen.py --from-birdnet`.

### Heritage
Artwork, generation pipeline, and the silhouette-packing layout adapted
from [AvianVisitors](https://github.com/Twarner491/AvianVisitors) by
Teddy Warner under CC-BY-NC-SA-4.0.
