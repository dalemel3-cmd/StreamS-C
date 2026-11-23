# StreamS-C · Mason TV

Custom screens for the onn 4K Google TV stick. See `CLAUDE.md` for the full design.

- `web/` — Next.js screens + `/api/*` data routes, deployed to Vercel (set the Vercel project's **Root Directory** to `web`).
- `android/` — Mason TV shell app (Kotlin WebView, package `com.mason.tv`). Built by GitHub Actions; signed APKs are published as GitHub Releases tagged `android-v<versionCode>`.
- `scripts/` — ADB helpers (not built yet).

## Screens
| Screen | Path | Status |
|---|---|---|
| Clock | `/clock` | Built. OK on the remote (Enter in a browser) toggles Protocol Zero styling; `?theme=pz` forces it. |
| Briefing | `/briefing` | Not started |
| Ride Lab | `/ride` | Not started |
| Weight room | `/weightroom` | Not started |

`web/public/screens.json` lists the screens the APK shows, in order.

## Local dev
```bash
cd web
npm install
npm run dev   # http://localhost:3000/clock
```

## Deploy
Vercel (Hobby): project imported from this repo with **Root Directory** `web`. Pushes to `main` deploy automatically.

## Android app
- Loads `https://streams-c.vercel.app/screens.json`, then the first screen. D-pad left/right = prev/next screen, OK = `window.masonTv.onOk()`, Back = back/exit.
- Deep link: `adb shell am start -n com.mason.tv/.MainActivity --es screen clock`.
- Offline: native "Reconnecting…" view, retries every 30 s; last screen list is cached.
- Signing: repo secrets `MASON_TV_KEYSTORE_B64` and `MASON_TV_KEYSTORE_PASSWORD`. The keystore is never committed. Bump `versionCode` in `android/app/build.gradle.kts` for each release.
