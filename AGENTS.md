# HPD TV — Agent Rules (Google Antigravity)

> Put this file at the repo root as `AGENTS.md`, or copy it to `.agent/rules/hpd-tv.md`.
> Repo: github.com/dalemel3-cmd/streams-c · Live site: https://streams-c.vercel.app

## What this is
HPD TV is an **office display** for Shiloh Christian School's Human Performance Department (HPD).
It runs on an onn 4K Google TV stick and shows athlete leaderboards, PRs, clubs, records, trends and a clock.
All athlete data comes from the **HPD app only** (Supabase), through one read-only function.

Out of scope: emails, a daily briefing, Ride Lab, news. Don't build them.

Owner: Mason Melancon. Keep communication direct and brief. Location and timezone: Bentonville, AR (America/Chicago).

## Architecture
```
[Supabase: HPD app]  public.tv_board(p_token) — read-only RPC, returns names + best marks only
        ▲  service call with TV_BOARD_TOKEN (server side)
[Vercel]  Next.js 15 app in web/  → screens + /api/* routes   (streams-c.vercel.app)
        ▲  HTTPS
[TV stick]  "HPD TV" APK (package com.mason.tv) = full-screen WebView shell
```
- The APK is installed once. It reads `https://streams-c.vercel.app/screens.json` to know which screens exist and in what order. New or changed screens ship by deploying the web app. No reinstall.
- Open screens poll `/api/version` every 60 s and reload themselves when a newer deploy is live (`web/components/AutoReload.tsx`).
- `/api/board` keeps the last good response in memory and returns it with `stale: true` if Supabase fails. Screens must never go blank.

## Repo layout
```
web/                      Next.js (TypeScript) — deployed to Vercel, Root Directory = web
  app/leaders/[metric]/   Leaderboards (bench, squat, front-squat, hang-clean, vertical, vertical-no-arms, fly-10, top-speed)
  app/prs/                New PRs (last 7 days)
  app/improved/           Most Improved
  app/clubs/[club]/       1,000 lb club and 16–22 mph speed clubs
  app/records/            Semester records
  app/trends/             Season Trends
  app/clock/              Clock + weather + sportsYou calendar
  app/api/board           Proxies tv_board RPC
  app/api/calendar        sportsYou ICS feed
  app/api/weather         Weather (Open-Meteo)
  app/api/version         Deploy id for auto-reload
  components/             Stage, ScreenMenu, RotateLock, AutoReload, board/* hooks
  lib/                    board.ts (types + metric map), ics.ts, weather.ts, screenSettings.ts, rotateLock.ts
  public/screens.json     Screen list + order (bump "version" when you change it)
  vercel.json             {"framework":"nextjs"} — keep this file
android/                  Kotlin WebView shell (com.mason.tv), Gradle
db/migrations/            SQL changes to public.tv_board (HPD Supabase project)
.github/workflows/android.yml   Builds + signs the APK, publishes GitHub Release android-v<versionCode>
```

## Run, build, deploy
```bash
cd web
npm install
npm run dev        # http://localhost:3000/clock
npm run typecheck
npm run build
```
- **Web deploy:** merging to `main` auto-deploys to Vercel. A real build takes ~30 s; ~6 s means nothing was built (check Root Directory = `web`).
- **APK:** never build locally for release. Bump `versionCode`/`versionName` in `android/app/build.gradle.kts`, merge to `main`, and GitHub Actions publishes a signed release `android-v<versionCode>`. Signing key comes from repo secrets `MASON_TV_KEYSTORE_B64` and `MASON_TV_KEYSTORE_PASSWORD`.
- **Database:** `tv_board` changes only through a new file in `db/migrations/`, applied after the PR is approved and merged. Migrations never write to HPD tables.

