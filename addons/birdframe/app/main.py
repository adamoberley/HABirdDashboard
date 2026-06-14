"""Bird Frame add-on entry point.

Wiring:
  options.json -> local renderer server (serves the harness + per-location art)
              -> headless Chromium captures the collage
              -> JPEG fit to the panel
              -> pushed to the Frame TV, replacing the previous image
on a loop every `interval_minutes`, idling outside `active_hours`.
"""
from __future__ import annotations

import logging
import os
import signal
import sys
import threading
import time
from datetime import datetime

import discover
import options as options_mod
import species
from capture import Capturer
from frametv import FrameTV
from imaging import to_panel_jpeg
from server import make_server

SERVER_PORT = 8099
PREVIEW_PATH = "/data/last-frame.jpg"

log = logging.getLogger("birdframe")
_stop = threading.Event()
_trigger = threading.Event()  # set by the control-panel button / interval / signal


def _setup_logging(level_name: str) -> None:
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _within_active_hours(spec: str, now: datetime) -> bool:
    """spec is "" (always) or "HH:MM-HH:MM" in local time; wraps midnight."""
    if not spec:
        return True
    try:
        start_s, end_s = spec.split("-")
        sh, sm = (int(x) for x in start_s.split(":"))
        eh, em = (int(x) for x in end_s.split(":"))
    except (ValueError, AttributeError):
        log.warning("bad active_hours %r - treating as always-on", spec)
        return True
    cur = now.hour * 60 + now.minute
    start, end = sh * 60 + sm, eh * 60 + em
    if start == end:
        return True
    if start < end:
        return start <= cur < end
    return cur >= start or cur < end


def _handle_signal(signum, _frame) -> None:
    log.info("signal %s received, shutting down", signum)
    _stop.set()
    _trigger.set()  # wake the interval wait so we exit promptly


def main() -> int:
    opts = options_mod.load()
    _setup_logging(opts.log_level)

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Zero-config: discover BirdNET-Go and the Frame TV(s) unless overridden.
    birdnet_url = discover.resolve_birdnet_url(opts.birdnet_go_url)
    tv_hosts = discover.discover_tv_hosts(opts.tv_ip)
    if not tv_hosts:
        log.error("no Frame TV found or set - fill in tv_ip and restart")
        return 1
    tvs = [FrameTV(host, matte=opts.matte) for host in tv_hosts]

    status = {
        "rendering": False,
        "last_render_ts": 0,
        "last_push_ts": 0,
        "last_error": None,
        "tv_count": len(tvs),
        "interval_minutes": opts.interval_minutes,
    }

    httpd, assets = make_server(opts, birdnet_url, _trigger, status, port=SERVER_PORT)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    log.info("renderer + control panel on :%d (BirdNET-Go: %s)",
             SERVER_PORT, birdnet_url)

    # Warm the per-location illustration cache off the hot path; the renderer's
    # CDN fall-through covers anything not yet warmed.
    threading.Thread(
        target=species.prewarm, args=(birdnet_url, assets), daemon=True
    ).start()

    url = f"http://127.0.0.1:{SERVER_PORT}/index.html"
    capturer = Capturer(opts, url)
    log.info(
        "ready: pushing %dx%d to %s every %d min (window=%sh, theme=%s)",
        opts.width, opts.height, ", ".join(tv_hosts), opts.interval_minutes,
        opts.window_hours, opts.theme,
    )

    def render_and_push() -> None:
        status["rendering"] = True
        try:
            png = capturer.capture()
            jpeg = to_panel_jpeg(png, opts.width, opts.height)
            tmp = PREVIEW_PATH + ".tmp"
            with open(tmp, "wb") as fh:
                fh.write(jpeg)
            os.replace(tmp, PREVIEW_PATH)
            status["last_render_ts"] = time.time()
            ok = 0
            for tv in tvs:
                try:
                    tv.push(jpeg)
                    ok += 1
                except Exception as exc:  # noqa: BLE001
                    log.error("%s push failed: %s", tv.host, exc)
            status["last_push_ts"] = time.time()
            status["last_error"] = (
                None if ok == len(tvs) else f"pushed to {ok}/{len(tvs)} TV(s)"
            )
            log.info("frame updated (%d KB) -> %d/%d TV(s)",
                     len(jpeg) // 1024, ok, len(tvs))
        except Exception as exc:  # noqa: BLE001
            status["last_error"] = str(exc)
            log.error("render failed (will retry): %s", exc)
        finally:
            status["rendering"] = False

    try:
        # First render happens immediately, so a restart doubles as a test push.
        while not _stop.is_set():
            manual = _trigger.is_set()
            _trigger.clear()
            # A manual push (control-panel button) always renders, even outside
            # active_hours - you asked for it on purpose.
            if manual or _within_active_hours(opts.active_hours, datetime.now()):
                render_and_push()
            else:
                log.info("outside active_hours %s - idling", opts.active_hours)
            # Sleep until the interval elapses, the button is pressed, or we stop.
            _trigger.wait(timeout=opts.interval_seconds)
    finally:
        log.info("closing browser")
        try:
            capturer.close()
        except Exception:  # noqa: BLE001
            pass
        httpd.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
