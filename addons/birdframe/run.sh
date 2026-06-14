#!/usr/bin/env bash
# Entry point. No bashio on this base image; the app reads its settings from
# /data/options.json (written by the Supervisor from the add-on config) itself.
set -euo pipefail
echo "[birdframe] starting"
# Non-fatal sanity check that the import main.py needs resolves in this python.
python3 -c "from playwright.sync_api import sync_playwright; print('[birdframe] playwright OK', flush=True)" \
  || echo "[birdframe] WARNING: playwright import check failed"
exec python3 /app/main.py
