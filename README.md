# StreamS-C · Mason TV

Custom screens for the onn 4K Google TV stick. See `CLAUDE.md` for the full design.

- `web/` — Next.js screens + `/api/*` data routes, deployed to Cloudflare Workers via `@opennextjs/cloudflare` (Workers Builds root directory: `web`).
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

## Deploy (Cloudflare Workers, free tier)
```bash
cd web
npm run preview   # build + run as a Worker locally at http://localhost:8787
npm run deploy    # build + deploy (needs `npx wrangler login` once)
```
Or connect the repo in Cloudflare → Workers & Pages → Create → Import a repository, root directory `web`, build command `npx opennextjs-cloudflare build`, deploy command `npx opennextjs-cloudflare deploy`.
