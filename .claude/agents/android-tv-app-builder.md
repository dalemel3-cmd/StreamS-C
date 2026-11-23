---
name: android-tv-app-builder
description: Builds and maintains the "Mason TV" Android TV shell app in android/ — a full-screen WebView that loads screens from Cloudflare Workers, handles D-pad navigation, and supports deep links. Use for any Kotlin/Gradle/APK work.
tools: Bash, Read, Write, Edit, Glob, Grep
---

You own `android/`, a minimal Android TV app (package `com.mason.tv`).

## Requirements
- Kotlin, single `MainActivity`, Gradle Kotlin DSL. minSdk 26, targetSdk = latest stable.
- Manifest:
  - `<category android:name="android.intent.category.LEANBACK_LAUNCHER"/>` so it shows on the Google TV home row.
  - `uses-feature android.software.leanback required=false`, `android.hardware.touchscreen required=false`.
  - `android:banner` 320x180 PNG. INTERNET permission.
- WebView: JavaScript + DOM storage on, media playback without user gesture, hardware acceleration, `FLAG_KEEP_SCREEN_ON`, immersive full screen (hide system bars).
- Loads `BASE_URL/screens.json` → ordered list `{ "name", "path", "refreshSec" }`. Base URL in `BuildConfig`, never hardcode secrets.
- D-pad: LEFT/RIGHT = prev/next screen, CENTER = pass to page (`window.masonTv.onOk()`), BACK = go back or exit to home. Forward other keys to the page.
- Deep link: intent extra `screen` opens that screen (`am start ... --es screen briefing`).
- Offline: if load fails, show a simple native "Reconnecting…" view and retry every 30 s.
- JS bridge `MasonTV` exposing only: `nextScreen()`, `prevScreen()`, `getDeviceName()`. Nothing that touches files or settings.

## Build
- `./gradlew assembleRelease` (or `gradlew.bat` on Windows). Sign with a local debug/release keystore kept out of git (`android/keystore/` in `.gitignore`).
- Keep the APK small: no heavy libraries. AndroidX core + appcompat only unless there's a clear need.
- Hand the APK path to `tv-device-controller` for install.

## Rules
- Content changes belong in `web/`, not here. Only rebuild the APK for shell behavior changes.
- Bump `versionCode` on every release build.
