# AvianVisitors for Home Assistant + BirdNET-Go

The AvianVisitors live bird collage, rehosted as a static Home Assistant
dashboard that reads straight from a [BirdNET-Go](https://github.com/tphakala/birdnet-go)
instance - no Raspberry Pi BirdNET-Pi install, no PHP, no extra server.

It keeps everything that makes the original collage good:

- the **mask-aware nesting layout** - every bird ships a binary alpha mask of
  its actual silhouette, and the packer spirals tiles outward from the centre
  so wings cradle tails with no overlaps,
- the **498 bundled kachō-e illustrations** (249 species, perched + flight),
- tile areas sized by call count with a sub-linear exponent so loud birds read
  bigger without drowning the rare ones,
- the stats timeline, the atlas field-guide grid, detail modals with
  recordings and client-rendered spectrograms.

What changed: the data layer now speaks BirdNET-Go's REST API v2 from the
browser, and the **sitting-or-flying rule is confidence-based** - a species
shows its perched illustration when its best detection confidence in the
current time window is ≥ 96% (configurable), and its flight pose otherwise.
A clear, close bird has settled in; a faint maybe is just flying past.

## Prerequisites

- Home Assistant with the [alexbelgium birdnet-go add-on](https://github.com/alexbelgium/hassio-addons/tree/master/birdnet-go)
  (or any BirdNET-Go instance reachable from your browser) up and detecting.
- A way to put files into HA's `/config/www` folder: the **Terminal & SSH**
  add-on, the **Samba share** add-on, or VS Code add-on.

## Install

From the Terminal & SSH add-on (or anywhere `/config` is visible):

```bash
git clone -b avian-visitors https://github.com/adamoberley/avianvisitorsha.git
cd avianvisitorsha/homeassistant
./install.sh                    # copies to /config/www/avianvisitors
```

Or copy by hand: everything in `homeassistant/www/` plus
`avian/assets/illustrations/` and `avian/assets/cutouts/` (as
`assets/illustrations` and `assets/cutouts`) into
`/config/www/avianvisitors/`. The artwork is ~350MB.

Then open:

```
http://<your-ha-host>:8123/local/avianvisitors/index.html
```

> If `/config/www` didn't exist before, restart Home Assistant once -
> HA only starts serving `/local/` after the folder exists at boot.

## Add it as a dashboard

**Sidebar (recommended):** Settings → Dashboards → **Add dashboard** →
**Webpage**, URL `/local/avianvisitors/index.html`. It gets its own sidebar
entry, full screen.

**As a card:** add a **Webpage (iframe) card** to any dashboard with the same
URL. Give it plenty of height - the collage wants room.

## Configuration

Edit `/config/www/avianvisitors/config.js`:

```js
window.AV_CONFIG = {
  // Where BirdNET-Go lives. '' (default) = same host as this page, port
  // 8080 - right for the stock add-on. Otherwise e.g. 'http://192.168.1.50:8080'.
  birdnetGoUrl: '',

  // Sitting-or-flying: perched at/above this best-in-window confidence,
  // flight pose below it.
  sitConfidence: 0.96,
};
```

The installer never overwrites an existing `config.js`.

## How it maps onto BirdNET-Go

The frontend's data layer translates the original BirdNET-Pi queries to
BirdNET-Go API v2 (all public, CORS-open by default):

| Dashboard data | BirdNET-Go endpoint |
|---|---|
| Life list / ALL window / 7D window | `/api/v2/analytics/species/summary` |
| 1H / 12H / 24H rolling windows | `/api/v2/analytics/species/daily` for today (+ yesterday), summing the `hourly_counts` buckets that intersect the window |
| Daily + hourly charts | `/api/v2/analytics/time/daily`, `/api/v2/analytics/species/diversity`, `/api/v2/analytics/time/distribution/hourly` |
| Per-species recordings list | `/api/v2/detections?queryType=search` |
| Audio playback + spectrograms | `/api/v2/audio/:id` (spectrograms are rendered client-side from the audio, matching the light/dark theme) |
| Species descriptions | Wikipedia REST API, fetched directly |

Detections refresh every 30 seconds; polling pauses while the tab is hidden.
The 1H/12H windows are hour-bucket precise (the daily summary endpoint
aggregates per hour), so the window edge can be fuzzy by up to an hour -
invisible in a collage sized by relative counts.

## Notes & troubleshooting

- **Nothing loads / console shows CORS errors.** BirdNET-Go allows all
  origins by default. If you've restricted `allowedorigins` in its security
  settings, add your HA origin (e.g. `http://homeassistant.local:8123`).
- **Page is blank over Nabu Casa / HTTPS remote access.** The browser blocks
  an `https://` page from calling the add-on's plain-`http` API (mixed
  content). On the LAN over `http://` everything works; for remote use you'd
  need the BirdNET-Go API behind HTTPS too (e.g. a reverse proxy).
- **Counts look shifted by a day.** Make sure the add-on's `TZ` option
  matches your actual timezone - the dashboard aligns its rolling windows
  with BirdNET-Go's local dates.
- **A species shows no picture.** The repo bundles 249 (mostly North
  American) species. Missing ones fall back to a photo cutout when bundled,
  otherwise the tile is hidden in the atlas. To generate illustrations for
  your own region, see [`avian/scripts/README.md`](../avian/scripts/README.md)
  and re-run `install.sh`.
- **BirdNET-Go auth.** The endpoints used here are BirdNET-Go's public
  routes, so they work even with the add-on's authentication enabled.

## Files

```
homeassistant/
├── README.md        # this file
├── install.sh       # copies the dashboard + artwork into /config/www
└── www/
    ├── index.html   # app shell (BirdNET-Pi admin chrome hidden)
    ├── config.js    # your settings (BirdNET-Go URL, sit confidence)
    ├── apt.js       # collage app + BirdNET-Go adapter (masks embedded)
    ├── styles.css
    └── favicon.png
```
