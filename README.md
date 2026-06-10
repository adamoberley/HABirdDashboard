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

## Requirements

1. **The BirdNET-Go app (required).** Install the
   [alexbelgium birdnet-go app](https://github.com/alexbelgium/hassio-addons/tree/master/birdnet-go)
   (Settings → Add-ons / Apps → Add-on Store → add the
   `https://github.com/alexbelgium/hassio-addons` repository), start it, and
   make sure it's detecting birds at `http://<your-ha-host>:8080` before
   adding this dashboard. The dashboard has no data of its own - everything
   it shows comes from BirdNET-Go.

   (Any other BirdNET-Go instance reachable from your browser works too -
   point `config.js` at it.)

2. **A way to put files into HA's `/config/www`**: the **Terminal & SSH**
   app, the **Samba share** app, or the VS Code app.

---

## Install

From the Terminal & SSH app (or anywhere `/config` is visible):

```bash
git clone https://github.com/adamoberley/avianvisitorsHA.git
cd avianvisitorsHA/homeassistant
./install.sh                    # copies to /config/www/avianvisitors
```

Or copy by hand: everything in `homeassistant/www/`, plus
`avian/assets/illustrations/` and `avian/assets/cutouts/` as
`assets/illustrations` and `assets/cutouts`, into
`/config/www/avianvisitors/`. The artwork is ~350MB.

Then open:

```
http://<your-ha-host>:8123/local/avianvisitors/index.html
```

> If `/config/www` didn't exist before, restart Home Assistant once - HA
> only starts serving `/local/` after the folder exists at boot.

### Add it as a dashboard

**Sidebar (recommended):** Settings → Dashboards → **Add dashboard** →
**Webpage**, URL `/local/avianvisitors/index.html`. Full screen, its own
sidebar entry.

**As a card:** add a **Webpage (iframe) card** to any dashboard with the same
URL. Give it plenty of height - the collage wants room.

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
