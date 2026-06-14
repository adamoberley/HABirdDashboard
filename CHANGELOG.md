# Changelog

## Unreleased

### Added
- **Custom paper background — colour per theme + texture.** With
  `background: paper`, set `paper_color` (light mode) and `paper_color_dark`
  (dark mode) to any hex, and `paper_texture` (0–0.2) for a faint grayscale
  grain, so the collage can read like a print on coloured washi rather than a
  flat ground. Card editor fields + static-page `config.js` (`paperColor`,
  `paperColorDark`, `paperTexture`). All opt-in — blank colour / 0 texture keeps
  each theme's default ground. (Ported back from the Bird Frame TV app.)

### Changed
- **The collage fills more of the screen, and now _grows_ with bird
  count.** The packing budget was raised and its curve flipped — a busy
  plate claims a bit more area than a quiet one (the opposite of before).
  The per-viewport width cap (`max-width` on the collage) was removed too,
  so wide laptops and monitors use the full screen.
- **`collage_scale` → `collage_fill`** (card slider + static-page
  `config.js` `collageFill`): a 0.1–1.0 control, default **0.5** (≈ half
  the screen; 1.0 ≈ edge-to-edge), replacing the old 0.5–3 multiplier.
  Birds still always shrink to fit, so higher values are safe.
- **Tamed how much the most-heard birds dominate.** The count→area
  exponent dropped from a fixed 0.65 to a tunable default of **0.5**, so
  the top species are still the biggest but no longer dwarf the rest — and
  the freed space spreads to the smaller birds, so the flock reads fuller.
  New **`size_contrast`** control (card slider 0.2–0.8 + `config.js`
  `sizeContrast`).
- **Recording-boost ceiling raised** from +24 dB to **+48 dB**
  (`audio_boost`) for quiet microphones.

### Added
- **2K artwork + higher-res pipeline.** `pregen.py` gains
  `--model` / `--image-size` / `--aspect-ratio`; the House Sparrow (the
  most common detection) was re-rendered with Gemini 3 Pro Image at 2K.

## v1.1.0 — 2026-06-13

### Added
- **Reference calls** (optional): with a free [Xeno-Canto](https://xeno-canto.org/account)
  API key (`xeno_canto_key`), each bird's detail card gains a **reference
  call** button — a clean example call/song for the species, to A/B
  against the recordings your own station captured. Credited to the
  recordist per Xeno-Canto's license; falls through to another recording
  if one won't play, retries on rate-limit, and remembers the recording
  that worked per species so repeat presses are instant.
- **Configurable tap** (`tap_action`): a tap opens the details **and
  plays the reference call** by default (`both`); or `info` for
  details-only (the classic behavior), or `call` for sound only.
  Reference-call modes fall back to details when no key is set.
- **+86 region species** (172 kachō-e illustrations) — Eastern-US
  warblers, vireos, flycatchers, shorebirds, rails, terns and more —
  generated through the `avian/scripts` pipeline, lifting the bundled
  library to 335 species.
- **`AGENTS.md`** — a step-by-step guide an AI coding agent can follow to
  generate kachō-e illustrations for the species at *your* location
  (download the BirdNET-Go list → render → cut out → masks → card), so
  anyone can fill their own regional gaps repeatably.

### Changed
- **Stats & Atlas** drop the page title, and the stats heatmap now uses
  nearly the full height before it scrolls - many more species rows show
  at once.
- **Card editor reorganized** into three sections. **Dashboard** (open by
  default) holds title, background, font, then a view/time-window +
  switcher 2×2, a clock/weather 2×2, idle-cursor, and collage scale
  (which now defaults to **1**). **Birds & audio** is ordered tap action →
  Xeno-Canto key → sit confidence → volume boost (now a **slider**) →
  artwork. **Connection & data** is data source → BirdNET-Go URL →
  history/refresh. Optional fields carry "blank = default" hints.
- **Stats side panel**: detection counts sit in a single aligned column
  at the panel's right edge (lined up with the group subtitles), with the
  names kept tight on the left - no longer stretched far from the names.
- **Dark mode is now neutral** — removed the blue tint from the page,
  the view switcher, and the stats heatmap (charcoal greys, no saturation).
- The card **always follows Home Assistant's light/dark theme** — the
  manual theme toggle is gone.
- Dropped the **fixed-height** option; the card tracks HA's own card
  sizing. Background and font moved out to the top of the card editor.
- The collage shows a **blank panel** when no birds are in the window,
  instead of a "No birds heard outside" message.
- **Stats view** zoomed larger and easier to read: bigger heatmap cells,
  numbers, and species names, a wider species-name column (fewer names
  truncate), and a tighter, much narrower right-hand panel (counts sit
  right beside their labels). Stays centred in the view.

### Fixed
- Reference calls: a remembered recording that later goes unplayable no
  longer wedges playback - it falls through (and times out if it just
  hangs) to other recordings, the candidate pool is wider (15), and a
  fresh working pick is re-saved. Fixes high-volume species (e.g. House
  Sparrow) breaking after a previously-good recording went bad.
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
