#!/usr/bin/env python3
"""AvianVisitors - per-illustration flight HEADING for the ring "flow" layout.

The ring collage can bank every in-flight bird so it follows the circle's
tangent (a wheeling flock). To do that the renderer needs to know which way
each flight illustration is *already* pointing. This script asks Gemini Vision
for two anatomical points per flight render - the BEAK tip and the TAIL tip -
and turns the tail->beak vector into a heading angle (degrees, screen
convention: 0 = points right, 90 = points down, 180 = left, 270 = up).

Only flight renders (the `<slug>-2.png`) are processed; perched birds don't
flow. Head-on / tail-toward-viewer poses (no clear in-plane direction) are
flagged `ambiguous` and OMITTED from the table, so the renderer leaves them
upright instead of pointing a meaningless way.

Output:
  - dirs.json            : {slug-2: heading, ...} plus an audit of every call.
  - homeassistant/www/masks.js : a `var DIRS = {...};` line (inserted after
                           MASKS, or replaced in place) - the same file DIMS
                           and MASKS live in, so the card build and the Frame
                           sync pick it up with zero extra wiring.

Usage:
    export GEMINI_API_KEY='your-key'           # or --gemini-key / .gemini_key
    python3 build_dirs.py                       # all flight renders
    python3 build_dirs.py calypte-anna-2        # one slug (re-annotate)
    python3 build_dirs.py --check               # parse cache + rewrite masks.js only
"""
from __future__ import annotations
import argparse
import base64
import json
import math
import os
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-3.5-flash:generateContent"
)

# macOS Python.framework ships without a usable CA bundle, so urllib HTTPS dies
# with CERTIFICATE_VERIFY_FAILED even though curl works. Build a context off
# certifi so this runs without the SSL_CERT_FILE dance (kept as a fallback).
def _ssl_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


DIRS_PROMPT = """You are analyzing a stylized kachō-e woodblock illustration of a SINGLE bird IN FLIGHT on a transparent/plain background.

Locate two points and give each as fractions of the image (x: 0.0 = left edge, 1.0 = right edge; y: 0.0 = TOP edge, 1.0 = bottom edge):
1. "beak": the tip of the bird's beak / bill - the very front of the HEAD.
2. "tail": the rear-most tip of the TAIL. For a forked or streamered tail, use the point midway between the fork tips.

The bird's flight direction runs from the TAIL toward the BEAK. Do NOT confuse a pointed or deeply forked tail for the beak - the beak is on the head, near the eye. Look for the eye to find the head end.

Respond with ONLY a JSON object (no markdown, no prose):
{"beak":{"x":<0-1>,"y":<0-1>},"tail":{"x":<0-1>,"y":<0-1>},"confidence":"low|medium|high","ambiguous":<true ONLY if the bird is head-on or tail-toward-viewer so there is no clear in-plane direction, else false>}"""

_SSL = _ssl_context()


def slugify(sci: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", sci.lower()).strip("-")


def call_gemini(api_key: str, parts: list) -> dict:
    payload = {"contents": [{"parts": parts}],
               "generationConfig": {"temperature": 0}}
    req = urllib.request.Request(
        GEMINI_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    backoff = 4.0
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120, context=_SSL) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(backoff); backoff *= 2; continue
            raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='ignore')[:200]}")
        except (urllib.error.URLError, ssl.SSLError):
            if attempt < 4:
                time.sleep(backoff); backoff *= 2; continue
            raise
    raise RuntimeError("retries exhausted")


def extract_json(resp: dict) -> dict | None:
    for cand in resp.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            text = (part.get("text") or "").strip()
            if not text:
                continue
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                a, b = text.find("{"), text.rfind("}")
                if a >= 0 and b > a:
                    try:
                        return json.loads(text[a:b + 1])
                    except json.JSONDecodeError:
                        pass
    return None


def heading_of(rec: dict) -> float | None:
    """tail->beak vector -> degrees (0=right, 90=down). None if unusable."""
    try:
        bx, by = float(rec["beak"]["x"]), float(rec["beak"]["y"])
        tx, ty = float(rec["tail"]["x"]), float(rec["tail"]["y"])
    except (KeyError, TypeError, ValueError):
        return None
    dx, dy = bx - tx, by - ty
    if abs(dx) < 1e-4 and abs(dy) < 1e-4:
        return None
    return round(math.degrees(math.atan2(dy, dx))) % 360


def annotate_one(api_key: str, png: Path) -> dict:
    parts = [
        {"text": DIRS_PROMPT},
        {"inlineData": {"mimeType": "image/png",
                        "data": base64.b64encode(png.read_bytes()).decode()}},
    ]
    rec = extract_json(call_gemini(api_key, parts)) or {}
    rec["heading"] = heading_of(rec)
    return rec


