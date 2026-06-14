#!/usr/bin/env bash
# Refresh the bundled renderer harness from the project's source of truth
# (homeassistant/www). The add-on serves these verbatim; config.js is excluded
# because the add-on generates its own from the user's options at runtime.
#
# Run after changing apt.js / styles.css / masks.js / index.html so the Frame
# render matches the card. (The card itself is rebuilt with `npm run build`.)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="$here/../../homeassistant/www"
cp "$src/index.html" "$src/styles.css" "$src/masks.js" "$src/apt.js" "$src/favicon.png" "$here/www/"
echo "synced www/ from $src (config.js intentionally excluded)"