## Environment variables (Vercel only)
| Var | Use |
|---|---|
| `HPD_SUPABASE_URL` | HPD Supabase project URL |
| `HPD_SUPABASE_KEY` | Supabase anon/publishable key |
| `TV_BOARD_TOKEN` | Token `tv_board` checks |
| `CALENDAR_ICS_URL` | sportsYou calendar ICS feed |
| `WEATHER_LAT` / `WEATHER_LON` / `WEATHER_TZ` | Defaults: Bentonville, America/Chicago |

**Secrets live in Vercel env vars or GitHub secrets only. Never commit them, never put them in the APK, never log them.** `web/.env.example` holds names only.

## Data rules (non-negotiable)
Numbers on the TV must **match the HPD app exactly**.
- **Lifts:** a single (1 rep) = the weight lifted. Otherwise use the app's e1RM: `weight × (1 + reps / 30)`.
- Only sets of **5 reps or fewer** count.
- Rank on the exact value, then **display rounded to the nearest 5 lb** (same as the app).
- **Speed:** top speed = best of Titan GPS mph or Fly 10 converted to mph (`mph = 20.45 / seconds`).
- **Speed clubs (16–22 mph)** are tiers: each athlete appears only in their highest club.
- **1,000 lb club:** best Bench + best Squat (back or front) + best Clean (hang or power), each rounded to 5 as shown, total ≥ 1,000. Athlete needs all three.
- **Sport filter** shows ONLY athletes on that sport. An athlete with two sport profiles counts for both (`sports[]`).
- **Names:** first name + last initial only (minors, public office). Never show full names or other personal data.
- **Season Trends:** semester-based (Fall = Aug–Dec, Spring = Jan–May). Team average of each athlete's max in their first 2 weeks of the semester vs their last 30 days. Round to 5. Show the current number and the change only.
- **Most Improved:** same window as Season Trends, athletes whose marks span 28+ days.
- **Clock calendar:** today's sportsYou events only; adds tomorrow's at 4 PM local. Refreshes about every 2 minutes.

## Remote / D-pad controls
Navigation is D-pad only. No mouse, no hover, no touch.
- **Left / Right:** previous / next screen (handled by the APK).
- **Up:** lock / unlock the current screen (stops rotation).
- **Down:** open the screen menu (each screen: In rotation / Stand-alone / Off, plus seconds per screen). Saved per TV in localStorage.
- **OK:** primary action. **Back:** back / exit.
- Don't reassign these keys.

## Design rules (10-foot UI)
- **Shiloh colors only:** navy `#030a14` background, gold `#b89c5b` accent, white text (panel `#0a1120`, muted `#bcc1ca` already in the theme). No other colors.
- **Fonts:** Oswald (headlines, numbers), Manrope (body).
- **No 3D effects:** no perspective, tilt, bevels or heavy shadows. Flat and clean.
- Canvas 1920×1080 with a 5% safe area (96 px sides, 54 px top/bottom). The stick's WebView is 960×540 CSS px at DPR 2, so keep `viewport width=device-width`.
- Min body text 32 px, headlines 64 px+, key numbers 160 px+. High contrast.
- Every screen auto-refreshes (default 5 min) and shows a "last updated" time.
- Offline: show the last cached data, never a blank screen.
- The stick has a weak CPU. Keep pages light: no big libraries, minimal animation.

## Working conventions
- TypeScript for web, Kotlin for Android. Small, readable files. Follow existing patterns in `web/components/board/`.
- One feature per branch and PR. Mason approves every merge. Don't merge or deploy on your own.
- Run `npm run typecheck` and `npm run build` before opening a PR.
- Adding a screen: create the route, add it to `web/public/screens.json` (bump `version`), match the existing board frame.
- Don't change system settings on the TV stick beyond what a task needs. Ask before uninstalling anything.
- Device control (when on Mason's network): `adb connect 192.168.0.253:5555`, open a screen with `adb shell am start -n com.mason.tv/.MainActivity --es screen <name>`, screenshot with `adb exec-out screencap -p > shot.png`.
