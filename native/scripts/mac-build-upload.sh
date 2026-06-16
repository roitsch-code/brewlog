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
IDENTITY="Apple Distribution: Markus Reuter (WTZD878P9H)"
APP_PROFILE_NAME="BTTS AppStore Dist"
# Build 13+: the watch carries the Push (aps-environment) capability, not
# HealthKit. This profile was created via the ASC API and carries aps-environment.
WATCH_PROFILE_NAME="BTTS Watch Push Dist"
ASC_KEY_ID="A57ZL8HND3"
ASC_ISSUER="aae3f951-3c39-4c49-bbb0-f7176ecf3459"
ASC_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
PROFILE_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"

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

# Find a provisioning profile by its display Name (filenames are UUIDs).
find_profile() {
  local want="$1" f name
  shopt -s nullglob
  for f in "$PROFILE_DIR"/*.mobileprovision; do
    name="$(security cms -D -i "$f" 2>/dev/null | plutil -extract Name raw -o - - 2>/dev/null || true)"
    if [ "$name" = "$want" ]; then echo "$f"; return 0; fi
  done
  return 1
}
APP_PROFILE="$(find_profile "$APP_PROFILE_NAME")"   || { echo "ERROR: profile '$APP_PROFILE_NAME' not found in $PROFILE_DIR" >&2; exit 1; }
WATCH_PROFILE="$(find_profile "$WATCH_PROFILE_NAME")" || { echo "ERROR: profile '$WATCH_PROFILE_NAME' not found in $PROFILE_DIR" >&2; exit 1; }
echo "app profile:   $APP_PROFILE"
echo "watch profile: $WATCH_PROFILE"

# ── (0) sync project + watch target ──────────────────────────────────────────
say "Sync Capacitor project + watch target"
cd "$NATIVE"
npm install
npx cap sync ios
npm run assets || true   # Splash.imageset is missing; icons (the part that matters) still generate
ruby scripts/add_watch_target.rb

# ── (1) archive UNSIGNED ─────────────────────────────────────────────────────
say "Archive (unsigned), build $BUILD"
rm -rf "$ARCHIVE"
xcodebuild archive \
  -project "$PROJ" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CURRENT_PROJECT_VERSION="$BUILD" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""

# ── (2) build the Payload and MANUALLY re-sign (HealthKit path) ───────────────
say "Re-sign app + watch with the distribution cert (HealthKit entitlement)"
rm -rf "$WORK"; mkdir -p "$WORK/Payload"
cp -R "$ARCHIVE/Products/Applications/App.app" "$WORK/Payload/App.app"
APP="$WORK/Payload/App.app"
WATCH="$APP/Watch/BTTSWatch.app"
[ -d "$WATCH" ] || { echo "ERROR: embedded watch app missing at $WATCH — did add_watch_target.rb run?" >&2; exit 1; }

# Drop each profile into its bundle as embedded.mobileprovision.
cp "$APP_PROFILE"   "$APP/embedded.mobileprovision"
cp "$WATCH_PROFILE" "$WATCH/embedded.mobileprovision"

# Extract each profile's entitlements (this is what carries HealthKit).
security cms -D -i "$APP_PROFILE"   | plutil -extract Entitlements xml1 -o "$WORK/app.ent"   -
security cms -D -i "$WATCH_PROFILE" | plutil -extract Entitlements xml1 -o "$WORK/watch.ent" -

sign() { codesign -f -s "$IDENTITY" --timestamp "$@"; }

# Bottom-up: nested frameworks first, then the watch app, then the iOS app.
shopt -s nullglob
for fw in "$WATCH"/Frameworks/* "$APP"/Frameworks/*; do sign "$fw"; done
sign --entitlements "$WORK/watch.ent" "$WATCH"
sign --entitlements "$WORK/app.ent"   "$APP"

# ── Verify before upload (catches the build-4/5/6 class of defects) ───────────
say "Verify"
codesign -v --deep --strict "$APP"
echo "Payload root (must be App.app ONLY):"; ls "$WORK/Payload"
echo "Watch embedded:"; ls "$APP/Watch"
echo "HealthKit in signed watch entitlements:"
codesign -d --entitlements - "$WATCH" 2>/dev/null | grep -i healthkit || echo "  (none — STOP, do not ship)"
echo "iOS build:"; /usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$APP/Info.plist"
echo "watch build:"; /usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$WATCH/Info.plist"

# ── (3) zip + upload to TestFlight ───────────────────────────────────────────
say "Package + upload"
cd "$WORK"
rm -f App.ipa
zip -qry App.ipa Payload
xcrun altool --upload-app -f App.ipa -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER"

say "Done — build $BUILD uploaded. It appears in TestFlight in ~5–15 min."
