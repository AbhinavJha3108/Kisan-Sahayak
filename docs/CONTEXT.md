# Project Context Snapshot

This document captures the feature scope and architectural decisions implemented in the parallel `kisan-sahayak-next` build so far.

## Current Workstreams

- **Parallel Layout**
  - Keep the original Flask project isolated under `ks flask/` while the new Next.js + API build lives under `kisan-sahayak-next/`.
  - The Next project is standalone with its own `package.json`, `tsconfig`, Tailwind setup, and `.env.local`.

- **AI Orchestration**
  - Dhenu 2.0 is the primary model. Config lives in `.env.local` (`DHENU_API_KEY`, `DHENU_BASE_URL`, `AI_MODE`).
  - Gemini operates as a fallback. The backend tries `gemini-2.5-flash-lite` by default and loops through any models listed in `GEMINI_MODEL_FALLBACK` whenever 503/429 errors occur, then surfaces the used model in API responses.
  - Hybrids: `AI_MODE=hybrid_lite` (default) only calls Gemini when Dhenu output looks weak; `hybrid_full` rewrites/pre-polishes using Gemini twice; `dhenu_only` forces Dhenu without Gemini.

- **Frontend UX**
  - Multilingual chat UI (Auto, English, Hindi, Marathi, Tamil, Telugu) with voice input (Web Speech API) + voice reply (Speech Synthesis).
  - Location context via Browser Geolocation + `/api/reverse-geocode`.
  - Guest query limit tracking stored in `localStorage` and displayed near controls.
  - Voice controls: start/stop microphone, toggle voice replies, show guest usage.

- **Infrastructure & Docs**
  - `/api/chat/route.ts` now contains prompt builders, fallback logic, and metadata response (e.g., `modeUsed`, `provider`, `geminiModel`).
  - `/api/reverse-geocode` proxies OpenStreetMap for readability.
  - `.env.example`, `.env.local`, `README.md`, `docs/DHENU_INTEGRATION.md`, and this file document required keys, fallback behavior, and fallback contexts.
  - Added `/docs/DHENU_INTEGRATION.md` describing Dhenu prompts and Gemini fallback handling.

## Next Milestones

1. Stabilize local run (npm install + npm run dev) and verify all voice/location flows with actual DHENU/Gemini keys.
2. Add Supabase/Firebase auth or guest-to-signed-in upgrade path (next phase).
3. Finish evaluation/testing assets and finalize deployment instructions for Render/Vercel.

