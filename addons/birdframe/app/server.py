"""HTTP server: feeds the headless renderer AND serves the ingress control panel.

Routes:
  Renderer (used by the in-container Chromium, direct on 127.0.0.1):
    /index.html, /styles.css, /masks.js, /apt.js, /favicon.png   harness (copy)
    /config.js                                                   generated from options
    /assets/{illustrations,cutouts}/<slug>.png                   CDN fall-through cache

  Control panel (used by you, through Home Assistant ingress):
    /              the panel: a "render & push now" button + live preview
    /status        JSON: rendering?/last render+push times/errors
    /push-now      POST: queue an immediate render+push (used by the button)
    /preview.jpg   the most recent rendered frame

The panel is served through ingress, so it's authenticated by Home Assistant and
its URLs must be RELATIVE (ingress mounts the add-on under a token path).
"""
from __future__ import annotations

import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import requests

from options import ASSET_CDN, Options

log = logging.getLogger("birdframe.server")

WWW_DIR = os.path.join(os.path.dirname(__file__), "www")
ASSET_DIR = "/data/assets"
PREVIEW_PATH = "/data/last-frame.jpg"

# Harness files (the renderer; Chromium navigates to /index.html). Note "/" is
# NOT here - the root path is the ingress control panel below.
_STATIC = {
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/masks.js": ("masks.js", "application/javascript; charset=utf-8"),
    "/apt.js": ("apt.js", "application/javascript; charset=utf-8"),
    "/favicon.png": ("favicon.png", "image/png"),
}

