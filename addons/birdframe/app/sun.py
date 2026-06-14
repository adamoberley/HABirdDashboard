"""Circadian background: blend the paper colour from day to night by the sun.

The idea (borrowed from adaptive-lighting): drive the look from the sun's
*elevation* rather than the clock. Full day colour while the sun is well up,
full night colour once it's into twilight, smoothly crossfading across the
horizon - so the frame dims through dusk and warms back at dawn, matching the
room. Recomputed every render, so it drifts over the day on its own.

Location comes from Home Assistant's own config (mounted read-only); no HA API
needed. If it can't be read, we fall back to the day colour.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

log = logging.getLogger("birdframe.sun")

CORE_CONFIG_PATHS = (
    "/homeassistant/.storage/core.config",
    "/config/.storage/core.config",
)

# Crossfade window, in degrees of sun elevation: full day at/above DAY_ELEV,
# full night at/below NIGHT_ELEV, midpoint (~50/50) right at the horizon.
DAY_ELEV = 6.0
NIGHT_ELEV = -6.0


def _location() -> tuple[float, float, float] | None:
    for path in CORE_CONFIG_PATHS:
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh).get("data", {})
            lat, lon = data.get("latitude"), data.get("longitude")
            if lat is not None and lon is not None:
                return float(lat), float(lon), float(data.get("elevation") or 0)
        except (OSError, ValueError) as exc:
            log.warning("could not read %s: %s", path, exc)
    return None


def _smoothstep(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _lerp_hex(day_hex: str, night_hex: str, t: float) -> str:
    dr, dg, db = _hex_to_rgb(day_hex)
    nr, ng, nb = _hex_to_rgb(night_hex)
    r = round(dr + (nr - dr) * t)
    g = round(dg + (ng - dg) * t)
    b = round(db + (nb - db) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def is_dark(hex_color: str) -> bool:
    """True if the colour is dark enough to want a light-ink palette over it."""
    r, g, b = _hex_to_rgb(hex_color)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128


def circadian_paper(day_hex: str, night_hex: str) -> tuple[str, bool]:
    """Return (background hex, is_dark) for the current sun position."""
    loc = _location()
    if not loc:
        log.warning("circadian: no Home Assistant location found; using day colour")
        return day_hex, is_dark(day_hex)
    lat, lon, elev = loc
    try:
        from astral import Observer
        from astral.sun import elevation as sun_elevation
        el = sun_elevation(Observer(latitude=lat, longitude=lon, elevation=elev),
                           datetime.now(timezone.utc))
    except Exception as exc:  # noqa: BLE001
        log.warning("circadian: sun calc failed (%s); using day colour", exc)
        return day_hex, is_dark(day_hex)

    t = _smoothstep((DAY_ELEV - el) / (DAY_ELEV - NIGHT_ELEV))
    color = _lerp_hex(day_hex, night_hex, t)
    log.info("circadian: sun elevation %.1f deg -> blend %.2f -> %s", el, t, color)
    return color, is_dark(color)
