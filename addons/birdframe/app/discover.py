"""Zero-config discovery so the user types neither URL nor IP.

BirdNET-Go URL:
  blank option -> ask the Supervisor for the add-on whose slug/name matches
  /birdnet/ and build http://<internal-hostname>:<web-port>; fall back to the
  well-known alexbelgium hostname. (This add-on shares the Supervisor network
  with BirdNET-Go, so the internal hostname resolves and its container web port
  is directly reachable - no host port mapping or mixed-content workaround.)

Frame TV IP(s):
  blank option -> read the Samsung TV integration's own stored connection info
  from Home Assistant's config (mounted read-only), the same host the core
  `samsungtv` integration uses. Returns every Samsung TV entry, so multiple
  Frames are found automatically; non-Art-Mode TVs are filtered out later at
  push time. We only ever READ this file.
"""
from __future__ import annotations

import json
import logging
import os
import re

import requests

log = logging.getLogger("birdframe.discover")

SUPERVISOR = "http://supervisor"
WELL_KNOWN_BIRDNET_HOST = "db21ed7f-birdnet-go"  # alexbelgium slug -> hostname
DEFAULT_WEB_PORT = 8080

# HA config is mounted read-only (see config.yaml `map`). Newer Supervisor
# mounts it at /homeassistant; older at /config.
CONFIG_ENTRIES_PATHS = (
    "/homeassistant/.storage/core.config_entries",
    "/config/.storage/core.config_entries",
)


# ---- BirdNET-Go --------------------------------------------------------------

def _supervisor_headers():
    token = os.environ.get("SUPERVISOR_TOKEN")
    return {"Authorization": f"Bearer {token}"} if token else None


def _web_port(info: dict) -> int:
    """Container-side web port for internal connection (the dict KEY, e.g.
    '8080/tcp' -> 8080), preferring a mapping labelled 'web'."""
    net = info.get("network") or {}
    desc = info.get("network_description") or {}

    def portnum(key) -> int | None:
        try:
            return int(str(key).split("/")[0])
        except (ValueError, IndexError):
            return None

    for key in net:
        if "web" in str(desc.get(key, "")).lower():
            p = portnum(key)
            if p:
                return p
    for key in net:
        if str(key).startswith("8080"):
            return 8080
    for key in net:
        p = portnum(key)
        if p:
            return p
    return DEFAULT_WEB_PORT


def _birdnet_from_supervisor() -> str | None:
    headers = _supervisor_headers()
    if not headers:
        return None
    try:
        r = requests.get(f"{SUPERVISOR}/addons", headers=headers, timeout=10)
        r.raise_for_status()
        addons = (r.json().get("data") or {}).get("addons") or []
    except (requests.RequestException, ValueError) as exc:
        log.info("supervisor add-on list unavailable (%s); trying fallback", exc)
        return None
    hit = next(
        (a for a in addons
         if re.search(r"birdnet", f"{a.get('slug', '')} {a.get('name', '')}", re.I)),
        None,
    )
    if not hit:
        return None
    slug = hit.get("slug")
    try:
        r = requests.get(f"{SUPERVISOR}/addons/{slug}/info", headers=headers, timeout=10)
        r.raise_for_status()
        info = r.json().get("data") or {}
    except (requests.RequestException, ValueError) as exc:
        log.info("supervisor add-on info unavailable for %s (%s)", slug, exc)
        return None
    host = info.get("hostname") or (info.get("dns") or [None])[0] or info.get("ip_address")
    if not host:
        return None
    return f"http://{host}:{_web_port(info)}"


def resolve_birdnet_url(explicit: str) -> str:
    if explicit:
        return explicit.rstrip("/")
    url = _birdnet_from_supervisor()
    if url:
        log.info("auto-discovered BirdNET-Go at %s", url)
        return url
    fallback = f"http://{WELL_KNOWN_BIRDNET_HOST}:{DEFAULT_WEB_PORT}"
    log.info("using well-known BirdNET-Go address %s", fallback)
    return fallback


# ---- Frame TV(s) -------------------------------------------------------------

def discover_tv_hosts(explicit: str) -> list[str]:
    """Comma-separated `explicit` wins; else read every samsungtv host from HA's
    config entries (read-only). Returns [] if none found."""
    if explicit.strip():
        return [h.strip() for h in explicit.split(",") if h.strip()]

    for path in CONFIG_ENTRIES_PATHS:
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError) as exc:
            log.warning("could not read %s: %s", path, exc)
            continue
        entries = (data.get("data") or {}).get("entries") or []
        hosts = []
        for entry in entries:
            if entry.get("domain") != "samsungtv":
                continue
            host = (entry.get("data") or {}).get("host")
            if host:
                model = (entry.get("data") or {}).get("model", "")
                hosts.append(host)
                log.info("found Samsung TV in HA config: %s (%s)", host, model or "?")
        if hosts:
            return hosts
        log.warning("no samsungtv entries in %s", path)
        return []
    log.warning(
        "HA config not readable for TV discovery - set tv_ip manually "
        "(check the `homeassistant_config` map)"
    )
    return []
