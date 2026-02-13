# DHENU 2.0 Integration Notes

This project uses **Dhenu 2.0** as the primary agriculture model. The Next.js API route at `src/app/api/chat/route.ts` coordinates Dhenu with Gemini via the `AI_MODE` flag:

1. **Configuration**
   - `DHENU_API_KEY` (required) and `DHENU_BASE_URL` live in `.env.local`.
   - `AI_MODE` may be `dhenu_only`, `hybrid_lite`, or `hybrid_full`. The default `hybrid_lite` lets Dhenu answer first and calls Gemini only on weak or failed answers.
   - The location string (if available) and language selection (`auto`, `Hindi`, `Marathi`, `Tamil`, `Telugu`, or `English`) are injected into the prompt.

2. **Prompting Flow**
   - `buildDhenuPrompt` adds rules about concise action plans, pesticide caution, immediate next steps, and farmer-friendly language.
   - On successful Dhenu replies, `looksWeakAnswer` checks length and for phrases like “unable to answer”, “sorry”, or “error”.
   - If the answer looks weak or Dhenu throws, the route falls back to `buildGeminiRefinePrompt`, which wraps Dhenu’s draft plus the original question for Gemini to rewrite/clarify.

3. **Error Handling**
   - Dhenu errors (timeouts, API response failure, empty text) bubble up as 500 responses, which the frontend surfaces to the user.
   - Gemini is only called when Dhenu fails or `hybrid_full` is active, keeping Gemini usage low.

4. **Operational Notes**
   - Keep Dhenu timeouts (default 18 s) and fallback logic in place so a temporary Dhenu outage still delivers an answer via Gemini.
   - When testing locally, set `AI_MODE=dhenu_only` to verify Dhenu’s standalone behavior, or `AI_MODE=hybrid_full` for the legacy multi-call flow.

5. **Gemini Fallbacks**
   - The backend reads `GEMINI_MODEL_FALLBACK` for alternative models (comma-separated) and tries them when the primary model returns 503/429 (high demand or rate limit).  
   - This fallback loop keeps the UI responsive; if all configured Gemini models fail, the hybrid pipeline falls back to Dhenu-only guidance plus a concise Gemini-style rewrite attempt before surfacing an error.

See `src/app/api/chat/route.ts#L32` for the prompt builders and `src/app/api/chat/route.ts#L89` for the `callDhenu` helper for more detail.
