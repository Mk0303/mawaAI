# Mawa AI (milestone 2, pre-prod on this box)

Personal ChatGPT-style PWA for Mani and friends: free-tier model router, Savage Mode persona, ChatGPT/Gemini history import.
Plain folder by design: no git, no remote. Backups live in `/workspace/mawa-ai-backups/`.

## Run
```bash
npm install            # lockfile pinned
npm run dev            # http://localhost:3210 (dev login enabled via DEV_LOGIN=true)
npm test               # unit tests (router, persona, parser, store, rate limiter, env)
scripts/smoke.sh       # end-to-end curl checks against a running server (dev or prod)
node --conditions=react-server --import tsx scripts/provider-smoke.mts   # 1 tiny real call per provider
npm run build && scripts/mawa-prod.sh start
# production on :3210, supervised (restarts on crash). Logs: /workspace/mawa-ai-logs/prod.log
# Needs AUTH_SECRET. Google OAuth + ALLOWED_EMAILS are required only once those keys are set.
# Until then the server starts locked: dev login is off and nobody can sign in.
# Set AUTH_URL=https://… and AUTH_TRUST_HOST=true before going public behind a tunnel.
```
Provider keys are read from the process environment or `.env.local` (see `.env.example`). With no keys, a mock provider answers so the UI is demoable. `scripts/mawa-prod.sh stop|status` controls the supervised process. No public tunnel is started by these scripts.

## Layout
- `src/lib/router/` classifier (rules + optional tiny LLM), registry (models, chains), providers catalogue, quota tracker, context fitting, router (score, stream, fallback with partial prefix)
- `src/lib/providers/` one OpenAI-compatible adapter for every chat provider, plus the mock
- `src/lib/persona.ts` Savage Mode: vibe levels, mawa toggle, care override, protected traits
- `src/lib/import/` ChatGPT + Google Takeout (Gemini Apps) parsers, in-memory zip reader with zip-bomb/traversal guards
- `src/lib/db/` `Store`/`ImportStore` interfaces + SQLite impl; `src/lib/memory.ts` memory interface (FTS5 now, pgvector later)
- `src/lib/http.ts` API wrapper: auth on every route, Origin check on writes, rate limits, body caps, safe errors

## Adding a provider
1. Add an entry to `PROVIDERS` in `src/lib/router/providers.ts` (base URL, key env name).
2. Add its models in `src/lib/router/registry.ts` (`M(...)` line) and put their ids into `ROUTE_TABLE` chains.
3. Add the key to `.env.example`.

## Tools (M2)
- **Images:** Cloudflare `flux-1-schnell` first, Pollinations fallback (`src/lib/tools/image-gen.ts`). Stored per user under `data/media/<user>/`, served by `/api/media/<id>` (owner-only, nosniff, sandbox CSP).
- **Web search:** Tavily (`src/lib/tools/search.ts`), 1-hour cache, results become numbered context + source chips.
- **Voice:** in-browser MediaRecorder (audio/mp4 on iPhone Safari, webm elsewhere) → `/api/transcribe` → Cloudflare whisper-large-v3-turbo, Groq whisper as backup. ffmpeg converts to 16 kHz wav for Cloudflare.
- **Photos/PDFs:** `/api/upload` sniffs magic bytes (JPG/PNG/WebP/GIF ≤ 8 MB, PDF ≤ 20 MB). Photos go to a vision model (Gemini first); PDFs are text-extracted with page markers, chunked into memory, and sent whole when they fit (≤150K tokens) or as retrieved excerpts.
- **Daily soft limits** per user (IST day): `SOFT_LIMIT_CHAT|IMAGE|SEARCH|VOICE|UPLOAD`.
- `OPENAI_API_KEY` is never read: it is deleted from `process.env` in `next.config.ts` and `src/instrumentation.ts`, and a test fails if app code references it.

## Themes
Seven themes: Savage Dark, Nature, Dogs, Horses, Cosmic, Mountains, Mani Mode. Picker in **Settings** (live preview, saved per user, circular View Transition, respects `prefers-reduced-motion`).

The theme contract has four layers:
1. **Tokens:** `src/app/globals.css` sets `--t-*` variables per `[data-theme]`; every Tailwind colour the UI uses maps to them.
2. **Shape classes:** `.t-bubble-bot`, `.t-bubble-user`, `.t-chip`, `.t-card`, `.t-input`, `.t-btn`, `.t-mood-*`.
3. **Behaviour:** `src/lib/themes/contract.ts` holds copy, motion (press, bubble entry, drawer, swipe, roast/flex) and haptic patterns.
4. **Renderers:** `src/components/theme/parts.tsx`, `Backgrounds.tsx` and `Avatar.tsx` export `Record<ThemeId, …>` maps (send glyph, typing indicator, toggle, slider, progress, mood effects, modal, background, avatar).

To add a theme: add the id to `src/lib/themes/ids.ts`, then fix every compile error. Each error is a component still missing its variant. Also add a token block (a test checks every token exists).

## Send games
Flick, pull, spin or hold the Send button for a tiny game (cricket, basketball, penalty, slingshot, dial, charge, bowling, darts, fishing, paper plane, rocket, ball fetch), reskinned per theme. Modes in Settings: Surprise me (default; weighted to the theme, never repeats the last 3), Favorites, One game, Off. Enter and quick taps always send at once; misses still send. Logic is in `src/lib/sendgames/games.ts` (tested); the animation is in `src/components/sendgames/`.

## Scripts
- `npm test`: unit tests.
- `bash scripts/smoke.sh http://localhost:3211`: API smoke checks (run against a dev server with no provider keys).
- `node --conditions=react-server --import tsx scripts/provider-smoke.mts <model ids>`: one tiny real call per chat model.
- `node --conditions=react-server --import tsx scripts/tool-smoke.mts tests/fixtures/audio/hello.m4a`: image (both providers), search, both whispers.
