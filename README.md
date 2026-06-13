# HABirdDashboard

*Bird Card: a live bird collage for Home Assistant, fed by BirdNET-Go.*

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC_BY_NC_SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

<img alt="HABirdDashboard collage" src="https://raw.githubusercontent.com/adamoberley/HABirdDashboard/HABirdDashboard/docs/thumbnail.png" />

**The idea in one paragraph:** your Home Assistant machine can identify
every bird outside your window by sound alone. A free app called
[BirdNET-Go](https://github.com/tphakala/birdnet-go) listens to any
microphone - including the one already in your doorbell or security
camera - and names each species it hears using Cornell's BirdNET model.
Bird Card turns that stream of detections into the living collage above:
every species you've heard appears as a woodblock-print style
illustration (kachō-e, the Japanese bird-and-flower tradition), sized by
how often it calls, packed together by its actual silhouette so wings
cradle tails. Birds the AI heard clearly sit perched; faint, uncertain
ones fly past. Tap any bird for its recordings, description, and stats.

No bird knowledge needed, no extra hardware if you own a camera with a
mic, and nothing to maintain: the card installs like any other HACS card,
finds BirdNET-Go on its own, gets weather and theme from Home Assistant,
and fetches each bird's artwork on demand. **You do need the BirdNET-Go
app running** - this card is the display, not the detector - and Step 1
below covers installing it from scratch.

Bird Card began life as a fork of
[AvianVisitors](https://github.com/Twarner491/AvianVisitors) (a BirdNET-Pi
project for a dedicated Raspberry Pi) and is now maintained as an
independent project. The illustrations and the silhouette-masking collage
layout are AvianVisitors' work, used and adapted with attribution under
CC-BY-NC-SA; everything else - the data layer, the confidence-based poses,
the Home Assistant card - was built here for Home Assistant + BirdNET-Go.

---

## What you get

- **The collage** - every species heard in the selected window (1H / 12H /
  24H / 7D / ALL), nested by silhouette masks with no overlaps, area scaled
  to call count. Hover for counts, click a bird for its detail card.
- **Sitting or flying** - a species shows its perched illustration when its
  best detection confidence in the window is ≥ 90% (configurable), and its
  flight pose otherwise. A clear, close bird has settled in; a faint maybe is
  just passing through. Birds visibly "land" when a confident detection
  arrives.
- **Clock + weather in the collage** (optional) - togglable in the card
  settings. The block sits in a corner of the collage and the bird-packing
  treats it as one of the flock: grow enough birds and they nest around the
  numerals. Weather comes from your HA weather integration, in your HA
  units, with sunrise/sunset from HA's sun - no tokens, no API keys.
- **Stats** - an editorial detection timeline plus by-period counts, top
  species, and the newest additions to your life list.
- **Atlas** - a field-guide card grid of every species ever heard, with
  playback of the latest recording and client-rendered spectrograms.
- **Detail modals** - per-species recording history with scrubbable
  spectrograms, Wikipedia descriptions, rarity, and links out to Wikipedia
  and eBird, plus an optional **reference call** (from Xeno-Canto) to
  compare against your own recordings. A tap can open the details, play
  the call, or both.
- **666 illustrations** - 333 (mostly North American) species, a perched
  and a flight pose each, lazy-loaded per detected species (no bulk
  download). A [regeneration pipeline](avian/scripts/README.md) builds sets
  for other regions.
- Light/dark follows your Home Assistant theme. Data refreshes every 30
  seconds (paused while the tab is hidden). Fully responsive - the collage
  re-packs itself for any screen or orientation.

---

## What you need

- **Home Assistant OS or Supervised** - apps (formerly add-ons) only
  exist on these install types. Container/Core installs can still use the card; run
  [BirdNET-Go](https://github.com/tphakala/birdnet-go) yourself (e.g. in
  Docker) and skip to [Step 3](#step-3--install-the-card).
- **Something that can hear birds.** If you already have an outdoor
  camera with a microphone - a doorbell, a security cam, an NVR - you're
  done: BirdNET-Go listens to RTSP streams, so the camera you own becomes
  the bird mic for free (Step 2 has the details). Otherwise a cheap USB
  lavalier mic in a window works great.
- About **20 minutes**.

The whole setup is: install the BirdNET-Go app (the thing that listens and
identifies) → confirm it's detecting → install the card → add it to a
dashboard. Step by step:

---

## Step 1 — Install the BirdNET-Go app

BirdNET-Go isn't in the built-in app store; it comes from
[alexbelgium's](https://github.com/alexbelgium/hassio-addons) well-known
community repository, which you add once:

1. Click this to add the repository to your HA instance:

   [![Open your Home Assistant instance and add the alexbelgium repository.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Falexbelgium%2Fhassio-addons)

   Or by hand: **Settings → Apps** (called *Add-ons* before 2025) →
   **⋮ menu (top-right) → Repositories** → paste
   `https://github.com/alexbelgium/hassio-addons` → **Add** → **Close**.

2. Back in the app store, search for **BirdNET-Go** (refresh the page if
   it doesn't show up yet - it's under "Alexbelgium's Hass.io Add-ons").
3. Open it and click **Install**. It's a large image; give it a few minutes.
4. On the app's **Configuration** tab, set `TZ` to your timezone (this
   matters - the dashboard's time windows follow it), then **Save**.
5. On the **Info** tab, click **Start**, and watch the **Log** tab until it
   settles.

## Step 2 — Get BirdNET-Go detecting

1. Open the BirdNET-Go web UI at `http://<your-ha-host>:8080` (there's also
   an **Open Web UI** button on the app page).
2. In BirdNET-Go's **Settings**, set your **latitude/longitude** so it
   knows which species are plausible.
3. Give it ears - either works, and you can mix several:

   **An outdoor camera you already own (recommended).** Doorbell and
   security cameras have microphones, and BirdNET-Go listens to RTSP
   streams directly - no new hardware. In BirdNET-Go's audio settings add
   an **RTSP stream** per camera: give it a name (it becomes that mic's
   device name in HA, e.g. "Door Bell") and the camera's RTSP URL. Two
   things to check on the camera side: **audio recording must be enabled**
   in the camera's own settings, and use the low-resolution **sub stream**
   - BirdNET-Go only wants the audio, no point pulling main-stream video.

   For Reolink cameras behind an NVR the URL template is:

   ```
   rtsp://admin:PASSWORD@NVR.IP.ADDRESS:554/h264Preview_01_sub
   ```

   (`_01_` is the camera's channel number on the NVR - `_02_`, `_03_`...
   for the rest; standalone Reolink cameras use the camera's own IP.)
   Other brands publish similar RTSP paths - search "<brand> RTSP URL".

   **Or a USB microphone** plugged into the HA machine - pick it as the
   audio capture device.

4. Wait for a bird (or play birdsong from your phone near the mic) and
   confirm detections appear on BirdNET-Go's own dashboard.

**Tuning detections** - defaults are conservative; a starting point that
has worked well in practice is **Settings → Analysis**: Confidence
Threshold **0.7**, with Dynamic Threshold enabled, Trigger **0.9** and
Minimum **0.5**. (Dynamic threshold temporarily lowers the bar for a
species right after a high-confidence detection of it, so the quieter
follow-up calls of a bird that's clearly present still get logged without
letting random noise in.) It pairs nicely with this card's sit/fly rule -
confident detections perch, borderline ones fly past.

Don't move on until BirdNET-Go is detecting - this card is only a prettier
window onto that data.

## Step 3 — Install the card

**With HACS (recommended):** click this to open the repository directly in
your HACS:

[![Open your Home Assistant instance and open this repository inside HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=adamoberley&repository=HABirdDashboard&category=plugin)

Or by hand:

1. In HACS: **⋮ menu (top-right) → Custom repositories**, add
   `https://github.com/adamoberley/HABirdDashboard` with type **Dashboard**.
2. Search HACS for **Bird Card** and **Download** it.
3. Reload your browser when prompted.

**Without HACS:** download
[`dist/habird-card.js`](dist/habird-card.js) into `/config/www/` (Samba or
the Terminal & SSH app), then **Settings → Dashboards → ⋮ → Resources →
+ Add resource**, URL `/local/habird-card.js`, type **JavaScript module**.

## Step 4 — Add the card to a dashboard

1. Edit any dashboard → **+ Add card** → search **Bird Card**.
2. The visual editor has everything: BirdNET-Go URL (leave empty for the
   stock app on the same host), the sit/fly confidence slider, what a tap
   on a bird does, and toggles for the clock, weather, corner, and cursor
   hiding. (Light/dark follows Home Assistant automatically.)

For a **full-screen view** (the way it's meant to be seen): create a new
dashboard or view, set the view's layout to **Panel (single card)**, and
put the card there - it fills the screen edge to edge. Name it "Birds",
icon `mdi:bird`.

That's it. The collage fills in as birds are heard; if BirdNET-Go already
has history, it shows up immediately.

---

## Card options

All editable in the visual editor; YAML equivalents:

```yaml
type: custom:habird-card
view: collage                # collage | stats | atlas - what this card shows
view_selector: true          # false hides the switcher (single-view cards;
                             #   put a collage card, a stats card and an
                             #   atlas card on one dashboard if you like)
title: ""                    # empty = no title; set any text for a heading
                             #   (birds pack around it, clock-style)
window: "24"                 # time window in hours, or "all" - the card has
                             #   no on-screen picker; this is the window
background: transparent      # transparent (blend with dashboard) | paper
font: system                 # system (HA's font) | serif (the original look)
birdnet_url: ""              # empty = this host, port 8080 (the stock app)
data_source: auto            # auto | api | ha (see Data sources below)
history_days: 10             # ha-source span; bounded by recorder retention
sit_confidence: 0.90         # perched at/above, flying below
collage_scale: 1.5           # how much of the card the flock claims (0.5-3)
                             #   (0 = always perched, 1.01 = always flying)
tap_action: both             # both (open details + play call, default) |
                             #   info (details only) | call (reference call only)
xeno_canto_key: ""           # free key from xeno-canto.org/account; enables the
                             #   reference-call feature below (empty = off)
clock: true                  # time + date in a corner of the collage
weather: true                # conditions + sunrise/sunset from HA
weather_entity: ""           # empty = first weather.* entity found
corner: bottom-right         # where the clock/weather block lives
hide_cursor: false           # hide the pointer after 8s idle (wall displays)
image_base: ""               # empty = artwork from CDN (see below)
```

The card follows Home Assistant's light/dark theme automatically, and
its height tracks HA's card sizing - neither is a configurable option.

**Weather** reads your Home Assistant weather integration directly through
the card's own connection - no access token, in your HA units, with
sunrise/sunset from HA's `sun.sun`. If HA has no weather entity, the card
quietly falls back to BirdNET-Go's built-in weather (yr.no).

**Bird details open in place**: clicking any bird - in the collage, the
stats lists, or the atlas - pops its detail card (recordings, description,
stats) over the current view. The card's layout is responsive to its own
box via container queries, so a narrow column card gets the compact
layouts even on a wide desktop. By default a tap **also plays the bird's
reference call** (`tap_action: both`); set `info` for details-only (the
classic behavior), or `call` for sound only.

**Reference calls** (optional): drop a free [Xeno-Canto](https://xeno-canto.org/account)
API key into `xeno_canto_key` and a **reference call** button appears in each
bird's detail card - a clean example call/song for the species (fetched from
Xeno-Canto, credited to the recordist) to compare against the recordings your
own station actually caught. This is distinct from BirdNET-Go's captures: it's
what the bird is "supposed" to sound like. Without a key the feature stays
hidden and `tap_action: call`/`both` simply open the details.

**Artwork** lazy-loads per species from a CDN view of this repo
(jsDelivr) - only birds you've actually heard are ever fetched, one PNG
each, cached by the browser. For a fully offline install, copy
`avian/assets/` to `/config/www/habird-art/` and set
`image_base: /local/habird-art/`.

### Missing artwork for your area?

The bundled library is 333 (mostly North American) species, so other
regions will have gaps. (Plain photos are deliberately not used as a
stand-in - they'd break the kachō-e style and have no silhouette masks
for the collage packing.) Two remedies, neither needs code changes:

1. **Generate illustrations for exactly YOUR birds.** The art pipeline
   (the same one that made the bundled library - see
   [`avian/scripts/README.md`](avian/scripts/README.md) for prompts,
   references and per-species tuning) can read your station's life list
   straight from BirdNET-Go and render only those species, in the
   matching style with proper masks:

   ```bash
   pip install -r avian/scripts/requirements.txt
   export GEMINI_API_KEY='your-key'
   python3 avian/scripts/pregen.py --from-birdnet http://homeassistant.local:8080
   python3 avian/scripts/cutout.py
   python3 avian/scripts/build_masks.py     # rebuilds the collage masks
   node homeassistant/card/build.js         # bakes the masks into the card
   ```

   Host the PNGs at `/config/www/habird-art/` (set `image_base`) and add
   the rebuilt `dist/habird-card.js` as your dashboard resource.
2. **Send them here.** Pull requests to this repo that add species PNGs
   (and regenerated masks) are very welcome - every merged region makes
   the CDN cover the next person's backyard out of the box. Or just open
   an issue with your eBird region code.

---

## Data sources

The card can feed from two places:

1. **BirdNET-Go's REST API** (the default, and the most capable): full
   all-time history, exact counts, and audio - the atlas play buttons and
   the recordings in each species' detail modal come from here.
2. **Home Assistant's history of the BirdNET-Go MQTT sensors.** Enable
   MQTT in BirdNET-Go's integration settings (the alexbelgium app can
   auto-configure HA's broker) and each microphone appears in HA as a
   device with *Scientific Name* / *Last Species* / *Confidence* sensors.
   Those sensors only hold the latest detection, but HA's recorder keeps
   their history - the card rebuilds the full detection stream (time,
   species, confidence per detection) from it through its own HA
   connection. No extra URL, no port, no token. The trade-offs: audio
   clips can't travel over MQTT (play buttons show "no audio"), and the
   life list / ALL window reach back only as far as your recorder
   retention (default ~10 days; `history_days` caps the query).

### Enabling MQTT (recommended)

MQTT is worth the five minutes even when the API works: detections **push**
to the card instantly (instead of waiting for the refresh timer), the data
keeps flowing anywhere the API can't be reached, and every microphone
becomes a real HA device you can use in automations (announce rare birds,
light up a lamp for an owl...).

1. **Broker**: install the official **Mosquitto broker** app (Settings →
   Apps - it's in the official catalog, no custom repository needed)
   and start it. HA will then offer the discovered **MQTT integration**
   under Settings → Devices & Services - add it.
2. **Wire BirdNET-Go to the broker** - easiest way: on the BirdNET-Go
   app's **Configuration** tab, switch on **`mqtt_auto_config`**, save,
   and restart the app. It injects HA's broker address and credentials
   into BirdNET-Go for you.
   (Manual alternative: BirdNET-Go web UI → **Settings → Integrations →
   MQTT**: enable it, set the broker to **`mqtt://<your-HA-IP>:1883`** -
   e.g. `mqtt://192.168.1.2:1883` - with an HA username + password and
   topic `birdnet`. Use the real IP: container hostnames like
   `core-mosquitto` often don't resolve from inside the BirdNET-Go app.)
3. **Turn on Home Assistant discovery**: in BirdNET-Go's web UI →
   **Settings → Integrations → MQTT**, enable the **Home Assistant**
   (auto-discovery) option. This is a separate toggle from MQTT itself,
   off by default - and it's the one that creates the per-microphone
   device with the *Scientific Name* / *Last Species* / *Confidence*
   sensors this card uses.
4. **Verify**: Settings → Devices & Services → MQTT should show a
   "BirdNET-Go <your mic>" device whose sensors update on each
   detection. The card picks them up automatically - nothing to
   configure on the card side.

`data_source: auto` (the default) uses the API and falls back to MQTT
history automatically whenever the API isn't reachable from your browser -
so if the direct connection is blocked, the collage keeps working and
quietly upgrades itself once the API is reachable again. Force one or the
other with `api` / `ha`. Multiple microphones are auto-discovered and
summed; to pin specific ones, list their scientific-name sensors in YAML:

```yaml
ha_sensors:
  - sensor.birdnet_go_door_bell_scientific_name
  - sensor.birdnet_go_garden_scientific_name
```

---

## Wall-mounted displays

Turn on **clock** and **weather** in the card settings and put the card on
a panel-view dashboard - that's the whole setup. The block sits quietly in
whichever corner you pick, styled like the rest of the page (serif numerals
over small letterspaced captions, following light/dark), and the
bird-packing treats it as one of the flock: when enough birds show up to
reach that corner, they nest around the numerals with the same
silhouette-mask spacing they use against each other.

**hide_cursor** makes the pointer disappear after 8 seconds idle - useful
for kiosk browsers (Fully Kiosk, WallPanel, or HA's own kiosk-mode
dashboards) that park the mouse mid-screen.

---

## How it maps onto BirdNET-Go

The card reads BirdNET-Go's API v2 (public routes, CORS-open by default):

| Dashboard data | BirdNET-Go endpoint |
|---|---|
| Life list / ALL window / 7D window | `/api/v2/analytics/species/summary` |
| 1H / 12H / 24H rolling windows | `/api/v2/analytics/species/daily` for today (+ yesterday), summing the `hourly_counts` buckets that intersect the window |
| Daily + hourly charts | `/api/v2/analytics/time/daily`, `/api/v2/analytics/species/diversity`, `/api/v2/analytics/time/distribution/hourly` |
| Per-species recordings list | `/api/v2/detections?queryType=search` |
| Audio playback + spectrograms | `/api/v2/audio/:id` (spectrograms rendered client-side from the audio) |
| Species descriptions | Wikipedia REST API, fetched directly |

The 1H/12H windows are hour-bucket precise (the daily summary aggregates per
hour), so the window edge can be fuzzy by up to an hour - invisible in a
collage sized by relative counts.

---

## Alternative: standalone webpage install

Before it was a card, this dashboard was a static page served from
`/config/www` - that still works, and suits setups that want a plain URL
(`/local/habird/index.html`) for an iframe or external kiosk browser:

```bash
git clone https://github.com/adamoberley/HABirdDashboard.git /tmp/habird
/tmp/habird/homeassistant/install.sh     # copies page + artwork (~350MB)
rm -rf /tmp/habird
```

Configure via `/config/www/habird/config.js` (BirdNET-Go URL, sit
confidence, and `wall: {...}` for clock/weather - same features as the
card; weather defaults to BirdNET-Go's built-in support, or set
`wall.haToken` to use HA's). Add it with a **Webpage** dashboard pointing
at `/local/habird/index.html`, and use `?wall` / `?corner=top-left` URL
params to dress up a specific display.

---

## Troubleshooting

- **Some birds have no picture.** The most common question, and usually
  not a bug: the bundled library covers **333 mostly North American
  species**, so detections outside it simply have no illustration yet
  (the bird still counts everywhere - it just isn't drawn in the
  collage). Three checks, then the fix:
  1. *Is it just certain species?* That's coverage, not breakage - see
     [Missing artwork for your area?](#missing-artwork-for-your-area)
     to generate matching art for exactly your station's birds, or open
     an [artwork request](../../issues/new/choose) with your eBird
     region code.
  2. *Is it ALL species?* The artwork loads from a CDN
     (`cdn.jsdelivr.net`), so the browser viewing the dashboard needs
     internet access - on an isolated/offline network, host the art
     locally and point the `image_base` option at it (see Card options).
  3. *Did you set `image_base` yourself?* Re-check the path serves PNGs
     at `<image_base>/illustrations/<slug>.png`.
- **The direct API connection doesn't work** (with MQTT enabled the card
  still shows birds via history, but audio stays unavailable). Check, in
  order: (1) the BirdNET-Go app's **Configuration → Network** section in
  HA - the `8080` port must be exposed (not blank/disabled); (2) open
  `http://<the-host-in-your-address-bar>:8080` in a new tab - the card
  derives its default URL from the host you're browsing HA on, so if that
  tab fails, set `birdnet_url` to a URL that works (e.g.
  `http://192.168.1.50:8080`); (3) if you browse HA over **https://**, the
  browser blocks the plain-http API (mixed content) - leave `birdnet_url`
  empty and the card routes through HA ingress instead (next item).
- **Nabu Casa / HTTPS remote access.** There is no direct BirdNET-Go URL
  that works remotely - the tunnel only carries HA itself, and browsers
  block an `https://` page from calling a plain-`http` LAN address. The
  card handles this automatically: on an HTTPS page it discovers the
  app's **HA ingress** endpoint and routes the full API (audio
  included) through it. Ingress discovery needs an admin HA user and the
  default `birdnet_url` (leave it empty); if it can't be set up, data
  still flows via the MQTT sensors - only audio playback is lost.
- **The "not it?" flag fails.** The pill shows a short reason: `no path`
  means the card couldn't reach HA ingress (writes need it - check
  you're an admin user); `err 401/403/405` means BirdNET-Go refused -
  the browser console (`[bird-card] ...`) carries the detail.
- **Counts look shifted by a day.** Make sure the BirdNET-Go app's `TZ`
  option matches your actual timezone - the card aligns its rolling windows
  with BirdNET-Go's local dates.
- **Nothing loads / console shows CORS errors.** BirdNET-Go allows all
  origins by default. If you've restricted `allowedorigins` in its security
  settings, add your HA origin (e.g. `http://homeassistant.local:8123`).
- **BirdNET-Go auth.** Only public BirdNET-Go routes are used for reading,
  so the card works even with the BirdNET-Go app's authentication enabled.

---

## Repo layout

```
dist/
└── habird-card.js   # the custom card (generated - what HACS installs)
homeassistant/
├── card/build.js    # builds dist/habird-card.js from the www sources
├── install.sh       # standalone-page install (copies page + artwork)
└── www/             # source of truth: the app as a static page
    ├── index.html
    ├── config.js    # standalone-page settings
    ├── apt.js       # collage app + BirdNET-Go adapter (masks embedded)
    ├── styles.css
    └── favicon.png
avian/
├── assets/          # 666 bundled illustrations + photo-cutout fallbacks
└── scripts/         # generate -> cutout -> masks pipeline (Gemini + BiRefNet)
docs/                # screenshot
hacs.json            # HACS metadata
```

After editing anything in `homeassistant/www/`, regenerate the card with
`node homeassistant/card/build.js` and commit `dist/habird-card.js`.

---

## Credits & license

This project stands on excellent prior work, and the credit lines below
are load-bearing, not polite:

- **[AvianVisitors](https://github.com/Twarner491/AvianVisitors)** by
  [Teddy Warner](https://theodore.net) - the kachō-e illustration library
  (`avian/assets/`), the generation pipeline (`avian/scripts/`), the
  silhouette-mask collage layout, and the visual design originate there.
  This repo adapts them (Home Assistant card packaging, BirdNET-Go data
  layer, confidence-based poses, and the changes described in the commit
  history) under the terms below.
- **[BirdNET-Go](https://github.com/tphakala/birdnet-go)** by Tomi P.
  Hakala - the detection engine this card displays - packaged for Home
  Assistant by [alexbelgium](https://github.com/alexbelgium/hassio-addons).
- **[BirdNET](https://birdnet.cornell.edu/)** (Cornell Lab of Ornithology /
  Chemnitz University of Technology) - the bird-identification model
  underneath it all.

**License:
[CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)**
(see [LICENSE](LICENSE)), carried forward from AvianVisitors / BirdNET-Pi
under share-alike. The whole repo - artwork and code - is non-commercial
use only, and anything built on it must keep this license and these
credits.
