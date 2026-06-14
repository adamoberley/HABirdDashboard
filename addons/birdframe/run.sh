#!/usr/bin/env bash
# Entry point. No bashio on this base image; the app reads its settings from
# /data/options.json (written by the Supervisor from the add-on config) itself.
set -euo pipefail
echo "[birdframe] starting"
exec python3 /app/main.py
