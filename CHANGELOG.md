# Changelog

## v1.1.0 — 2026-06-13

### Added
- **Reference calls** (optional): with a free [Xeno-Canto](https://xeno-canto.org/account)
  API key (`xeno_canto_key`), each bird's detail card gains a **reference
  call** button — a clean example call/song for the species, to A/B
  against the recordings your own station captured. Credited to the
  recordist per Xeno-Canto's license; falls through to another recording
  if one won't play, and retries on rate-limit.
- **Configurable tap** (`tap_action`): tapping a bird can open its
  details (`info`, default — unchanged), play its reference call
  (`call`), or both. Reference-call modes fall back to the details when
  no key is set.
- **+84 region species** (168 kachō-e illustrations) — Eastern-US
  warblers, vireos, flycatchers, shorebirds and more — generated through
  the `avian/scripts` pipeline, lifting the bundled library to 333
  species.

### Fixed
- `build_masks.py` silently skipped rewriting `masks.js` (its patch regex
  assumed a two-space indent the file no longer uses); it now tolerates
  and preserves any indentation.

## v1.0.1 — 2026-06-11

- Reliability of the "not it?" false-positive flag on every access path
  (http LAN, HTTPS/Nabu Casa): ingress session cookies, WebSocket
  supervisor fallback with known-slug probe, and the ingress base
  normalized to the token mount (fixes 405s; also restores full-API
  remote routing with audio).
- HACS validation workflow (green), My-link install badge, newcomer-first
  README with pictures-first troubleshooting, issue forms.

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
