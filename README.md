# AvianVisitors for Home Assistant

*A live bird collage from your window - as a Home Assistant dashboard, fed by BirdNET-Go.*

<img alt="avianvisitors collage" src="docs/thumb.png" />

A dashboard for the data the
[BirdNET-Go Home Assistant app](https://github.com/alexbelgium/hassio-addons/tree/master/birdnet-go)
collects. BirdNET-Go identifies every bird your microphone hears; this
dashboard turns those detections into a living collage. Each species appears
as a kachō-e style illustration, sized by how often it's been heard, packed
by its actual silhouette so wings cradle tails. Confident detections perch;
uncertain ones fly past.

**You need BirdNET-Go running** - this dashboard is the display layer, not
the detector. What it *doesn't* need is anything extra beyond that: it's a
static page served from Home Assistant's `www` folder (no separate app, no
server, no database of its own), and the browser reads your BirdNET-Go
app's REST API directly.

This is a fork of [AvianVisitors](https://github.com/Twarner491/AvianVisitors)
(which runs on BirdNET-Pi on a dedicated Raspberry Pi), reworked to run
against the BirdNET-Go app on Home Assistant.

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
- **Stats** - an editorial detection timeline plus by-period counts, top
  species, and the newest additions to your life list.
- **Atlas** - a field-guide card grid of every species ever heard, with
  playback of the latest recording and client-rendered spectrograms that
  follow the light/dark theme.
- **Detail modals** - per-species recording history with scrubbable
  spectrograms, Wikipedia descriptions, rarity, and links out to Wikipedia
  and eBird.
- **498 bundled illustrations** - 249 (mostly North American) species, a
  perched and a flight pose each, with photo-cutout fallbacks. A
  [regeneration pipeline](avian/scripts/README.md) builds sets for other
  regions.

Data refreshes every 30 seconds (paused while the tab is hidden).

---

## What you need

- **Home Assistant OS or Supervised** - apps (add-ons) only exist on these
  install types. Container/Core installs can still use this dashboard, but
  you'll need to run [BirdNET-Go](https://github.com/tphakala/birdnet-go)
  yourself (e.g. in Docker) and skip to
  [Step 3](#step-3--install-this-dashboard).
- **A microphone** the Home Assistant machine can hear birds with - a cheap
  USB lavalier mic in a window works great.
- About **30 minutes** and ~400MB of disk for the app + artwork.

The whole setup is: install the BirdNET-Go app (the thing that listens and
identifies) → confirm it's detecting → copy this dashboard into HA's `www`
folder → add it to your sidebar. Step by step:

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

Don't move on until BirdNET-Go is detecting - this dashboard is only a
prettier window onto that data.

## Step 3 — Install this dashboard

The dashboard is static files in HA's `/config/www` folder. Two ways to get
them there:

**Option A - Terminal & SSH app (easiest):** install the official
**Terminal & SSH** app from the app store (no custom repository needed),
open its web terminal, and run:

```bash
git clone https://github.com/adamoberley/avianvisitorsHA.git /tmp/avianvisitors
/tmp/avianvisitors/homeassistant/install.sh
rm -rf /tmp/avianvisitors
```

That copies everything to `/config/www/avianvisitors` (the artwork is
~350MB, so the clone and copy take a minute or two).

**Option B - Samba (no terminal):** install the official **Samba share**
app, then from your computer:

1. Download this repo as a ZIP (**Code → Download ZIP** on GitHub) and
   extract it.
2. Open HA's network share (`\\homeassistant\config` on Windows,
   `smb://homeassistant/config` on Mac) and create `www/avianvisitors/`.
3. Copy into that folder:
   - all five files from `homeassistant/www/` (`index.html`, `config.js`,
     `apt.js`, `styles.css`, `favicon.png`),
   - `avian/assets/illustrations/` → as `assets/illustrations/`,
   - `avian/assets/cutouts/` → as `assets/cutouts/`.

Then open it in a browser to check it works:

```
http://<your-ha-host>:8123/local/avianvisitors/index.html
```

> Blank 404? If `/config/www` didn't exist before this, restart Home
> Assistant once - HA only starts serving `/local/` after the folder exists
> at boot.

## Step 4 — Add it to Home Assistant

**Sidebar (recommended):** **Settings → Dashboards → + Add dashboard →
Webpage**, URL `/local/avianvisitors/index.html`, give it a name like
"Birds" and an icon (`mdi:bird`). It appears in your sidebar, full screen.

**As a card instead:** add a **Webpage** card to any existing dashboard with
the same URL. Give it plenty of height - the collage wants room.

That's it. The collage fills in as birds are heard; if BirdNET-Go already
has history, it shows up immediately.

---

## Configuration

Edit `/config/www/avianvisitors/config.js`:

```js
window.AV_CONFIG = {
  // Where BirdNET-Go lives. '' (default) = same host as this page, port
  // 8080 - right for the stock app. Otherwise e.g. 'http://192.168.1.50:8080'.
  birdnetGoUrl: '',

  // Sitting-or-flying: perched at/above this best-in-window confidence,
  // flight pose below it.
  sitConfidence: 0.96,
};
```

The installer never overwrites an existing `config.js`.

---

## How it maps onto BirdNET-Go

The frontend reads BirdNET-Go's API v2 (public routes, CORS-open by default):

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

## Troubleshooting

- **Nothing loads / console shows CORS errors.** BirdNET-Go allows all
  origins by default. If you've restricted `allowedorigins` in its security
  settings, add your HA origin (e.g. `http://homeassistant.local:8123`).
- **Page is blank over Nabu Casa / HTTPS remote access.** The browser blocks
  an `https://` page from calling the BirdNET-Go app's plain-`http` API (mixed
  content). On the LAN over `http://` everything works; for remote use you'd
  need the BirdNET-Go API behind HTTPS too (e.g. a reverse proxy).
- **Counts look shifted by a day.** Make sure the BirdNET-Go app's `TZ` option
  matches your actual timezone - the dashboard aligns its rolling windows
  with BirdNET-Go's local dates.
- **A species shows no picture.** The repo bundles 249 (mostly North
  American) species. Missing ones fall back to a photo cutout when bundled,
  otherwise the image is hidden. To generate illustrations for your region,
  see [`avian/scripts/README.md`](avian/scripts/README.md), then re-run
  `homeassistant/install.sh`.
- **BirdNET-Go auth.** Only public BirdNET-Go routes are used, so the
  dashboard works even with the BirdNET-Go app's authentication enabled.

---

## Repo layout

```
homeassistant/
├── install.sh       # copies the dashboard + artwork into /config/www
└── www/
    ├── index.html   # app shell
    ├── config.js    # your settings (BirdNET-Go URL, sit confidence)
    ├── apt.js       # collage app + BirdNET-Go adapter (silhouette masks embedded)
    ├── styles.css
    └── favicon.png
avian/
├── assets/          # 498 bundled illustrations + photo-cutout fallbacks
└── scripts/         # generate -> cutout -> masks pipeline (Gemini + BiRefNet)
docs/                # screenshot
```

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
