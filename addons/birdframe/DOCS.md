# Bird Frame

Render the live Bird collage and push it to a **Samsung Frame TV's Art Mode**,
on an interval — **replacing** the previous image each time so the TV's art
library never fills up with duplicates.

This is the missing piece between [the Bird Card](https://github.com/adamoberley/HABirdDashboard)
and a Frame TV: Art Mode looks far better for this artwork than a browser tab or
HDMI, but Art Mode only shows uploaded images, not a live web page. So the
add-on keeps a headless browser warm, screenshots your real collage on a
schedule, and uploads the result as a single, ever-updated piece of art.

## How it works

Each cycle:

1. A headless Chromium renders the project's standalone collage page (the same
   `masks.js`/`apt.js` packing as the card) at your panel resolution, reading
   detections straight from BirdNET-Go's REST API — **no Home Assistant login
   needed**, and weather works tokenless via BirdNET-Go.
2. It screenshots the settled collage and fits it to the panel as JPEG.
3. It uploads to the Frame, selects it, and **deletes the image it replaced**.
   The old image is only removed *after* the new one is safely up, and failed
   deletes are retried next cycle — so a hiccup never leaves a blank wall or a
   pile of orphans.

Only the bird illustrations your station has actually heard are downloaded
(from the project CDN, cached under the add-on's `/data`), so the footprint
stays small and it runs offline after warm-up.

## Setup

1. **Install** this add-on (you added the repo under *Settings → Add-ons →
   ⋮ → Repositories*).
2. **Configure** — usually nothing is required:
   - `tv_ip` — **leave blank** to auto-discover every Frame from your Samsung TV
     integration. Set comma-separated IPs only to override
     (e.g. `192.168.1.208,192.168.1.209`).
   - `birdnet_go_url` — **leave blank** to auto-discover the BirdNET-Go add-on.
3. **Start** the add-on. **Watch each TV**: the first connection pops an
   *“Allow this device to connect?”* prompt — **accept it with the remote**.
   The pairing token is saved per TV; you won't be asked again.
4. Put the TV in **Art Mode**. Within one interval you'll see your birds. The
   image updates in place every `interval_minutes`.

### Auto-discovery details

- **Frame TV** — the add-on reads the host(s) the core `samsungtv` integration
  already stored (HA config is mounted read-only). Every Samsung TV it finds is
  driven; any that doesn't support Art Mode is skipped with a log line. Multiple
  Frames work out of the box.
- **BirdNET-Go** — the add-on asks the Supervisor for the BirdNET-Go add-on's
  internal address, falling back to the well-known `db21ed7f-birdnet-go:8080`.

> The core `samsungtv` integration can't *push* art (no upload service), so the
> add-on talks to the TV directly via `samsungtvws` — it just borrows the IP the
> integration discovered, so you don't type it.

## Options

See each field's inline help on the Configuration tab. The ones people touch
most:

| Option | What it does |
| --- | --- |
| `interval_minutes` | How often the collage refreshes on the TV. |
| `resolution` | `3840x2160` (4K Frames) or `1920x1080` (32"/older). |
| `theme` | `light` (paper) or `dark`. |
| `window_hours` | Collage time window: `1`/`12`/`24`/`168`/`1000000` (ALL). |
| `wall_clock` / `wall_weather` | Clock / weather block in a corner. |
| `show_caption` | Off = edge-to-edge art, no title. |
| `active_hours` | e.g. `06:30-22:00`; blank = 24/7. |

## Trying out config changes

The Frame render uses its **own** settings — the add-on options, *not* your
Lovelace card's config (they're independent on purpose; a wall display usually
wants different framing than a dashboard card). To preview a change without
waiting for the interval:

- Open the **Bird Frame** panel in the HA sidebar and click **Render & push
  now**. It shows a live preview of exactly what gets sent to the TV.
- Or just **restart** the add-on — it renders and pushes immediately on start.

A manual push renders even outside `active_hours`, so you can test any time.

## Troubleshooting

- **Nothing appears / upload errors on first start** — the pairing prompt on
  the TV wasn't accepted. Restart the add-on and accept it on the TV.
- **TV “doesn't report Art Mode support”** — only *The Frame* line has Art
  Mode. The TV must also be reachable on the network (Frames stay on the
  network in standby).
- **Blank or empty collage** — confirm BirdNET-Go is reachable at
  `birdnet_go_url` from the add-on and has recent detections. Set `log_level:
  debug` to see the render and TV steps.
- **Birds missing from the collage** — their art is fetched on first sight;
  the next cycle will include them. Needs internet for that first fetch.
- **Wrong architecture** — Chromium needs `amd64`/`aarch64`. armhf/armv7/i386
  can't run it.
- **`ms.channel.timeOut` on upload** — the art handshake failing. The add-on
  pins `samsungtvws 3.0.5` (the maintained fork, same version Home Assistant's
  own samsungtv integration uses), which speaks the 2022+ Frames' art protocol.
  If a future firmware breaks it again, bump `samsungtvws` in `requirements.txt`
  and rebuild.

## Credits

Talks to the TV with [`samsungtvws`](https://github.com/NickWaterton/samsung-tv-ws-api);
the upload/select/delete approach and image fitting are adapted from
[vivalatech's frametv-artchanger](https://github.com/vivalatech/homeassistant-addons).
The collage and illustrations are the Bird Card / AvianVisitors work
(CC BY-NC-SA 4.0).