# Relative URLs only (ingress). Polls status; reloads the preview when a new
# render lands; the button POSTs push-now.
CONTROL_HTML = b"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bird Frame</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px;
         background: var(--bg, #111); color: var(--fg, #eee); }
  @media (prefers-color-scheme: light){ body{ background:#faf8f2; color:#222 } }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  .sub { opacity: .7; font-size: .85rem; margin: 0 0 20px; }
  button { font: inherit; font-weight: 600; padding: 12px 20px; border: 0;
           border-radius: 10px; background: #2f7; color: #042; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .status { margin: 14px 0; font-size: .9rem; min-height: 1.2em; }
  .frame { margin-top: 16px; border-radius: 8px; overflow: hidden;
           background: #0006; aspect-ratio: 16/9; display: grid; place-items: center; }
  .frame img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .frame .empty { opacity: .5; font-size: .9rem; }
  code { opacity: .8; }
</style></head><body>
  <h1>Bird Frame</h1>
  <p class="sub">Render the collage and push it to your Frame TV now - for trying
     out config changes without waiting for the interval.</p>
  <button id="go">Render &amp; push now</button>
  <div class="status" id="status">&nbsp;</div>
  <div class="frame"><span class="empty" id="empty">No render yet</span>
       <img id="prev" alt="" hidden></div>
<script>
  var lastTs = 0;
  function fmt(t){ return t ? new Date(t*1000).toLocaleTimeString() : '-'; }
  function refresh(){
    fetch('status', {cache:'no-store'}).then(function(r){return r.json();}).then(function(s){
      var msg;
      if (s.rendering) msg = 'Rendering...';
      else if (s.last_error) msg = 'Last attempt: ' + s.last_error;
      else msg = 'Idle';
      document.getElementById('status').textContent =
        msg + ' \\u2022 ' + s.tv_count + ' TV(s) \\u2022 every ' + s.interval_minutes +
        ' min \\u2022 last pushed ' + fmt(s.last_push_ts);
      document.getElementById('go').disabled = s.rendering;
      if (s.last_render_ts && s.last_render_ts !== lastTs){
        lastTs = s.last_render_ts;
        var img = document.getElementById('prev');
        img.src = 'preview.jpg?t=' + s.last_render_ts;
        img.hidden = false;
        document.getElementById('empty').style.display = 'none';
      }
    }).catch(function(){});
  }
  document.getElementById('go').onclick = function(){
    document.getElementById('go').disabled = true;
    document.getElementById('status').textContent = 'Queued...';
    fetch('push-now', {method:'POST'}).catch(function(){});
    setTimeout(refresh, 600);
  };
  refresh(); setInterval(refresh, 2000);
</script></body></html>"""


class AssetCache:
    """Local-first /data/assets cache with one-time CDN fall-through."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._missing: set[str] = set()  # slugs known 404 on the CDN
        for kind in ("illustrations", "cutouts"):
            os.makedirs(os.path.join(ASSET_DIR, kind), exist_ok=True)

    def get(self, kind: str, filename: str) -> bytes | None:
        """Return PNG bytes for assets/<kind>/<filename>, fetching+caching from
        the CDN on a local miss. None means "not available" (-> 404, which the
        page's fallback chain handles)."""
        if kind not in ("illustrations", "cutouts") or "/" in filename or ".." in filename:
            return None
        local = os.path.join(ASSET_DIR, kind, filename)
        if os.path.exists(local):
            try:
                with open(local, "rb") as fh:
                    return fh.read()
            except OSError:
                pass

        key = f"{kind}/{filename}"
        with self._lock:
            if key in self._missing:
                return None

        url = ASSET_CDN + kind + "/" + filename
        try:
            resp = requests.get(url, timeout=20)
        except requests.RequestException as exc:
            log.warning("CDN fetch failed for %s: %s", key, exc)
            return None
        if resp.status_code != 200 or not resp.content:
            with self._lock:
                self._missing.add(key)
            return None

        tmp = local + ".tmp"
        try:
            with open(tmp, "wb") as fh:
                fh.write(resp.content)
            os.replace(tmp, local)
        except OSError as exc:
            log.warning("could not cache %s: %s", key, exc)
        return resp.content

    def prewarm(self, kind: str, filename: str) -> bool:
        """Fetch into the cache if missing. Returns True if the asset exists."""
        return self.get(kind, filename) is not None


def _config_js(opts: Options, birdnet_url: str) -> bytes:
    """Generate the window.AV_CONFIG the harness reads (replaces config.js)."""
    cfg = {
        "birdnetGoUrl": birdnet_url,
        # Force the REST path; the HA-history fallback needs a token we don't
        # wire up for the renderer.
        "dataSource": "api",
        # Single-view, pure art: collage is already the default view, and
        # viewSelector:false hides the collage/stats/atlas slider and adds
        # body.av-no-picker so the collage reclaims its bottom clearance.
        "view": "collage",
        "viewSelector": False,
        "collageFill": opts.collage_fill,
        "sizeContrast": opts.size_contrast,
        # Cluster (one filled flock) or ring (birds scatter across the frame
        # around an open centre); collageHole sizes the ring's void.
        "collageShape": opts.collage_shape,
        "collageHole": opts.collage_hole,
        # Ring flow: bank in-flight birds along the tangent so the flock wheels
        # around the centre; strength scales natural->full wheel.
        "collageFlow": opts.collage_flow,
        "collageFlowStrength": opts.collage_flow_strength,
        "collageSpacing": opts.collage_spacing,
        "sitConfidence": opts.sit_confidence,
        # Species-name strip (names / namesSize in the page's AV_CONFIG).
        "names": opts.show_names,
        "namesSize": opts.names_size,
        "audioBoostDb": 0,
        "tapAction": "info",
        "xenoCantoKey": "",
        "wall": {
            "clock": opts.wall_clock,
            "weather": opts.wall_weather,
            "corner": opts.wall_corner,
            "hideCursor": True,
            "haToken": opts.ha_token,
            "weatherEntity": opts.weather_entity,
            "fahrenheit": opts.fahrenheit,
        },
    }
    body = "window.AV_CONFIG = " + json.dumps(cfg) + ";\n"
    return body.encode("utf-8")


def make_server(opts: Options, birdnet_url: str, trigger: threading.Event,
                status: dict, host: str = "0.0.0.0", port: int = 8099):
    """`trigger` is set by the panel's button to request an immediate render;
    `status` is a dict the main loop updates and the panel reads."""
    assets = AssetCache()
    config_blob = _config_js(opts, birdnet_url)
    debug = opts.log_level == "debug"

    class Handler(BaseHTTPRequestHandler):
        # Quiet by default; the request log is noise once it works.
        def log_message(self, fmt, *args):  # noqa: N802
            if debug:
                log.debug("%s - %s", self.address_string(), fmt % args)

        def _send(self, code, ctype, body: bytes):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_POST(self):  # noqa: N802
            if urlparse(self.path).path == "/push-now":
                trigger.set()
                log.info("manual render requested from control panel")
                self._send(200, "application/json", b'{"queued":true}')
            else:
                self._send(404, "text/plain", b"not found")

        def do_GET(self):  # noqa: N802
            path = urlparse(self.path).path

            if path == "/" or path == "":
                self._send(200, "text/html; charset=utf-8", CONTROL_HTML)
                return
            if path == "/status":
                self._send(200, "application/json", json.dumps(status).encode())
                return
            if path == "/preview.jpg":
                try:
                    with open(PREVIEW_PATH, "rb") as fh:
                        self._send(200, "image/jpeg", fh.read())
                except OSError:
                    self._send(404, "text/plain", b"no preview yet")
                return
            if path == "/config.js":
                self._send(200, "application/javascript; charset=utf-8", config_blob)
                return
            if path in _STATIC:
                fname, ctype = _STATIC[path]
                try:
                    with open(os.path.join(WWW_DIR, fname), "rb") as fh:
                        self._send(200, ctype, fh.read())
                except OSError:
                    self._send(404, "text/plain", b"not found")
                return
            if path.startswith("/assets/"):
                parts = path.split("/")  # ['', 'assets', kind, filename]
                if len(parts) == 4:
                    data = assets.get(parts[2], parts[3])
                    if data is not None:
                        self._send(200, "image/png", data)
                        return
                self._send(404, "text/plain", b"no asset")
                return

            self._send(404, "text/plain", b"not found")

        do_HEAD = do_GET

    httpd = ThreadingHTTPServer((host, port), Handler)
    return httpd, assets
