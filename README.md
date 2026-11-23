# StreamS-C · Mason TV

Custom screens for the onn 4K Google TV stick. See `CLAUDE.md` for the full design.

- `web/` — Next.js screens + `/api/*` data routes, deployed to Vercel (set the Vercel project's **Root Directory** to `web`).
- `android/` — WebView shell APK (not built yet).
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

`web/wrangler.jsonc` + `open-next.config.ts` are an unused Cloudflare Workers fallback (`npm run preview` / `npm run deploy` from `web/`). Vercel ignores them.
