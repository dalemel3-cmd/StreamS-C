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

## Web remote (`/remote`)
Control the TV from any computer or phone: https://streams-c.vercel.app/remote (password = Vercel env `REMOTE_PASSWORD`).
Change screen, prev/next, lock, OK, reload, sport filter, seconds per screen, and each screen's rotation mode. Shows what the TV is on and when it last checked in.
- The TV app polls `/api/remote/poll` every 15 s, every 2 s while the remote page is open. Commands sit in `tv_private.remote_commands` in the HPD Supabase project (migration `db/migrations/2026-11-26_tv_remote.sql`) and expire after 2 minutes.
- It only works while the stick is online. Offline recovery steps are on the page under "TV offline or no remote?".
