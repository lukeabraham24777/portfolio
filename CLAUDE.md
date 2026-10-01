# Portfolio (luke-abraham.com)

Personal site: a React + three.js (react-three-fiber) "cottage" scene built with Vite. A virtual PC in the scene shows projects (including a live CmdTab download count) and a PIN-gated résumé.

## Architecture & request flow
- `src/` — the Vite app (`App.jsx`, `components/Scene.jsx`, `components/Overlay.jsx`, zustand `store.js`); `public/` — logo and sounds.
- `api/resume.js`, `api/downloads.js` — Vercel-style `(req, res)` handlers, kept unchanged.
- `worker/index.js` — Cloudflare Worker entry. Static files in `dist/` are served by Workers static assets first; any request that matches no file reaches `fetch()`, which routes `/api/resume` and `/api/downloads` through a small req/res adapter (`runVercelHandler`) and returns 404 otherwise.
  - Sets `x-forwarded-for` from `cf-connecting-ip` (used for rate limiting).
  - GET responses that carry `s-maxage` are stored with the Cache API (works because the site is on a custom domain).
- Frontend calls: `POST /api/resume` with `{ pin }` → PDF; `GET /api/downloads?key=cmdtab:downloads` → `{ count }` (cached 60 s, stale-while-revalidate 300).

## Hosting (Cloudflare Workers, free plan)
- Worker `portfolio`; live at https://luke-abraham.com and https://www.luke-abraham.com.
- Built by Cloudflare Workers Builds on push to `cloudflare-migration` (switches to `main` once merged). Build `npm run build` (→ `dist/`), deploy `npx wrangler deploy`.
- `wrangler.jsonc`: `nodejs_compat` (for `node:crypto`, `Buffer`, and env vars as `process.env`), assets directory `dist`.
- The site used to run on Vercel; Vercel-specific wording in comments and `.env.example` is legacy. Vercel is no longer used.
- Free-plan limits: 100k Worker requests/day shared across the whole Cloudflare account (static assets free), 10 ms CPU per invocation.

## Data stores
- **Upstash Redis** (REST API, no SDK) — shared with the CmdTab website (repo `cmdtabwebsite`):
  - `cmdtab:downloads` — CmdTab download counter. Read-only here (`api/downloads.js`, allowlisted keys only); incremented by cmd-tab.com's `/api/download`.
  - `ratelimit:resume:<ip>` — wrong-PIN attempt counter (`INCR` + `EXPIRE 3600 NX`, max 10/hour). Needs a write-capable token. If Upstash is unreachable the résumé endpoint fails closed (503).
- No other database. The résumé PDF is committed only as ciphertext in `api/_resume.enc.js`.

## Résumé gating
- `RESUME_PIN` — what visitors type (compared trimmed, lowercase, constant-time).
- `RESUME_KEY` — 64 hex chars, AES-256-GCM key; blob format `base64(iv[12] | tag[16] | ciphertext)`.
- Update the résumé: `RESUME_KEY=<64 hex> node scripts/encrypt-resume.js path/to/resume.pdf` → rewrites `api/_resume.enc.js`; commit that file (never the plaintext PDF — the repo is public). If you change the key, update the `RESUME_KEY` secret in Cloudflare too.

## Env / secrets (names only)
- Worker secrets: `RESUME_KEY`, `RESUME_PIN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Code also accepts Vercel-integration fallbacks `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` (not used on Cloudflare).
- Local dev: copy `.env.example` to `.env.local`. For `wrangler dev`, use `.dev.vars` (git-ignored).

## Commands
- `npm run dev` — Vite dev server; `vite.config.js` mounts `api/downloads.js` at `/api/downloads` (the résumé endpoint is not mounted in Vite dev).
- `npm run build` — production build to `dist/`; `npm run preview` — preview it.
- `npm run lint` — ESLint.
- `npx wrangler dev` — run the Worker + assets locally (build first).
- No test suite and no TypeScript.

## Gotchas
- Never expose Upstash or résumé secrets with a `VITE_` prefix — Vite inlines those into the public bundle.
- The handlers must stay compatible with the adapter: only `setHeader`, `status`, `json`, `send` and JSON bodies are supported.
- `dist/` is git-ignored build output.
