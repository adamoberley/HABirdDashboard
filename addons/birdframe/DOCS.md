# Bird Frame

Render the live Bird collage and push it to a **Samsung Frame TV's Art Mode**,
on an interval — **replacing** the previous image each time so the TV's art
library never fills up with duplicates.

This is the missing piece between [the Bird Card](https://github.com/adamoberley/HABirdDashboard)
and a Frame TV: Art Mode looks far better for this artwork than a browser tab or
HDMI, but Art Mode only shows uploaded images, not a live web page. So the app
keeps a headless browser warm, screenshots your real collage on a schedule, and
uploads the result as a single, ever-updated piece of art.

(This is a Home Assistant **app** — what used to be called an "add-on.")

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
(from the project CDN, cached under the app's `/data`), so the footprint stays
small and it runs offline after warm-up.

## Setup

1. **Install** this app (you added the repo under *Settings → Apps → ⋮ →
   Repositories*).
2. **Configure** — usually nothing is required:
   - `tv_ip` — **leave blank** to auto-discover every Frame from your Samsung TV
     integration. Set comma-separated IPs only to override
     (e.g. `192.168.1.208,192.168.1.209`).
   - `birdnet_go_url` — **leave blank** to use the standard BirdNET-Go address.
3. **Start** the app, with the TV **on** and the remote handy. The first
   connection pops two prompts on the TV — **accept both**:
   - *“Allow this device to connect?”* — the pairing prompt (saved per TV; asked
     once).
   - An **Art Store / terms-and-conditions** prompt (“Allow all”). The TV blocks
     art uploads until these are accepted — this is the usual cause of a first
     upload failing with `send_image error -2`.
4. Put the TV in **Art Mode**. Within one interval you'll see your birds. The
   image updates in place every `interval_minutes`.

### Auto-discovery details

- **Frame TV** — the app reads the host(s) the core `samsungtv` integration
  already stored (HA config is mounted read-only). Every Samsung TV it finds is
  driven; any that doesn't support Art Mode is skipped with a log line. Multiple
  Frames work out of the box.
- **BirdNET-Go** — the app uses the well-known alexbelgium hostname
  `db21ed7f-birdnet-go:8080`. Set `birdnet_go_url` if yours lives elsewhere.

> The core `samsungtv` integration can't *push* art (no upload service), so the
> app talks to the TV directly via `samsungtvws` — it just borrows the IP the
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
| `show_caption` | Off (default) = edge-to-edge art, no title. |
| `collage_fill` | How full the flock packs (0.1–1.0). |
| `active_hours` | e.g. `06:30-22:00`; blank = 24/7. |

## Trying out config changes

The Frame render uses its **own** settings — the app options, *not* your
Lovelace card's config (they're independent on purpose; a wall display usually
wants different framing than a dashboard card). To preview a change without
waiting for the interval:

- Open the **Bird Frame** panel in the HA sidebar and click **Render & push
  now**. It shows a live preview of exactly what gets sent to the TV — handy for
  checking the framing and the paper background.
- Or just **restart** the app — it renders and pushes immediately on start.

A manual push renders even outside `active_hours`, so you can test any time.

## Troubleshooting

- **`send_image error -2` on the first upload** — accept the **Art Store /
  terms-and-conditions** prompt on the TV (“Allow all”); uploads are blocked
  until you do. (The app also sets both mattes to `none` to avoid a separate
  matte-mismatch cause of `-2`.)
- **`ms.channel.timeOut` on upload** — the art handshake failing. The app pins
  `samsungtvws 3.0.5` (same version Home Assistant's own samsungtv integration
  uses), which speaks the 2022+ Frames' art protocol. If a future firmware
  breaks it, bump `samsungtvws` in `requirements.txt` and rebuild.
- **Nothing appears at all on first start** — the pairing prompt wasn't
  accepted. Restart the app (TV on, remote handy) and accept it.
- **Image is set but the TV doesn't switch to it** — the app uses `show=False`
  while the TV is on, so it won't interrupt live viewing; switch the TV to Art
  Mode to see the collage.
- **TV “doesn't report Art Mode support”** — only *The Frame* line has Art Mode.
  The TV must also be reachable on the network (Frames stay on the network in
  standby).
- **Blank or empty collage** — confirm BirdNET-Go is reachable at
  `birdnet_go_url` from the app and has recent detections. Set `log_level:
  debug` to see the render and TV steps.
- **Birds missing from the collage** — their art is fetched on first sight; the
  next cycle will include them. Needs internet for that first fetch.
- **Wrong architecture** — Chromium needs `amd64`/`aarch64`. armhf/armv7/i386
  can't run it.

## Credits

Talks to the TV with [`samsungtvws`](https://github.com/NickWaterton/samsung-tv-ws-api);
the upload/select/delete approach and image fitting are adapted from
[vivalatech's frametv-artchanger](https://github.com/vivalatech/homeassistant-addons).
The collage and illustrations are the Bird Card / AvianVisitors work
(CC BY-NC-SA 4.0).
