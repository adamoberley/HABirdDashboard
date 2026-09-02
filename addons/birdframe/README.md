# Bird Frame (Samsung Frame TV)

Push the live [Bird collage](https://github.com/adamoberley/HABirdDashboard) to
a Samsung Frame TV's **Art Mode** on an interval — replacing the previous image
in place, so the TV's art library never accumulates duplicates.

- Renders your real collage headlessly (no HA login; reads BirdNET-Go directly)
- Uploads → selects → **deletes the one it replaced** (safe ordering, retried)
- Downloads only your station's bird art, cached locally
- Adjustable interval, time window, theme, clock/weather, active hours
- Optional species-name strip along the bottom (`show_names`), sized for the
  panel — a legend for the birds you don't recognise

See **[DOCS.md](DOCS.md)** for setup (including the one-time pairing tap on the
TV) and options.

> Requires *The Frame* (Art Mode), an `amd64`/`aarch64` Home Assistant host
> (for Chromium), and a running BirdNET-Go.
