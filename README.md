# HABirdDashboard

*A live bird collage card for Home Assistant, fed by BirdNET-Go.*

<img alt="HABirdDashboard collage" src="docs/thumb.png" />

A custom dashboard card for the data the
[BirdNET-Go Home Assistant app](https://github.com/alexbelgium/hassio-addons/tree/master/birdnet-go)
collects. BirdNET-Go identifies every bird your microphone hears; this card
turns those detections into a living collage. Each species appears as a
kachō-e style illustration, sized by how often it's been heard, packed by
its actual silhouette so wings cradle tails. Confident detections perch;
uncertain ones fly past.

**You need BirdNET-Go running** - this card is the display layer, not the
detector. The card itself installs like any other custom card (HACS, one
file), reads BirdNET-Go's API directly, gets weather and theme from Home
Assistant natively, and lazy-loads bird artwork per species - nothing else
to set up.

The artwork and the silhouette-masking collage layout come from
[AvianVisitors](https://github.com/Twarner491/AvianVisitors) (a BirdNET-Pi
project for a dedicated Raspberry Pi); everything else here - the data
layer, the confidence-based poses, the Home Assistant card - is built for
Home Assistant + BirdNET-Go.

---

## What you get

- **The collage** - every species heard in the selected window (1H / 12H /
  24H / 7D / ALL), nested by silhouette masks with no overlaps, area scaled
  to call count. Hover for counts, click a bird for its detail card.
- **Sitting or flying** - a species shows its perched illustration when its
  best detection confidence in the window is ≥ 96% (configurable), and its
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
  and eBird.
- **498 illustrations** - 249 (mostly North American) species, a perched
  and a flight pose each, lazy-loaded per detected species (no bulk
  download). A [regeneration pipeline](avian/scripts/README.md) builds sets
  for other regions.
- Light/dark follows your Home Assistant theme. Data refreshes every 30
  seconds (paused while the tab is hidden). Fully responsive - the collage
  re-packs itself for any screen or orientation.

---

## What you need

- **Home Assistant OS or Supervised** - apps (add-ons) only exist on these
  install types. Container/Core installs can still use the card; run
  [BirdNET-Go](https://github.com/tphakala/birdnet-go) yourself (e.g. in
  Docker) and skip to [Step 3](#step-3--install-the-card).
- **A microphone** the Home Assistant machine can hear birds with - a cheap
  USB lavalier mic in a window works great.
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

   Or by hand: **Settings → Add-ons → Add-on Store** (HA is renaming these
   "Apps") → **⋮ menu (top-right) → Repositories** → paste
   `https://github.com/alexbelgium/hassio-addons` → **Add** → **Close**.

2. Back in the store, search for **BirdNET-Go** (refresh the page if it
   doesn't show up yet - it's under "Alexbelgium's Hass.io Add-ons").
3. Open it and click **Install**. It's a large image; give it a few minutes.
4. On the app's **Configuration** tab, set `TZ` to your timezone (this
   matters - the dashboard's time windows follow it), then **Save**.
5. On the **Info** tab, click **Start**, and watch the **Log** tab until it
   settles.

## Step 2 — Get BirdNET-Go detecting

1. Open the BirdNET-Go web UI at `http://<your-ha-host>:8080` (there's also
   an **Open Web UI** button on the app page).
2. In BirdNET-Go's **Settings**, set your **latitude/longitude** (so it
   knows which species are plausible) and pick your **audio capture
   device** - your USB mic should be listed.
3. Wait for a bird (or play birdsong from your phone near the mic) and
   confirm detections appear on BirdNET-Go's own dashboard.

Don't move on until BirdNET-Go is detecting - this card is only a prettier
window onto that data.

## Step 3 — Install the card

**With HACS (recommended):**

1. In HACS: **⋮ menu (top-right) → Custom repositories**, add
   `https://github.com/adamoberley/HABirdDashboard` with type **Dashboard**.
2. Search HACS for **HABird Card** and **Download** it.
3. Reload your browser when prompted.

**Without HACS:** download
[`dist/habird-card.js`](dist/habird-card.js) into `/config/www/` (Samba or
the Terminal & SSH app), then **Settings → Dashboards → ⋮ → Resources →
+ Add resource**, URL `/local/habird-card.js`, type **JavaScript module**.

## Step 4 — Add the card to a dashboard

1. Edit any dashboard → **+ Add card** → search **HABird**.
2. The visual editor has everything: BirdNET-Go URL (leave empty for the
   stock app on the same host), the sit/fly confidence slider, and toggles
   for the clock, weather, corner, theme, and cursor hiding.

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
birdnet_url: ""              # empty = this host, port 8080 (the stock app)
sit_confidence: 0.96         # perched at/above, flying below
clock: true                  # time + date in a corner of the collage
weather: true                # conditions + sunrise/sunset from HA
weather_entity: ""           # empty = first weather.* entity found
corner: bottom-right         # where the clock/weather block lives
hide_cursor: false           # hide the pointer after 8s idle (wall displays)
theme: auto                  # auto = follow HA light/dark; or light / dark
image_base: ""               # empty = artwork from CDN (see below)
height: ""                   # px; empty = fill the space (560px minimum)
```

**Weather** reads your Home Assistant weather integration directly through
the card's own connection - no access token, in your HA units, with
sunrise/sunset from HA's `sun.sun`. If HA has no weather entity, the card
quietly falls back to BirdNET-Go's built-in weather (yr.no).

**Artwork** lazy-loads per species from a CDN view of this repo
(jsDelivr) - only birds you've actually heard are ever fetched, one PNG
each, cached by the browser. For a fully offline install, copy
`avian/assets/` to `/config/www/habird-art/` and set
`image_base: /local/habird-art/`.

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

- **Nothing loads / console shows CORS errors.** BirdNET-Go allows all
  origins by default. If you've restricted `allowedorigins` in its security
  settings, add your HA origin (e.g. `http://homeassistant.local:8123`).
- **Card loads but no data over Nabu Casa / HTTPS remote access.** The
  browser blocks an `https://` page from calling the BirdNET-Go app's
  plain-`http` API (mixed content). On the LAN over `http://` everything
  works; for remote use you'd need the BirdNET-Go API behind HTTPS too
  (e.g. a reverse proxy).
- **No bird pictures.** The default artwork source is a CDN
  (`cdn.jsdelivr.net`), so the *browser viewing the dashboard* needs
  internet access. For offline/local-only setups use the `image_base`
  option (see Card options).
- **Counts look shifted by a day.** Make sure the BirdNET-Go app's `TZ`
  option matches your actual timezone - the card aligns its rolling windows
  with BirdNET-Go's local dates.
- **A species shows no picture.** The repo bundles 249 (mostly North
  American) species. Missing ones fall back to a photo cutout when bundled,
  otherwise the image is hidden. To generate illustrations for your region,
  see [`avian/scripts/README.md`](avian/scripts/README.md).
- **BirdNET-Go auth.** Only public BirdNET-Go routes are used, so the card
  works even with the BirdNET-Go app's authentication enabled.

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
├── assets/          # 498 bundled illustrations + photo-cutout fallbacks
└── scripts/         # generate -> cutout -> masks pipeline (Gemini + BiRefNet)
docs/                # screenshot
hacs.json            # HACS metadata
```

After editing anything in `homeassistant/www/`, regenerate the card with
`node homeassistant/card/build.js` and commit `dist/habird-card.js`.

---

## Credits & license

- Original [AvianVisitors](https://github.com/Twarner491/AvianVisitors)
  collage, illustrations, and layout by
  [Teddy Warner](https://theodore.net).
- [BirdNET-Go](https://github.com/tphakala/birdnet-go) by Tomi P. Hakala,
  packaged for Home Assistant by
  [alexbelgium](https://github.com/alexbelgium/hassio-addons).
- Bird identification by [BirdNET](https://birdnet.cornell.edu/) (Cornell
  Lab of Ornithology / Chemnitz University of Technology).

License: [CC-BY-NC-SA-4.0](LICENSE), inherited from AvianVisitors /
BirdNET-Pi. Non-commercial use only.
