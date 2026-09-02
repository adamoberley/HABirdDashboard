#!/usr/bin/env bash
# HABirdDashboard - installer.
#
# Copies the static dashboard (homeassistant/www) plus the bundled bird
# illustrations (avian/assets) into Home Assistant's www folder, where it
# is served at /local/habird/index.html.
#
# Run it from a clone of this repo on the machine that can see your HA
# config directory - e.g. inside the "Terminal & SSH" app
# (config lives at /config), or on any computer with the HA config
# folder mounted via the Samba app.
#
# Usage:
#   ./install.sh [target]        # default target: /config/www/habird

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-/config/www/habird}"

if [ ! -d "$(dirname "$TARGET")" ]; then
  mkdir -p "$(dirname "$TARGET")"
fi

echo "Installing HABirdDashboard to: $TARGET"
mkdir -p "$TARGET/assets"

# Frontend (index.html, apt.js, styles.css, config.js, favicon).
# Don't clobber an existing config.js - the user may have set their
# BirdNET-Go URL or confidence threshold there.
for f in index.html apt.js masks.js styles.css favicon.png; do
  cp "$REPO_ROOT/homeassistant/www/$f" "$TARGET/$f"
done
# Translation tables - the page's i18n bootstrap loads these; without them
# every UI string falls back to English (and older pages would show keys).
mkdir -p "$TARGET/i18n"
cp "$REPO_ROOT/homeassistant/www/i18n/"*.js "$TARGET/i18n/"
if [ -f "$TARGET/config.js" ]; then
  echo "Keeping existing config.js (new defaults at homeassistant/www/config.js)"
else
  cp "$REPO_ROOT/homeassistant/www/config.js" "$TARGET/config.js"
fi

# Bundled artwork: kachō-e illustrations (perched + flight) and the
# photo-cutout fallbacks.
echo "Copying illustrations (~1.1GB of PNGs, may take a few minutes)..."
cp -r "$REPO_ROOT/avian/assets/illustrations" "$TARGET/assets/"
cp -r "$REPO_ROOT/avian/assets/cutouts" "$TARGET/assets/"

echo
echo "Done. Open: http://<your-home-assistant>:8123/local/habird/index.html"
echo "Then add it to HA: Settings -> Dashboards -> Add dashboard -> Webpage,"
echo "with URL /local/habird/index.html"
