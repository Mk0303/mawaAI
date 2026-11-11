# Changelog

## Calm theme + Enter send fix · 2026-11-11 (IST)

### Added
- **Calm theme** (`id: calm`), the 8th theme: a simple, relaxing look with no glow or drama. Soft grey-blue dark (`#14171c` ink, `#1a1e25` panels), sage (`#8aa39a`) and sand (`#c4b8a5`) accents, muted roast/care colours, almost no glow, no drop shadows, modest radii, quiet sans typography, and slow haze in the background. Every component has a Calm variant (bubbles, composer, buttons, chips, sliders, toggles, import progress, typography, typing dots, a simple arrow send glyph, a pebble avatar, and geometric send-game skins instead of emoji). Personality is unchanged.

### Fixed
- Pressing Enter in the composer now plays the send game, the same path as tapping Send. Enter used to call `send()` directly and skip the button's `onFire` gesture. It now clicks the Send button when it is present and enabled, and falls back to `send()` otherwise.

### Tests
- 47 unit tests still pass, including token coverage and settings validation for all 8 theme ids. Reduced-motion still disables the new `.anim-haze` class.


## M3 pre-prod · 2026-11-11 (IST)

### Added
- Production run on this box: `scripts/mawa-prod.sh start|stop|status`. A bash supervisor (`scripts/supervise-prod.sh`) restarts `next start` if the process crashes (verified). The server binds to `127.0.0.1:3210` only. No public tunnel is started yet. 47 unit tests; 22 production smoke checks.
- `AUTH_URL` and `AUTH_TRUST_HOST` are read so Auth.js works behind a future HTTPS tunnel. CSRF origin checks prefer `AUTH_URL`'s host over a client-supplied `X-Forwarded-Host`.
- Rate limits now persist in SQLite (`rate_limits` table) on the single-server box, behind the same `RateLimiter` interface so Upstash can still swap in later. Memory remains the default under `node:test`.

### Changed
- Production can start locked (no Google keys yet): dev login stays forced off, so nobody can sign in until Google OAuth and `ALLOWED_EMAILS` are set. If Google keys are present, the allowlist is still required. `AUTH_URL`, when set in production, must be `https`.

### Security
- Unauthenticated API routes still return 401; signed-out pages redirect to `/login`. The smoke script has a production path that checks this and that the dev-login callback cannot set a session.

## M2 · 2026-11-11 (IST)


### Added
- **Image generation:** Cloudflare flux-1-schnell, Pollinations fallback. The image card in chat has a Save button, and Savage writes a short roast caption. Images are stored per user.
- **Web search:** Tavily, with numbered context and clickable source chips (http/https only).
- **Voice input:** a mic button with in-browser recording (iPhone Safari records audio/mp4). Cloudflare whisper transcribes, with Groq whisper as backup, and the text drops into the composer.
- **Photo and PDF upload:** an attach button. Types are checked by magic bytes. Photos go to vision models. PDFs are text-extracted with page markers and chunked into memory. Long documents get full-context Gemini, or retrieved excerpts when they are huge.
- **Router:** OpenRouter (Nemotron, Gemma, North), Cloudflare Llama 3.3 70B, SambaNova gpt-oss-120b / Llama 70B, Cohere Command A+ (also vision) / R7B and Z.AI GLM-4.7-Flash are added as fallbacks. Model ids were checked against each provider's model list on 11 Nov 2026. A vision filter keeps images on vision models. A fixed-context fit check stops docs and search context from going to small models. A 402 (billing required) parks that model for an hour.
- **Per-user daily soft limits** for chat, image, search, voice and upload, counted on the IST day, with friendly messages.
- **CSP with nonces:** `src/proxy.ts` sets a per-request nonce with `strict-dynamic`, so no inline scripts are allowed. API and media responses get `default-src 'none'; sandbox`.
- **Themes (7):** Savage Dark, Nature, Dogs, Horses, Cosmic, Mountains and Mani Mode, each with its own avatar, ambient background, copy, motion, haptics and component variants:
  - send button
  - composer
  - typing indicator
  - bubbles and mood effects
  - chips
  - toggle (bone, leaf, horseshoe, moon, peak, chess pawn)
  - slider (vine, tennis ball, galloping horseshoe, climbing path, cricket pitch)
  - import progress runner
  - drawer animation
  - empty and error states
  - modal
  - scrollbars
- **Theme picker** in Settings with live-preview cards and a component playground. The choice is saved per user and rendered on the server, so there is no flash. The switch uses a circular View Transition.
- **Mani Mode** follows `free-ai-ui/themes/07-mani-spec.md`:
  - twilight sky that reacts to heat level
  - gold constellations (bat, knight, horse, motorcycle, surfboard, paraglider)
  - "Kite", an original helmeted robot-cat in a star ring (no bell, no pocket)
  - MK badge
  - `>_` terminal composer
  - paraglider send button with gold trail
  - constellation-dot bubble corners