def _cdiff(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


def reconcile(rec: dict) -> int | None:
    """Final heading to bake, or None to omit (render upright). When a 2nd
    cross-check pass (heading2) is present, keep only where the two passes
    agree within 40deg - taking their circular mean - and drop disagreements,
    so a head/tail-confused bird (the gull failure mode) renders upright
    instead of backwards."""
    if rec.get("ambiguous") or rec.get("ambiguous2"):
        return None
    h1, h2 = rec.get("heading"), rec.get("heading2")
    if h1 is None:
        return None
    if h2 is None:
        return int(h1) % 360
    if _cdiff(h1, h2) > 40:
        return None
    mx = math.cos(math.radians(h1)) + math.cos(math.radians(h2))
    my = math.sin(math.radians(h1)) + math.sin(math.radians(h2))
    return round(math.degrees(math.atan2(my, mx))) % 360


# DIRS table is keyed by the rendered asset slug (the "-2" flight variant) and
# stores integer degrees. Omit ambiguous / unusable so the renderer leaves
# those birds upright.
def write_masks_dirs(masks_path: Path, headings: dict[str, int]) -> None:
    src = masks_path.read_text()
    body = ",".join(f'"{k}":{v}' for k, v in sorted(headings.items()))
    line = "var DIRS = {" + body + "};"
    if re.search(r"^var DIRS = .*;$", src, re.M):
        src = re.sub(r"^var DIRS = .*;$", line, src, count=1, flags=re.M)
    else:
        # First run: no DIRS line yet. Insert right after the MASKS line.
        m = re.search(r"^var MASKS = .*;$", src, re.M)
        if not m:
            raise SystemExit("could not find 'var MASKS = ...;' in masks.js")
        src = src[:m.end()] + "\n" + line + src[m.end():]
    masks_path.write_text(src)


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*", help="Asset slugs to (re)annotate, e.g. 'larus-californicus-2'. Default: every *-2.png.")
    ap.add_argument("--dir", type=Path, default=root / "avian" / "assets" / "illustrations")
    ap.add_argument("--out", type=Path, default=here / "dirs.json")
    ap.add_argument("--masks", type=Path, default=root / "homeassistant" / "www" / "masks.js")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--gemini-key", help="Gemini API key (or GEMINI_API_KEY env, or .gemini_key file)")
    ap.add_argument("--check", action="store_true", help="Skip Gemini; rebuild masks.js DIRS from the existing dirs.json cache.")
    ap.add_argument("--verify", action="store_true", help="Cross-check: run a 2nd independent pass into heading2; headings whose two passes disagree by >40deg are dropped.")
    args = ap.parse_args()

    cache: dict[str, dict] = {}
    if args.out.exists():
        cache = json.loads(args.out.read_text())

    if not args.check:
        api_key = args.gemini_key or os.environ.get("GEMINI_API_KEY", "")
        keyfile = here / ".gemini_key"
        if not api_key and keyfile.exists():
            api_key = keyfile.read_text().strip()
        if not api_key:
            print("error: GEMINI_API_KEY required (--gemini-key / env / .gemini_key)", file=sys.stderr)
            return 2

        if args.slugs:
            pngs = [args.dir / f"{s}.png" for s in args.slugs]
        else:
            pngs = sorted(p for p in args.dir.glob("*-2.png"))
        if args.verify:
            todo = [p for p in pngs if p.exists() and (args.slugs or "heading2" not in cache.get(p.stem, {}))]
        else:
            todo = [p for p in pngs if p.exists() and (args.slugs or p.stem not in cache)]
        print(f"{'cross-checking' if args.verify else 'annotating'} {len(todo)} flight illustrations "
              f"({len(cache)} cached, {args.workers} workers)\n")

        lock = threading.Lock()
        done = [0]

        def work(png: Path) -> None:
            try:
                rec = annotate_one(api_key, png)
            except Exception as e:
                rec = {"error": str(e), "heading": None}
            with lock:
                if args.verify:
                    e = cache.setdefault(png.stem, {})
                    e["heading2"] = rec.get("heading")
                    e["confidence2"] = rec.get("confidence")
                    e["ambiguous2"] = rec.get("ambiguous")
                else:
                    cache[png.stem] = rec
                done[0] += 1
                rr = cache[png.stem]
                final = reconcile(rr)
                if args.verify:
                    msg = (f"p1={rr.get('heading')} p2={rr.get('heading2')} -> "
                           + (f"{final}deg" if final is not None else "DROP (disagree/ambiguous)"))
                else:
                    msg = (f"{rr.get('heading')}deg (conf={rr.get('confidence','?')})"
                           if rr.get("heading") is not None else rr.get("error", "no direction"))
                print(f"  [{done[0]:>3}/{len(todo)}] {png.stem}: {msg}")
                args.out.write_text(json.dumps(cache, indent=0, sort_keys=True))

        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            list(ex.map(work, todo))

    # Build the DIRS table: confident, reconciled headings only.
    reconciled = {slug: reconcile(rec) for slug, rec in cache.items()}
    headings = {slug: h for slug, h in reconciled.items() if h is not None}
    omitted = sorted(s for s, h in reconciled.items() if h is None)
    # Hand-verified overrides win over the vision pass - for the occasional bird
    # the model reverses (a gull drawn facing the opposite way to its kin, etc.).
    ov_path = here / "dirs_overrides.json"
    if ov_path.exists():
        ov = {k: int(v) % 360 for k, v in json.loads(ov_path.read_text()).items()}
        headings.update(ov)
        omitted = [s for s in omitted if s not in ov]
        print(f"applied {len(ov)} hand-verified override(s) from {ov_path.name}")
    write_masks_dirs(args.masks, headings)
    print(f"\ndone. {len(headings)} headings baked into {args.masks.name}; "
          f"{len(omitted)} omitted (ambiguous/unreadable).")
    if omitted:
        print("  omitted (render upright): " + ", ".join(omitted[:40])
              + (" ..." if len(omitted) > 40 else ""))
    print(f"  cache -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
