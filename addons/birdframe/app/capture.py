"""Headless render of the Bird collage -> PNG bytes.

Keeps one Chromium process warm across cycles; each capture uses a fresh
context (cheap, and keeps memory flat over long runs). CORS is sidestepped with
--disable-web-security since this is a controlled, headless capture talking to
your own BirdNET-Go, not a user-facing browser.
"""
from __future__ import annotations

import logging

from playwright.sync_api import sync_playwright

from options import Options

log = logging.getLogger("birdframe.capture")

# Time to let the collage bloom in, weather paint, and the packer re-settle
# after networkidle before we grab the frame.
SETTLE_MS = 5000


class Capturer:
    def __init__(self, opts: Options, url: str) -> None:
        self.opts = opts
        self.url = url
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-web-security",   # talk to BirdNET-Go cross-origin
                "--hide-scrollbars",
                "--force-color-profile=srgb",
            ],
        )

    def capture(self) -> bytes:
        opts = self.opts
        ctx = self._browser.new_context(
            viewport={"width": opts.width, "height": opts.height},
            device_scale_factor=1,
            color_scheme="dark" if opts.theme == "dark" else "light",
        )
        page = ctx.new_page()
        try:
            page.goto(self.url, wait_until="networkidle", timeout=60_000)

            # Select the requested time window (24H is the harness default).
            if opts.window_hours != 24:
                try:
                    page.click(
                        f'#winPick button[data-h="{opts.window_hours}"]',
                        timeout=4_000,
                    )
                    page.wait_for_load_state("networkidle", timeout=30_000)
                except Exception as exc:  # noqa: BLE001
                    log.debug("window select skipped: %s", exc)

            # Strip on-screen chrome - this is wall art. Always hide the top
            # page bar (window picker + menu) and zero the collage view's
            # padding: its 88px bottom reserve for the now-hidden view slider
            # pushed the flock above centre. The caption is optional, and an
            # optional warmer paper colour overrides the near-white default. The
            # window was already selected above, while the bar was still present.
            art_css = (
                "header.top{display:none!important;}"
                ".view#v0{padding:0!important;}"
            )
            if not opts.show_caption:
                art_css += ".static-head{display:none!important;}"
            if opts.paper_color:
                art_css += f"html{{--paper:{opts.paper_color}!important;}}"
            page.add_style_tag(content=art_css)

            # The collage already packed on load using the old padding; the CSS
            # above changed the box, so fire a resize - apt.js re-packs the
            # collage on resize - to re-centre it in the full frame.
            page.evaluate("window.dispatchEvent(new Event('resize'))")

            try:
                page.wait_for_function(
                    "document.fonts ? document.fonts.status === 'loaded' : true",
                    timeout=10_000,
                )
            except Exception:  # noqa: BLE001
                pass

            page.wait_for_timeout(SETTLE_MS)
            return page.screenshot(type="png", full_page=False)
        finally:
            ctx.close()

    def close(self) -> None:
        try:
            self._browser.close()
        finally:
            self._pw.stop()