- **Send games:** 12 mini-games (cricket, basketball, penalty, slingshot, dial, charge, bowling, darts, fishing, paper plane, rocket, fetch), reskinned per theme.
  - Gestures: flick, pull, spin or hold.
  - Surprise / Favorites / One game / Off.
  - A first-time hint for each game.
  - A streak line at 3 or more ("5 sixes in a row").
  - Enter and taps always send at once.
- **Tests:** 39 unit tests, up from 21. They cover theme tokens, the reduced-motion audit, media IDOR, PDF parsing, soft limits, the vision route, the OPENAI_API_KEY guard, the 402 cooldown, and send-game picking, judging and streaks. The smoke script has 55 checks, up from 41.

### Security
- Uploads: magic-byte sniffing, size caps, owner-scoped ids, path-prefix checks, mode-600 files. Media is served with nosniff, a sandbox CSP and private cache, and PDFs always download.
- Tool calls: https only, `redirect: "error"`, timeouts and response byte caps. ffmpeg runs with array args and a timeout.
- `OPENAI_API_KEY` is deleted at startup and guarded by a test.

### Known gaps / next
- SambaNova returns 402 PAYMENT_METHOD_REQUIRED for chat (its /models works). The router parks it automatically. It needs a card on the SambaNova account, or leave it as a dead fallback.
- Z.AI GLM-4.7-Flash answered one direct call (`pong`), but the free tier is rate-limited and overloaded most of the time (429 codes 1302/1305). It is handled by cooldowns. GLM-5.x models need a paid balance.
- Video generation is still a text answer.
- Soft limits and rate limits live in SQLite and memory on a single node. Move them to Redis when deploying.
- Send games have no sound by design. The spec's bat "knock" is a haptic instead.

## M1 · 2026-11-11 (IST)

### Added
- Next.js 16.4 (App Router, TypeScript, Turbopack) PWA: manifest, 192/512/maskable/apple-touch icons, service worker (shell + offline page, never caches /api), iOS standalone meta.
- Tailwind 4 dark theme + Framer Motion animations matching the concept screens.
- Auth.js v5: Google sign-in with verified-email allowlist (`ALLOWED_EMAILS`); labelled local **dev login** that is impossible in production (forced off when NODE_ENV=production). JWT sessions, 7-day expiry, sign-in rate limit.
- Router: rule-based intent classifier (+ optional tiny-model JSON classifier, validated), 15 free models across Groq, Gemini/Gemma, OpenRouter, Cloudflare, SambaNova, Cohere, Z.AI; quota-aware scoring (quality, RPD headroom, fit, error rate, latency); 429 cool-downs from retry-after; silent fallback that carries already-streamed text forward; "busy" message instead of "limit reached"; oldest-first trimming + rolling summary for long chats.
- Persona layer after routing: Chill / Sarcastic / Full Roast, "roast harder" / "be nice" one-off steering, mawa (Telugu-English) toggle, always-on care override for grief/health/money/self-harm with India help lines, protected traits never roasted.
- Chat UI: home with category chips, animated mood avatar (idle, thinking, chill, smug, roast, flex, care), streaming bubbles, roast shake + heat lines, gold flex shimmer, model badge chip, swipe or buttons to steer, drawer sidebar, personality screen, "Your data" screen.
- History import: one-button wizard (pick source, 4-step guide, pick zip as-is, Savage progress, summary). Server auto-detects ChatGPT `conversations.json` or Takeout `My Activity/Gemini Apps/MyActivity.(html|json)`, from the zip or the inner file. Imported chats show in the sidebar (marked, read-only), are chunked into memory (SQLite FTS5, embedding column reserved), and feed an "about you" profile into context. Delete one import or everything.
- Persistence: SQLite (better-sqlite3) behind `Store` / `ImportStore` / `MemoryStore` interfaces; every query scoped by user id.
- Security: CSP and security headers, no x-powered-by, Origin check on all writes, zod strict validation, per-user rate limits, body caps, generic errors with request ids, redacting structured logs, fail-closed production config check.
- Tests: 21 unit tests, 41-check curl smoke script, sample export fixtures (ChatGPT zip/json, Gemini Takeout zip/html/json, traversal zip, zip bomb, unrelated zip/json).

### Known gaps / next
- Image, video, web search, voice input and file/PDF upload are routed but not generated yet (M2).
- Rate limits and quotas are in-memory (single process); move to Upstash Redis for deploy.
- CSP still allows inline scripts (Next bootstrap); switch to nonce-based CSP.
- Memory search is keyword (FTS5); swap to pgvector embeddings with Supabase.
- Gemini Takeout is grouped by day (Takeout has no thread ids).

## Theme picker returns to chat (2026-11-11)
- Picking a theme now plays the switch ripple, then goes back to the chat automatically.

## Calm replies in all themes (2026-11-11)
- No flashing while a reply streams: mood styling applies only after it finishes, the caret no longer blinks, updates paint once per frame, and scrolling follows instantly.
- Every theme: replies fade in gently; no shake, bounce, particle bursts, shimmer or glow.

## Message box grows with long text (2026-11-11)
- The input grows up to about 8 lines, then scrolls inside, so long messages are never cut off.
