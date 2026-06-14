"""Warm the illustration cache with only this station's birds.

BirdNET-Go's /api/v2/analytics/species/summary lists every species the station
has ever detected - the exact set that can appear in any collage window, and a
much tighter set than "every bird in the region". We slugify each scientific
name (matching the harness's own slugify) and prefetch its perched + flight
illustrations and photo-cutout fallback into the local cache.

This is best-effort and runs off the hot path: anything it misses is still
fetched on demand by the server's CDN fall-through when the renderer asks.
"""
from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor

import requests

from server import AssetCache

log = logging.getLogger("birdframe.species")


def slugify(sci: str) -> str:
    """Mirror of apt.js slugify(): lowercase, non-alphanumerics -> '-', trimmed."""
    return re.sub(r"[^a-z0-9]+", "-", sci.lower()).strip("-")


def _fetch_species(birdnet_go_url: str) -> list[str]:
    url = birdnet_go_url + "/api/v2/analytics/species/summary"
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        rows = resp.json()
    except (requests.RequestException, ValueError) as exc:
        log.warning("could not read species summary from %s: %s", url, exc)
        return []
    slugs = []
    for row in rows or []:
        sci = (row or {}).get("scientific_name")
        if sci:
            slugs.append(slugify(sci))
    return sorted(set(slugs))


def prewarm(birdnet_url: str, assets: AssetCache, max_workers: int = 8) -> None:
    """Blocking; call from a background thread. Idempotent (skips cached)."""
    slugs = _fetch_species(birdnet_url)
    if not slugs:
        return
    log.info("prewarming illustrations for %d species", len(slugs))

    def warm(slug: str) -> None:
        # Perched first (always exists); flight (-2) and cutout are optional and
        # 404s are expected - the page's fallback chain handles those.
        assets.prewarm("illustrations", f"{slug}.png")
        assets.prewarm("illustrations", f"{slug}-2.png")
        assets.prewarm("cutouts", f"{slug}.png")

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        pool.map(warm, slugs)
    log.info("prewarm complete")
