#!/bin/sh
# Run on the Orange Pi as the regular desktop user: sh start-kiosk.sh
set -eu
SIGNAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v chromium >/dev/null 2>&1; then
  SIGNAGE_BROWSER=$(command -v chromium)
elif command -v chromium-browser >/dev/null 2>&1; then
  SIGNAGE_BROWSER=$(command -v chromium-browser)
else
  echo 'Chromium was not found. Install Chromium before starting the display.' >&2
  exit 1
fi
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  exec "$SIGNAGE_BROWSER" --ozone-platform=wayland --kiosk --no-first-run --no-default-browser-check --user-data-dir="$HOME/.local/share/cssu-signage/chromium" "file://$SIGNAGE_DIR/index.html"
fi
if ! command -v cage >/dev/null 2>&1; then
  echo 'Cage was not found. Start this from an existing Wayland session, or install Cage.' >&2
  exit 1
fi
exec cage -s -- "$SIGNAGE_BROWSER" --ozone-platform=wayland --kiosk --no-first-run --no-default-browser-check --user-data-dir="$HOME/.local/share/cssu-signage/chromium" "file://$SIGNAGE_DIR/index.html"
