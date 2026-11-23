# Mason TV — Project Instructions

Custom TV screens for Mason's onn 4K Google TV stick (Google TV with Gemini). Claude builds the app, builds the screens, deploys them, and controls the stick over Wi-Fi.

## Owner
- Mason Melancon — Associate Director of Human Performance, Shiloh Christian School (Bentonville, AR area).
- Communication: direct and brief. No preambles, no recaps.
- Default location for weather/time: Bentonville, AR (America/Chicago).

## Hardware
- **Device:** onn 4K Streaming Device (stick), Google TV / Android TV OS, voice remote.
- **Output:** 3840x2160 capable. Design screens at **1920x1080** (WebView scales).
- **Connection:** same Wi-Fi as the desktop. Controlled with ADB over the network.
- Weak-ish CPU / limited storage. Keep the app small and screens light.

## Architecture
```
[Cloudflare Workers]  Next.js site (OpenNext adapter): one route per screen + /api/* data routes
    ▲  HTTPS
[Stick]   "Mason TV" APK = full-screen WebView shell that loads the Worker's screens
    ▲  ADB over Wi-Fi (port 5555 or wireless-debugging port)
[Desktop] Claude Code: builds, installs, sends commands, takes screenshots
```
- The APK is installed **once**. New or changed screens deploy to Cloudflare Workers. No reinstall.
- The APK reads a remote `screens.json` to know which screens exist and in what order.
- Secrets (Google OAuth, API keys) live in **Cloudflare Worker secrets only** (`wrangler secret put`). Never in the APK or the repo.

## Repo layout
```
mason-tv/
├─ CLAUDE.md
├─ .claude/agents/          # subagents (see below)
├─ android/                 # Mason TV shell app (Kotlin, Gradle)
├─ web/                     # Next.js screens + API routes (deployed to Cloudflare Workers)
│  ├─ app/briefing/  app/ride/  app/weightroom/  app/clock/
│  ├─ app/api/               # calendar, email, weather, news, ride, hpd
│  └─ public/screens.json
└─ scripts/                  # tv.sh / tv.ps1 helper commands
```

## Subagents — when to use which
| Agent | Use for |
|---|---|
| `tv-device-controller` | Connecting to the stick, remote commands, launching apps, routines, installs |
| `android-tv-app-builder` | Anything in `android/` — the WebView shell APK |
| `tv-screen-designer` | Building/restyling screens in `web/app/*` for 10-foot viewing |
| `data-integrator` | `web/app/api/*` — Calendar, Gmail, weather, news, Ride Lab, HPD data |
| `tv-qa-tester` | After any change: install/deploy check, screenshot from the TV, verify |

Always finish a feature with `tv-qa-tester`.

## Device setup (one time, done by Mason)
1. Plug in stick, connect Wi-Fi, sign in to Google.
2. Settings → System → About → tap **Android TV OS build** 7× (developer mode).
3. Settings → System → Developer options → **USB debugging ON**. If present, also **Wireless debugging ON**.
4. Note the IP: Settings → Network & Internet → Wi-Fi network.
5. Approve the "Allow debugging?" popup on first connect (check "Always allow").

## ADB quick reference
```bash
# connect (classic)
adb connect <IP>:5555
# connect (Android 11+ wireless debugging: pair once with the code shown on TV)
adb pair <IP>:<PAIR_PORT>      # enter pairing code
adb connect <IP>:<CONNECT_PORT>

adb devices                                     # confirm
adb shell input keyevent KEYCODE_WAKEUP         # 224 wake
adb shell input keyevent KEYCODE_SLEEP          # 223 sleep
adb shell input keyevent KEYCODE_HOME
adb shell input keyevent KEYCODE_MEDIA_PLAY_PAUSE
adb shell input keyevent KEYCODE_VOLUME_UP      # / _DOWN / _MUTE
adb shell monkey -p <package> -c android.intent.category.LEANBACK_LAUNCHER 1   # launch app
adb shell am start -n com.mason.tv/.MainActivity --es screen briefing        # open a Mason TV screen
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb exec-out screencap -p > shots/$(date +%s).png   # screenshot the TV
adb shell pm list packages | grep -i <name>         # find package names
```
Common packages: YouTube `com.google.android.youtube.tv`, Netflix `com.netflix.ninja`. Verify with `pm list packages`.

## Screen design rules (10-foot UI)
- Canvas 1920x1080. Keep content inside a **5% safe area** (96px sides, 54px top/bottom).
- Min body text **32px**. Headlines 64px+. Key numbers (timers, watts) 160px+.
- High contrast, dark background. No hover states. No tiny icons.
- Navigation is **D-pad only**: left/right = prev/next screen, OK = primary action, Back = exit.
- Every screen auto-refreshes its data (default 5 min). Show a "last updated" time.
- Must render offline-gracefully: show last cached data, never a blank screen.

## Screens (roadmap)
1. **Briefing** — date/time, weather, today's calendar, priority emails, top news (S&C, sports performance, AI/tech, business).
2. **Ride Lab trainer** — interval timer, target power/HR zones, RPE prompt, ride notes.
3. **Weight room** — day's program, rest timers, PR board. May run on a second stick at Shiloh.
4. **Clock / screensaver** — big clock + weather, Protocol Zero styling option.

## Conventions
- Kotlin for Android, TypeScript for web. Small, readable files.
- Commit after each working feature. No secrets in commits.
- If the stick can't be reached: retry `adb connect` once, then tell Mason to check that it's on and on the same Wi-Fi.
- Don't change system settings on the stick beyond what a task needs. Ask before uninstalling anything.
