#!/usr/bin/env bash
#
# One-command signed + notarized macOS release build.
#
#   ./scripts/release.sh
#
# Produces a universal (Apple Silicon + Intel) DMG that is Developer ID signed,
# notarized, and stapled — both the .app and the .dmg — so it opens with no
# Gatekeeper warnings on any Mac, even offline.
#
# Secrets: your Apple ID app-specific password is NEVER stored in this repo.
# The script reads it from the APPLE_PASSWORD env var, or prompts for it
# securely (hidden input) if it isn't set. Generate one at
# https://appleid.apple.com → Sign-In & Security → App-Specific Passwords.
#
set -euo pipefail

# --- Your Apple Developer account --------------------------------------------
# Set these for your own team before releasing. The signing certificate itself
# comes from your login keychain; set APPLE_SIGNING_IDENTITY if you have more
# than one Developer ID certificate installed.
APPLE_ID="${APPLE_ID:?set APPLE_ID to your Apple Developer account email}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:?set APPLE_TEAM_ID to your 10-character team id}"
TARGET="universal-apple-darwin"

# --- Locate project root (script lives in <root>/scripts) --------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Get the app-specific password without leaking it ------------------------
if [[ -z "${APPLE_PASSWORD:-}" ]]; then
  printf 'Apple app-specific password for %s (input hidden): ' "$APPLE_ID"
  read -rs APPLE_PASSWORD
  echo
fi
if [[ -z "$APPLE_PASSWORD" ]]; then
  echo "✗ No APPLE_PASSWORD provided. Aborting." >&2
  exit 1
fi
export APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID

echo "▸ Building signed + notarized universal app (this notarizes the .app)…"
npm run tauri build -- --target "$TARGET"

DMG="src-tauri/target/${TARGET}/release/bundle/dmg/WorkBase_0.1.0_universal.dmg"
if [[ ! -f "$DMG" ]]; then
  # Version is read from tauri.conf.json — fall back to whatever DMG was built.
  DMG="$(ls -t src-tauri/target/${TARGET}/release/bundle/dmg/*.dmg | head -1)"
fi
echo "▸ Built DMG: $DMG"

# Tauri notarizes the .app but not the .dmg wrapper — notarize + staple it too
# so the downloaded disk image itself passes Gatekeeper on first open.
echo "▸ Notarizing the DMG wrapper…"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "$DMG"

echo
echo "▸ Verifying…"
xcrun stapler validate "$DMG"
spctl -a -vvv -t open --context context:primary-signature "$DMG" 2>&1 | sed 's/^/    /'
echo
echo "✅ Signed + notarized + stapled: $DMG"
