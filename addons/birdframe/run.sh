#!/usr/bin/env bash
# Entry point. No bashio on this base image; the app reads its settings from
# /data/options.json (written by the Supervisor from the add-on config) itself.
set -euo pipefail
echo "[birdframe] starting"
# One-line sanity check so the log confirms Playwright is importable here.
python3 -c "import sys, playwright; print(f'[birdframe] python={sys.executable} playwright={playwright.__version__}')"
exec python3 /app/main.py
