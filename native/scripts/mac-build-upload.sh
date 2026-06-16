#!/usr/bin/env bash
#
# BTTS — one-command Mac build + TestFlight upload.
#
# Runs the whole documented recipe end to end: sync the Capacitor project,
# re-add the watch target, archive UNSIGNED, then MANUALLY re-sign the app +
# watch with the local Apple Distribution cert and the App Store provisioning
# profiles that carry HealthKit (cloud export can't bake that entitlement, so
# the wrist-down buzz needs this manual path), then upload to TestFlight.
#
# Usage:   native/scripts/mac-build-upload.sh <BUILD_NUMBER>
# Example: native/scripts/mac-build-upload.sh 9
#
# Prereqs that already persist on this Mac from prior builds (the script checks
# each and stops with a clear message if one is missing):
#   - Xcode + command line tools
#   - the xcodeproj ruby gem  (gem install xcodeproj --user-install --no-document)
#   - keychain identity: Apple Distribution: Markus Reuter (WTZD878P9H)
#   - profiles "BTTS AppStore Dist" + "BTTS Watch Push Dist" in
#       ~/Library/Developer/Xcode/UserData/Provisioning Profiles/
#       (the watch profile carries aps-environment — created via the ASC API)
#   - ASC API key at ~/.appstoreconnect/private_keys/AuthKey_A57ZL8HND3.p8
#
set -euo pipefail

BUILD="${1:-}"
if [ -z "$BUILD" ]; then
  echo "ERROR: pass the build number, e.g.  native/scripts/mac-build-upload.sh 9" >&2
  exit 1
fi

# ── Fixed identifiers (persist across builds) ────────────────────────────────
# Build 15+: XCODE-MANAGED (automatic) signing. Xcode registers the watch's
# capabilities (push + Time Sensitive Notifications) and creates the
# distribution profiles on the fly via -allowProvisioningUpdates + the ASC key.
# This is the ONLY path that gets the time-sensitive entitlement into the
# profile (the ASC API can't add it; the old manual re-sign failed upload 90163).
IDENTITY="Apple Distribution: Markus Reuter (WTZD878P9H)"
TEAM_ID="WTZD878P9H"
ASC_KEY_ID="A57ZL8HND3"
ASC_ISSUER="aae3f951-3c39-4c49-bbb0-f7176ecf3459"
ASC_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"

# Mac global git blocks SPM via safe.bareRepository=explicit; scope an override.
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=safe.bareRepository
export GIT_CONFIG_VALUE_0=all

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NATIVE="$ROOT/native"
PROJ="$NATIVE/ios/App/App.xcodeproj"
ARCHIVE="/tmp/App.xcarchive"
WORK="/tmp/btts-build-$BUILD"

say() { printf '\n=== %s ===\n' "$*"; }

# ── Preflight: fail early with a readable message, not a cryptic codesign error ─
say "Preflight checks"
security find-identity -v -p codesigning | grep -q "$IDENTITY" \
  || { echo "ERROR: signing identity not in keychain: $IDENTITY" >&2; exit 1; }
[ -f "$ASC_KEY_PATH" ] || { echo "ERROR: ASC API key missing: $ASC_KEY_PATH" >&2; exit 1; }
gem list -i xcodeproj >/dev/null 2>&1 \
  || { echo "ERROR: ruby gem 'xcodeproj' missing. Run: gem install xcodeproj --user-install --no-document" >&2; exit 1; }

# ── (0) sync project + watch target ──────────────────────────────────────────
say "Sync Capacitor project + watch target"
cd "$NATIVE"
npm install
npx cap sync ios
npm run assets || true   # Splash.imageset is missing; icons (the part that matters) still generate
ruby scripts/add_watch_target.rb

# ── (1) archive with AUTOMATIC (Xcode-managed) signing ───────────────────────
# -allowProvisioningUpdates + the ASC key let Xcode register the watch's
# capabilities (push + time-sensitive) and create distribution profiles on the
# fly — so the entitlements are baked in at archive time, no manual re-sign.
say "Archive (Xcode-managed signing), build $BUILD"
rm -rf "$ARCHIVE" "$WORK"
xcodebuild archive \
  -project "$PROJ" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CURRENT_PROJECT_VERSION="$BUILD" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER"

# ── (2) export the signed .ipa for the App Store ─────────────────────────────
say "Export signed IPA"
mkdir -p "$WORK"
# Inject the team id into exportOptions (kept out of the committed file).
plutil -replace teamID -string "$TEAM_ID" "$NATIVE/exportOptions.plist"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$WORK/export" \
  -exportOptionsPlist "$NATIVE/exportOptions.plist" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER"
git -C "$ROOT" checkout -- native/exportOptions.plist 2>/dev/null || true  # no team id in the repo

IPA="$(ls "$WORK"/export/*.ipa 2>/dev/null | head -1)"
[ -n "$IPA" ] || { echo "ERROR: no .ipa produced by export" >&2; exit 1; }

# ── Verify the signed watch entitlements before upload ───────────────────────
say "Verify"
WATCH_BIN="$WORK/export/__watch.app"
rm -rf "$WORK/unzip"; mkdir -p "$WORK/unzip"; unzip -qo "$IPA" -d "$WORK/unzip"
WATCH_APP="$(ls -d "$WORK"/unzip/Payload/App.app/Watch/*.app 2>/dev/null | head -1)"
if [ -n "$WATCH_APP" ]; then
  echo "Payload root (must be App.app ONLY):"; ls "$WORK/unzip/Payload"
  echo "watch entitlements (want aps-environment + time-sensitive):"
  codesign -d --entitlements - "$WATCH_APP" 2>/dev/null | grep -iE "aps-environment|time-sensitive" || echo "  (MISSING — check signing)"
fi

# ── (3) upload to TestFlight ─────────────────────────────────────────────────
say "Upload"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER"

say "Done — build $BUILD uploaded. It appears in TestFlight in ~5–15 min."
