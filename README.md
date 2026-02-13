# Kisan Sahayak Next (Parallel Build)

Fresh Next.js build kept separate from the Flask app.

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

- `AI_MODE`: `dhenu_only`, `hybrid_lite`, or `hybrid_full`
- `DHENU_API_KEY`
- `DHENU_BASE_URL` (optional override)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (defaults to `gemini-2.5-flash-lite`; run `ListModels` if you need a different model)
- `GEMINI_MODEL_FALLBACK` (comma-separated list of older/sibling models that the service will try when the primary model is unavailable)
- `NEXT_PUBLIC_GUEST_QUERY_LIMIT`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Features in this build

- Dhenu-first pipeline with Gemini fallback/refinement modes
- Gemini fallback list tries alternate models when the primary experiences high demand
- Multilingual response targeting (Auto, English, Hindi, Marathi, Tamil, Telugu)
- Browser geolocation + reverse geocode location context
- Voice input (Web Speech API)
- Voice reply (Speech Synthesis API)
- Guest query limit
- Dhenu 2.0 integration reference (`docs/DHENU_INTEGRATION.md`)

## Deploy on Vercel

- Import this folder as a separate project.
- Add all env vars from `.env.local` to Vercel project settings.
- Deploy.
