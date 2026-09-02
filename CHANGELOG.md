# Changelog

## Unreleased

### Added
- **Species-name strip.** New `names` option (card YAML + visual editor;
  `AV_CONFIG.names` / `?names=` on the standalone page; `show_names` on the
  Bird Frame app) lists every species in the current window as a line of
  names along the bottom of the collage - common, scientific, or both - at
  a configurable `names_size`. Names are tappable (same as tapping the
  bird) and hovering one lights up its illustration; the flock packs above
  the strip like it does around the clock. It is also where a species the
  library has no artwork for still appears on the collage view.
  Implements the list half of #69.
- **425 species from eBird region AU** (contributed by @daniel-c-ctrl,
  [#70](https://github.com/adamoberley/HABirdDashboard/pull/70)) - 805 new
  kachō-e illustrations covering the Southeast Australian list, taking the
  bundled library from 866 to 1,291 species (1,732 -> 2,537 illustrations).
  Alongside the birds it fills in the non-bird detections BirdNET-Go reports
  in that region: frogs, cicadas and crickets, bats, and the usual
  marsupials and introduced mammals. Silhouette masks and flight-direction
  headings rebuilt; cache-bust r16 -> r17.

### Docs
- README, AGENTS.md and the Bird Frame docs now spell out that a station's
  species list is finite and visible in advance (BirdNET-Go's Species page
  / CSV), so missing artwork is a one-time fix - generate the whole list
  once - rather than something to flag forever; plus a note on the model's
  non-bird labels (crickets, frogs, dog, engine) showing up as unillustrated
  names. Closes the "highlight missing images" half of #69 by explanation.

## v1.4.0 — 2026-08-27

### Added
- **Live detections.** The card now subscribes to BirdNET-Go's SSE stream
  (`/api/v2/detections/stream`, `live: true` by default) as a push signal:
  a new detection refreshes the card within seconds instead of on the next
  30s poll. Falls back silently on servers without the endpoint (or with
  Private Mode enabled); the polling safety net is unchanged. Bounded
  reconnects with backoff; the stream pauses while the tab is hidden.
- **Private Mode support.** New `api_token` option (card YAML, visual
  editor, and `AV_CONFIG.apiToken` on the standalone page) sends a Bearer
  token on every BirdNET-Go API call — including clip playback, which is
  fetched as a blob so the `<audio>` element can carry the auth. A 401
  without a token shows a clear "BirdNET-Go requires sign-in" hint instead
  of a silently empty card.
- **Native MQTT auto-discovery, first-class.** BirdNET-Go's own Home
  Assistant MQTT discovery sensors (Jan 2026) are picked up automatically,
  and a microphone whose sensors go `unavailable` is now surfaced with a
  quiet "{n} microphone(s) offline" note in the stats view (named when HA
  can format the entity name). README documents the one-toggle
  `mqtt_auto_config` zero-YAML setup for the alexbelgium add-on.
- **HA 2026.6 card-picker suggestions.** Selecting any BirdNET-Go sensor
  in the new dashboard card picker now suggests Bird Card with a live
  preview (`getEntitySuggestion`).

### Fixed
- **Hardened against 2026 BirdNET-Go API changes**: the false-positive
  report sends both the old and new review field names and surfaces the
  new CSRF 403 distinctly; detection `source` is accepted as string or
  object; audio requests honor `503 + Retry-After` while a clip is still
  being written.

## v1.3.0 — 2026-08-27

### Added
- **Feeder visits: blend a camera's sightings with the microphone's calls.**
  A feeder camera whose automation (e.g. LLM Vision) publishes each
  identified visitor as a BirdNET-style sensor trio (`*_scientific_name`,
  optionally `*_confidence` / `*_last_species`) can now be listed on the
  card as `visits_sensors` (visual editor: **Connection & data → Feeder
  visit sensors**; static page: `visitsSensors` in `config.js`). The card
  rebuilds those sensors' Home Assistant history with the same joiner as
  the MQTT data source and blends the counts in per species, windowed like
  everything else: the collage hover pill reads `12 calls · 3 visits
  today`, atlas cards gain a `visits` line, and the detail modal gains a
  `visits` stat. Visit sensors are excluded from microphone auto-discovery
  (a sighting is never double-counted as a call), visits match on
  scientific *or* common name, and species only ever *seen* don't join the
  collage. Implements #61.
- **The card speaks your language.** The UI chrome (headings, tooltips,
  stats, modal labels, empty states) is now translatable, and follows each
  user's Home Assistant profile language automatically — falling back to
  the browser language on the standalone page, and to English string-by-
  string for anything untranslated. Ships **12 languages**: English,
  Danish (tak, @felixdrud — the translation runtime, the Danish
  translation, and the coverage tooling are his work, #63), Dutch,
  Finnish, French, German, Italian, Norwegian (Bokmål), Polish,
  Portuguese, Spanish, and Swedish. Numbers, dates, and the wall clock
  format per locale; Wikipedia descriptions come from the matching
  language's wiki with English fallback; bird names stay BirdNET-Go's.
  Force a language with the card's `language:` option. Adding a language
  is one file — `npm run i18n:new`, then translate; coverage tooling and
  tests keep translations honest.
- **Black-billed Magpie** (*Pica hudsonia*) joins the illustrated library
  (866 species) — requested in #60 for a Calgary-area station. Cache-bust
  versions bumped `r15`→`r16`.

### Fixed
- **"First heard" no longer renders a raw timestamp.** BirdNET-Go's ISO
  `first_seen` values (e.g. `2026-07-09T04:47:17+02:00`) were split on a
  space that isn't there, producing an invalid date and bailing to the raw
  string. Full timestamps are now parsed whole. (#62, thanks @felixdrud)
- **The pose toggle flips on every click.** Clicking the already-selected
  pose now advances to the other available one instead of doing nothing.
  (#62, thanks @felixdrud)
- **Card CSS survived a build edge case**: HTML comments are stripped
  before script tags in the card build, so prose mentioning `<script>`
  can't eat the card's styles. (#63)
- **Feeder-visit sensors documented with `force_update: true`** — without
  it, Home Assistant's recorder collapses back-to-back sightings of the
  same species and repeat visits are silently lost.

## v1.2.7 — 2026-07-24

### Fixed
- **The detail modal no longer collapses to a strip of padding in Chrome and
  the Home Assistant companion app.** The `.modal-card` was capped with
  `max-height: calc(100vh - 48px)`, which the card build rewrites to
  `calc(100cqh - 48px)`. When Home Assistant lays the card out with an
  *indefinite* height (masonry / content-sized slots), Blink resolves the
  container-query height `100cqh` to `0`, so the cap became `calc(0 - 48px)` →
  clamped to `0` and the modal shrank to just its padding. Firefox and Safari
  resolved the unit against the rendered height, so they were unaffected. The
  cap is now `max-height: 100%` against the `inset:0` overlay (whose height is
  always definite), which equals the old value on a normal viewport but never
  collapses. Fixes #58.

### Added
- **64 Australian species.** Generated kachō-e illustrations (128 renders,
  both poses) for the missing species on a residential BirdNET-Go station's
  list (Melbourne, VIC), following the `AGENTS.md` pipeline end to end:
  pregen → cutout → masks → flight directions → card rebuild. The illustrated
  library grows from 862 to 926 species. `DIMS`/`MASKS` and the `DIRS` flight
  headings were regenerated for every new species, so they show in the **atlas**
  and are placed and banked correctly in the **collage** ring. Cache-bust
  versions bumped `r14`→`r15`.
- **Two intentional non-bird detections.** At the station owner's request, the
  BirdNET non-target false-positives Common Eastern Froglet (`Crinia
  signifera`) and Red Fox (`Vulpes vulpes`) are rendered in matching style, the
  fox with a lying/standing pose override (instead of perched/flight) in
  `species-notes.json`.

### Changed
- **Bird Frame add-on re-synced and versioned.** The add-on bundles its own copy
  of the renderer (`addons/birdframe/www/`); refreshed it from source via
  `sync-www.sh` so the Frame TV collage picks up the new masks + flight headings
  (it had lagged at `r14`), and bumped the add-on `config.yaml` to `1.2.6`.

### Fixed
- **Stale Gemini model id in the illustration pipeline.** `build_dirs.py` and
  `verify.py` hardcoded a Gemini model id that now 404s for newer API
  keys/projects, silently zeroing out flight-direction annotation for new
  species until caught. Bumped to a current model. (Dev tooling only — does not
  affect the shipped card.)

## v1.2.5 — 2026-06-30

### Fixed
- **The collage now shows the European species, not just two of them.** v1.2.4
  added 466 European (eBird region DE) birds as *illustrations* but never
  generated their collage *silhouette masks*, so the collage — which packs
  birds by their outline and skips any species without a mask — silently
  dropped every new bird. The atlas (illustration-only) showed them all, the
  collage showed only the handful that happened to be in the original North
  American mask set (e.g. the cosmopolitan Rock Pigeon). Regenerated
  `DIMS`/`MASKS` for all 801 species (1,602 masks, both poses) via
  `build_masks.py`, so the collage now places the full library. Cache-bust
  versions bumped (`r13`→`r14`). Fixes #52.

### Added
- **Flight headings for the new species.** Ran `build_dirs.py` over the 466
  European flight renders so the ring **flow** layout banks them along the
  circle instead of leaving them upright. The `DIRS` table now covers the whole
  library.

### Changed
- **Bird Frame add-on re-synced and versioned.** The add-on bundles its own
  copy of the renderer (`addons/birdframe/www/`); refreshed it from source via
  `sync-www.sh` so the Frame TV collage gets the European masks + headings too,
  and bumped the add-on `config.yaml` to `1.2.5` (it had lagged at `1.2.3`).
- **Pipeline docs.** Documented `build_dirs.py` and the "masks are required for
  the collage" gotcha in `README.md`, `AGENTS.md`, and
  `avian/scripts/README.md`.

## v1.2.4 — 2026-06-23

### Added
- **466 new European illustrations (eBird region DE).** The bird library grew
  from 335 to 801 species (670 → 1,602 illustrations), so stations outside
  North America — Germany and the rest of the region — get real artwork in the
  atlas instead of placeholders.

## v1.2.3 — 2026-06-17

### Changed
- **Size contrast can now go all the way to 0.** The lower bound on the
  `sizeContrast` control dropped from 0.2 to 0, so you can flatten the size
  difference between common and rare birds completely — at 0 every bird is
  drawn essentially the same size, regardless of how often it's heard. Wired
  through the card editor slider, `config.js`, and the Bird Frame add-on
  (`size_contrast` now accepts `0`–`0.8`). The default (0.5) is unchanged.

## v1.2.2 — 2026-06-14

### Fixed
- **Stats view now scrolls on phones / portrait displays.** The stacked
  single-column layout was a shrinking flex child, so it collapsed to the
  viewport and clipped the heatmap instead of scrolling. It now takes its
  natural height and the view scrolls; the heatmap is full-height there too,
  so it's one clean scroll rather than a nested one.

## v1.2.1 — 2026-06-14

### Added
- **Bird spacing control.** A `collageSpacing` slider (0–1, default 0 = tightest) tunes
  the gap between birds for any collage shape — lower packs them closer and a
  touch bigger, higher gives more breathing room. They never overlap regardless
  (the packer reserves each bird's footprint). Card editor, `config.js`
  (+ `?spacing=` URL override), and the Bird Frame add-on.
- **Ring "flow" — a wheeling flock.** In ring mode, every in-flight bird banks
  along the circle's tangent (nose around the ring, belly toward the centre),
  so the flock reads as one murmuration turning around the open middle - far-side
  birds roll fully over. Spin `cw` (default) / `ccw` / `off`, plus a
  `collageFlowStrength` 0–1 (1 = full wheel). Driven by a per-illustration
  heading table generated by `avian/scripts/build_dirs.py` (Gemini beak/tail
  vision, two passes cross-checked) and baked into `masks.js`; birds without a
  confident heading stay upright. Wired into the card editor, `config.js`
  (+ `?flow=` / `?strength=` URL overrides), and the Bird Frame app. Ring mode
  now forces the flight pose so the wheel reads coherently.
- **Flow never overlaps.** The packer reserves each bird's *rotated* silhouette
  (not its upright one), so banked birds keep a clean gap and never touch - at
  any density. Busy plates also pack a little closer (bigger area budget +
  smaller gap as the flock grows), kept just shy of contact.
- **Ring collage layout.** A second collage *shape* alongside the default
  cluster: the flock scatters across the whole frame around an open centre —
  the look of the original AvianVisitors poster. Card editor **Collage shape**
  dropdown + **Ring centre size** slider; static-page `config.js`
  `collageShape` / `collageHole`, with `?ring` / `?hole=` URL overrides; and a
  matching option on the Bird Frame app. Cluster stays the default, unchanged.
- **Bird Frame app — push the collage to a Samsung Frame TV.** An optional Home
  Assistant app renders the collage headlessly on an interval and uploads it to
  a Frame's Art Mode, replacing the previous image each time (no duplicate
  buildup). Auto-discovers BirdNET-Go and the TV's IP; carries its own
  appearance options (theme, time window, fill, shape, clock/weather, caption,
  interval) and a sidebar panel with a live preview + "render &amp; push now".
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
- **Card editor: a "Ring collage" section.** The ring-specific settings (shape,
  centre size, flow direction + strength) now live in their own collapsible
  group, separate from the general collage controls.

### Fixed
- **Ring flow direction was inverted** — "clockwise" wheeled counter-clockwise
  and vice versa. Corrected so each matches its label.

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
