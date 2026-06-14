"""Add-on options.

The Supervisor writes the user's configuration (validated against the schema in
config.yaml) to /data/options.json. We read it once at startup and expose a
small typed view with a few derived values.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

OPTIONS_PATH = "/data/options.json"

# jsDelivr mirror of the repo's avian/assets. Per-location illustrations are
# pulled from here on demand and cached under /data (see server.AssetCache).
ASSET_CDN = (
    "https://cdn.jsdelivr.net/gh/adamoberley/HABirdDashboard"
    "@HABirdDashboard/avian/assets/"
)


@dataclass(frozen=True)
class Options:
    tv_ip: str
    birdnet_go_url: str
    interval_minutes: int
    width: int
    height: int
    theme: str
    show_caption: bool
    window_hours: int
    collage_fill: float
    sit_confidence: float
    wall_clock: bool
    wall_weather: bool
    wall_corner: str
    matte: str
    active_hours: str
    ha_token: str
    weather_entity: str
    fahrenheit: bool
    log_level: str

    @property
    def interval_seconds(self) -> int:
        return max(60, self.interval_minutes * 60)


def _load_raw() -> dict:
    if not os.path.exists(OPTIONS_PATH):
        # Lets the module be imported / unit-tested outside the Supervisor.
        return {}
    with open(OPTIONS_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def load() -> Options:
    raw = _load_raw()

    res = str(raw.get("resolution", "3840x2160"))
    try:
        w_str, h_str = res.lower().split("x", 1)
        width, height = int(w_str), int(h_str)
    except ValueError:
        width, height = 3840, 2160

    birdnet = str(raw.get("birdnet_go_url", "")).rstrip("/")

    return Options(
        tv_ip=str(raw.get("tv_ip", "")).strip(),
        birdnet_go_url=birdnet,
        interval_minutes=int(raw.get("interval_minutes", 30)),
        width=width,
        height=height,
        theme=str(raw.get("theme", "light")),
        show_caption=bool(raw.get("show_caption", True)),
        window_hours=int(raw.get("window_hours", 24)),
        collage_fill=float(raw.get("collage_fill", 0.5)),
        sit_confidence=float(raw.get("sit_confidence", 0.90)),
        wall_clock=bool(raw.get("wall_clock", True)),
        wall_weather=bool(raw.get("wall_weather", True)),
        wall_corner=str(raw.get("wall_corner", "bottom-right")),
        matte=str(raw.get("matte", "none")),
        active_hours=str(raw.get("active_hours", "")).strip(),
        ha_token=str(raw.get("ha_token", "")).strip(),
        weather_entity=str(raw.get("weather_entity", "")).strip(),
        fahrenheit=bool(raw.get("fahrenheit", False)),
        log_level=str(raw.get("log_level", "info")),
    )
