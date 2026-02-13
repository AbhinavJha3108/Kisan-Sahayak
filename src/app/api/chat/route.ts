import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/authServer";
import { validateMessage, detectSuspiciousPatterns } from "@/lib/security";
import {
  createConversation,
  getLastAssistantMessage,
  getLastUserMessage,
  saveMessage
} from "@/lib/conversations";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api";
import { ChatRequestSchema } from "@/lib/schemas";

type ChatMode = "dhenu_only" | "hybrid_lite" | "hybrid_full";
type LanguageMode = "auto" | "english" | "hindi" | "marathi" | "tamil" | "telugu" | "punjabi";

const baseGeminiModel = (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").trim();
const fallbackList = (process.env.GEMINI_MODEL_FALLBACK || "").split(",").map((m) => m.trim());
const GEMINI_MODELS = Array.from(
  new Set<string>(
    [
      baseGeminiModel,
      ...fallbackList,
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ].filter(Boolean)
  )
) as string[];
const DHENU_BASE_URL = process.env.DHENU_BASE_URL || "https://api.dhenu.ai/v2/query";
const AI_MODE = (process.env.AI_MODE || "hybrid_lite").trim().toLowerCase() as ChatMode;

function normalizeMode(mode: string): ChatMode {
  if (mode === "dhenu_only" || mode === "hybrid_lite" || mode === "hybrid_full") return mode;
  return "hybrid_lite";
}

function languageInstruction(language: LanguageMode): string {
  switch (language) {
    case "hindi":
      return "Reply in Hindi.";
    case "marathi":
      return "Reply in Marathi.";
    case "tamil":
      return "Reply in Tamil.";
    case "telugu":
      return "Reply in Telugu.";
    case "punjabi":
      return "Reply in Punjabi.";
    case "english":
      return "Reply in English.";
    default:
      return "Reply in the same language as the user question.";
  }
}

function detectLanguageFromText(text: string): LanguageMode {
  const t = (text || "").trim();
  if (!t) return "english";

  const marathiMarkers = ["आहे", "काय", "मी", "तुम्ही", "कसे", "शेती", "पीक", "माहिती", "कृपया", "होते"];
  const hindiMarkers = ["है", "कैसे", "कृपया", "मौसम", "खेती", "फसल", "बारिश", "गर्मी", "क्यों", "क्या"];

  let devanagari = 0;
  let tamil = 0;
  let telugu = 0;
  let gurmukhi = 0;
  let letters = 0;

  for (const ch of t) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0900 && code <= 0x097f) devanagari += 1;
    else if (code >= 0x0b80 && code <= 0x0bff) tamil += 1;
    else if (code >= 0x0c00 && code <= 0x0c7f) telugu += 1;
    else if (code >= 0x0a00 && code <= 0x0a7f) gurmukhi += 1;
    const isLatin = (code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a);
    const isIndic =
      (code >= 0x0900 && code <= 0x0d7f) || // Devanagari + Tamil + Telugu ranges
      (code >= 0x0a00 && code <= 0x0a7f); // Gurmukhi
    if (isLatin || isIndic) letters += 1;
  }

  if (letters === 0) return "english";

  const devRatio = devanagari / letters;
  const taRatio = tamil / letters;
  const teRatio = telugu / letters;
  const paRatio = gurmukhi / letters;

  const maxRatio = Math.max(devRatio, taRatio, teRatio, paRatio);
  if (maxRatio < 0.3) return "english";
  if (paRatio === maxRatio) return "punjabi";
  if (taRatio === maxRatio) return "tamil";
  if (teRatio === maxRatio) return "telugu";
  const lower = t.toLowerCase();
  if (marathiMarkers.some((m) => lower.includes(m))) return "marathi";
  if (hindiMarkers.some((m) => lower.includes(m))) return "hindi";
  return "hindi";
}

function estimateComplexity(text: string): "low" | "medium" | "high" {
  const cleaned = (text || "").trim();
  if (!cleaned) return "low";

  const length = cleaned.length;
  const questionMarks = (cleaned.match(/\?/g) || []).length;
  const commas = (cleaned.match(/[,;]/g) || []).length;
  const conjunctions = (cleaned.match(/\b(and|or|but|then|because|so|also)\b/gi) || []).length;
  const topicHints = (cleaned.match(/\b(weather|rain|soil|fertilizer|pest|disease|irrigation|yield|variety|spray|dose|market)\b/gi) || []).length;

  let score = 0;
  if (length > 240) score += 3;
  else if (length > 160) score += 2;
  else if (length > 90) score += 1;

  if (questionMarks >= 2) score += 2;
  else if (questionMarks === 1) score += 1;

  if (commas >= 3) score += 1;
  if (conjunctions >= 2) score += 1;
  if (topicHints >= 2) score += 1;

  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function wantsDetail(text: string): boolean {
  const t = (text || "").toLowerCase();
  return [
    "elaborate",
    "in detail",
    "detailed",
    "step by step",
    "explain",
    "विस्तार",
    "विस्तृत",
    "समझाएं",
    "डिटेल"
  ].some((phrase) => t.includes(phrase));
}

function isElaborationOnly(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  return [
    "elaborate",
    "expand",
    "more detail",
    "detail",
    "in detail",
    "विस्तार",
    "विस्तृत",
    "समझाएं",
    "और बताएं",
    "और बताइए"
  ].includes(t);
}

function isElaborationHint(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t) return false;
  if (t.length > 60) return false;
  return wantsDetail(t);
}

function isFollowUpQuestion(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t || t.length > 80) return false;
  return [
    "what should i do",
    "what do i do",
    "next step",
    "next steps",
    "how do i fix",
    "how to fix",
    "what can i do",
    "what now",
    "what should i do next",
    "how do i proceed",
    "solution",
    "treatment",
    "fix this",
    "what about it",
    "क्या करूं",
    "अब क्या करूं",
    "क्या करना चाहिए",
    "अगला कदम",
    "मैं क्या करूं",
    "उपाय क्या है"
  ].some((phrase) => t.includes(phrase));
}

function looksLikeNewTopic(text: string): boolean {
  const t = (text || "").toLowerCase();
  const topicHints = [
    "wheat",
    "rice",
    "cotton",
    "soy",
    "soybean",
    "mustard",
    "maize",
    "sugarcane",
    "tomato",
    "potato",
    "pest",
    "disease",
    "fungus",
    "insect",
    "fertilizer",
    "nutrient",
    "irrigation",
    "water",
    "soil",
    "rain",
    "weather",
    "फसल",
    "कीट",
    "रोग",
    "खाद",
    "सिंचाई",
    "मिट्टी",
    "बारिश",
    "मौसम",
    "पीक",
    "किड",
    "કૃષિ"
  ];
  return topicHints.some((hint) => t.includes(hint));
}

function buildDhenuPrompt(
  userMessage: string,
  language: LanguageMode,
  location?: string,
  detailRequested = false
): string {
  const locationLine = location ? `Location: ${location}.` : "Location not available.";
  const complexity = estimateComplexity(userMessage);
  const detailLine =
    detailRequested || wantsDetail(userMessage)
      ? "Provide detailed guidance in 5-7 bullet points. Each bullet should be 2-3 sentences."
      : complexity === "high"
        ? "Provide detailed guidance in 5-7 bullet points. Each bullet should be 2-3 sentences (140-220 words total)."
        : complexity === "medium"
          ? "Provide helpful detail in 4-6 bullet points. Each bullet should be 2-3 sentences (100-160 words total)."
          : "Provide clear guidance in 3-5 bullet points. Each bullet should be 2-3 sentences (80-120 words total).";
  return `You are Kisaan Sahayak, an agricultural advisor for Indian farmers.

Write in a friendly, practical tone.
Use 3-7 short bullet points depending on question complexity. Each bullet is a short paragraph (2-3 sentences).
Use plain text bullets like \"- \".
Avoid unsafe fixed pesticide dosage claims; advise label-based use and local agri officer confirmation.
${languageInstruction(language)}
${locationLine}
${detailLine}

Question: ${userMessage}`;
}

function buildGeminiRefinePrompt(
  userMessage: string,
  dhenuAnswer: string,
  language: LanguageMode,
  location?: string,
  detailRequested = false
): string {
  const locationLine = location ? `Location: ${location}.` : "Location not available.";
  const complexity = estimateComplexity(userMessage);
  const detailLine =
    detailRequested || wantsDetail(userMessage)
      ? "Expand the draft. Use 5-7 short bullet points with 2-3 sentences each."
      : complexity === "high"
        ? "Provide detailed guidance (140-220 words). Use 5-7 short bullet points with 2-3 sentences each."
        : complexity === "medium"
          ? "Provide helpful detail (100-160 words). Use 4-6 short bullet points with 2-3 sentences each."
          : "Provide clear guidance (80-120 words). Use 3-5 short bullet points with 2-3 sentences each.";
  return `Please refine the draft answer for clarity and usefulness.

${detailLine}
Use plain text bullets like \"- \". Each bullet should be 2-3 sentences.
Do not add an intro sentence before the bullets.
Keep agricultural accuracy. Avoid uncertain pesticide dosage claims.
${languageInstruction(language)}
${locationLine}

Question:
${userMessage}

Draft:
${dhenuAnswer}`;
}

function buildGeminiRouterPrompt(
  userMessage: string,
  language: LanguageMode,
  location?: string
): string {
  const locationLine = location ? `Location: ${location}.` : "Location not available.";
  return `You are deciding whether to consult an agriculture specialist model (Dhenu).

Return ONLY strict JSON with these keys:
- "dhenu_needed": boolean
- "dhenu_question": string (empty string if not needed)

Rules:
- Dhenu is only for agriculture domain knowledge.
- If the question is mixed, extract only the agriculture part for Dhenu.
- If not needed, set "dhenu_question" to "".
- Write "dhenu_question" in the same language as the user.
- Do not add any extra keys or commentary.

${languageInstruction(language)}
${locationLine}

User question:
${userMessage}`;
}

function extractRouterResult(reply: string): { dhenu_needed: boolean; dhenu_question: string } {
  const fallback = { dhenu_needed: false, dhenu_question: "" };
  if (!reply || typeof reply !== "string") return fallback;

  const direct = reply.trim();
  const jsonMatch = direct.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : direct;

  try {
    const parsed = JSON.parse(candidate);
    const dhenu_needed = Boolean(parsed?.dhenu_needed);
    const dhenu_question =
      typeof parsed?.dhenu_question === "string" ? parsed.dhenu_question.trim() : "";
    return { dhenu_needed, dhenu_question };
  } catch {
    return fallback;
  }
}

function buildGeminiSynthesisPrompt(
  userMessage: string,
  dhenuAnswer: string,
  language: LanguageMode,
  location?: string,
  detailRequested = false
): string {
  const locationLine = location ? `Location: ${location}.` : "Location not available.";
  const complexity = estimateComplexity(userMessage);
  const detailLine =
    detailRequested || wantsDetail(userMessage)
      ? "Provide detailed guidance using 5-7 bullet points with 2-3 sentences each."
      : complexity === "high"
        ? "Provide detailed guidance (140-220 words) using 5-7 bullet points with 2-3 sentences each."
        : complexity === "medium"
          ? "Provide helpful detail (100-160 words) using 4-6 bullet points with 2-3 sentences each."
          : "Provide clear guidance (80-120 words) using 3-5 bullet points with 2-3 sentences each.";
  const dhenuBlock = dhenuAnswer
    ? `Dhenu (agriculture specialist) answer:\n${dhenuAnswer}\n\nUse Dhenu as the authoritative source for agricultural facts.`
    : "No Dhenu answer available. Use general best practices and avoid unsafe pesticide dosage claims.";
  return `You are Kisaan Sahayak, an agricultural advisor for Indian farmers.

${detailLine}
Use plain text bullets like "- ".
Do not add an intro sentence before the bullets.
Keep agricultural accuracy. Avoid uncertain pesticide dosage claims.
${languageInstruction(language)}
${locationLine}

Question:
${userMessage}

${dhenuBlock}`;
}

function looksWeakAnswer(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length < 60) return true;

  const weakPhrases = [
    "unable to answer",
    "cannot answer",
    "i don't know",
    "i do not know",
    "not enough information",
    "sorry",
    "error",
    "failed"
  ];

  return weakPhrases.some((p) => t.includes(p));
}

function preprocessUserMessage(text: string): string {
  const cleaned = (text || "")
    .replace(/[\\u200B-\\u200D\\uFEFF]/g, "")
    .replace(/\\s+/g, " ")
    .trim();
  if (!cleaned) return cleaned;
  return cleaned;
}

async function callDhenu(message: string, timeoutMs = 18000): Promise<string> {
  const key = process.env.DHENU_API_KEY;
  if (!key) throw new Error("Server missing DHENU_API_KEY");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(DHENU_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ query: message }),
      signal: controller.signal
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Dhenu API error: ${bodyText}`);
    }

    const data = await response.json();
    const text =
      data?.answer ||
      data?.response ||
      data?.result ||
      data?.data?.answer ||
      data?.data?.response ||
      "";

    if (!text || typeof text !== "string") {
      throw new Error("Dhenu returned empty response");
    }

    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

interface GeminiRequestError extends Error {
  status?: number;
  isRetryable?: boolean;
  model?: string;
}

async function callGeminiWithModel(
  prompt: string,
  model: string,
  timeoutMs = 18000,
  maxOutputTokens = 220
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Server missing GEMINI_API_KEY");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const isRetryable = response.status === 503 || response.status === 429;
      const detail =
        response.status === 404
          ? "Gemini model not available for this API version – run `ListModels` or adjust `GEMINI_MODEL`."
          : bodyText || response.statusText;
      const err = new Error(`Gemini API error (${response.status}): ${detail}`) as GeminiRequestError;
      err.status = response.status;
      err.isRetryable = isRetryable;
      err.model = model;
      throw err;
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .filter(Boolean)
      .join("\n");

    if (!reply) throw new Error("Gemini returned empty response");
    return reply.trim();
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiWithFallback(
  prompt: string,
  opts?: { maxOutputTokens?: number }
): Promise<{ reply: string; model: string }> {
  let lastError: GeminiRequestError | null = null;
  const maxOutputTokens = opts?.maxOutputTokens ?? 400;

  for (const model of GEMINI_MODELS) {
    try {
      const reply = await callGeminiWithModel(prompt, model, 18000, maxOutputTokens);
      return { reply, model };
    } catch (error) {
      if (!(error instanceof Error)) {
        lastError = new Error("Unknown Gemini error") as GeminiRequestError;
        lastError.model = model;
        lastError.isRetryable = false;
      } else {
        lastError = error as GeminiRequestError;
        lastError.model = (lastError.model || model).trim();
      }
      if (!lastError.isRetryable) {
        throw lastError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Gemini fallback failed without an error");
}

function normalizeReply(text: string): string {
  const cleaned = (text || "").replace(/\*\*/g, "").replace(/\s+\n/g, "\n").trim();
  const bulletFixed = cleaned.replace(/(^|[^\n])\s-\s+/g, (_m, p1) => `${p1}\n- `);
  if (bulletFixed.includes("\n\n")) return bulletFixed;

  const sentences = bulletFixed.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 2) return bulletFixed;

  const first = sentences.slice(0, 2).join(" ");
  const rest = sentences.slice(2).join(" ");
  return `${first}\n\n${rest}`.trim();
}

function looksUnderdetailed(text: string): boolean {
  const cleaned = (text || "").trim();
  if (cleaned.length < 220) return true;
  const bulletCount = cleaned.split("\n").filter((line) => line.trim().startsWith("- ")).length;
  return bulletCount < 3;
}

function buildElaborationPrompt(
  userMessage: string,
  previousAnswer: string,
  language: LanguageMode,
  location?: string
): string {
  const locationLine = location ? `Location: ${location}.` : "Location not available.";
  return `You are expanding a previous answer into more detail.

Write ONLY bullets (no intro sentence).
Use 3-5 bullets. Each bullet must be 3-4 sentences.
Use plain text bullets like "- ".
Keep agricultural accuracy. Avoid uncertain pesticide dosage claims.
${languageInstruction(language)}
${locationLine}

Question:
${userMessage}

Previous answer:
${previousAnswer}`;
}

export const POST = withErrorHandling(async (req: NextRequest) => {
    const user = await verifyRequestUser(req);
    const guestLimit = Number(process.env.NEXT_PUBLIC_GUEST_QUERY_LIMIT || "5");
    const isGuest = !user;
    const guestCount = isGuest ? Number(req.cookies.get("guest_count")?.value || "0") : 0;
    if (isGuest && guestCount >= guestLimit) {
      throw new ApiError(`Guest limit reached (${guestLimit}). Please sign in to continue.`, 403, {
        guest_limit: guestLimit
      });
    }
    const data = ChatRequestSchema.parse(await parseJson(req));
    const { message, language = "auto", location = "", conversation_id, elaborate, previous_answer } = data;
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const normalizedMessage = preprocessUserMessage(message);
    if (!normalizedMessage) {
      throw new ApiError("Empty message", 400);
    }

    const messageValidation = validateMessage(normalizedMessage);
    if (!messageValidation.valid) {
      throw new ApiError("Invalid message", 400, messageValidation.errors);
    }
    const suspicious = detectSuspiciousPatterns(normalizedMessage);
    if (suspicious.length) {
      throw new ApiError("Message contains suspicious patterns", 400);
    }

    const requestedLanguage = (typeof language === "string" ? language : "auto") as LanguageMode;
    let effectiveMessage = normalizedMessage;
    const isElaborationRequest =
      Boolean(elaborate) || isElaborationOnly(normalizedMessage) || isElaborationHint(normalizedMessage);
    const isFollowUp = isFollowUpQuestion(normalizedMessage);
    const isLooseFollowUp = normalizedMessage.length <= 120 && !looksLikeNewTopic(normalizedMessage);
    let previousAnswer = typeof previous_answer === "string" ? previous_answer.trim() : "";
    if ((isElaborationRequest || isFollowUp || isLooseFollowUp) && user && typeof conversation_id === "string" && conversation_id) {
      const lastUserMessage = await getLastUserMessage(user.uid, conversation_id);
      if (lastUserMessage) {
        effectiveMessage = lastUserMessage;
      }
      if (!previousAnswer) {
        const lastAssistant = await getLastAssistantMessage(user.uid, conversation_id);
        if (lastAssistant) previousAnswer = lastAssistant;
      }
    }

    const detectedLanguage = detectLanguageFromText(effectiveMessage);
    const responseLanguage =
      requestedLanguage === "auto"
        ? detectedLanguage
        : detectedLanguage !== "english" && detectedLanguage !== requestedLanguage
          ? detectedLanguage
          : requestedLanguage;
    const locationText = typeof location === "string" ? location.trim() : "";
    const mode = normalizeMode(AI_MODE);
    let conversationId = typeof conversation_id === "string" ? conversation_id : "";

    if ((isElaborationRequest || isFollowUp || isLooseFollowUp) && previousAnswer) {
      if (user && !conversationId) {
        conversationId = await createConversation(user.uid, "New conversation", messageValidation.sanitized);
      }
      let expanded = await callGeminiWithFallback(
        buildGeminiRefinePrompt(
          effectiveMessage,
          previousAnswer,
          responseLanguage,
          locationText,
          true
        ),
        { maxOutputTokens: 1000 }
      );
      if (looksUnderdetailed(expanded.reply)) {
        expanded = await callGeminiWithFallback(
          buildElaborationPrompt(effectiveMessage, previousAnswer, responseLanguage, locationText),
          { maxOutputTokens: 1200 }
        );
      }
      const response = NextResponse.json({
        reply: normalizeReply(expanded.reply),
        modeUsed: mode,
        provider: "gemini_expand",
        geminiModel: expanded.model,
        isAuthenticated: Boolean(user),
        user: user || null,
        guest_remaining: isGuest ? Math.max(0, guestLimit - (guestCount + 1)) : null,
        conversation_id: user ? conversationId : undefined
      });
      if (isGuest) {
        response.cookies.set("guest_count", String(guestCount + 1), { httpOnly: true, sameSite: "lax", path: "/" });
      }
      if (user && conversationId) {
        await saveMessage(user.uid, conversationId, "assistant", normalizeReply(expanded.reply));
      }
      return response;
    }

    if (user) {
      if (!conversationId) {
        conversationId = await createConversation(user.uid, "New conversation", messageValidation.sanitized);
      }
      await saveMessage(user.uid, conversationId, "user", messageValidation.sanitized);
    }

    const routerResult = await callGeminiWithFallback(
      buildGeminiRouterPrompt(effectiveMessage, responseLanguage, locationText),
      { maxOutputTokens: 200 }
    );
    const routing = extractRouterResult(routerResult.reply);
    let dhenuAnswer = "";
    let provider = "gemini_only";

    if (routing.dhenu_needed && routing.dhenu_question) {
      try {
        dhenuAnswer = await callDhenu(buildDhenuPrompt(routing.dhenu_question, responseLanguage, locationText));
        provider = "gemini_router+dhenu";
      } catch {
        dhenuAnswer = "";
        provider = "gemini_router+dhenu_failed";
      }
    } else {
      provider = "gemini_router_only";
    }

    const synthesis = await callGeminiWithFallback(
      buildGeminiSynthesisPrompt(
        effectiveMessage,
        dhenuAnswer,
        responseLanguage,
        locationText,
        isElaborationRequest
      ),
      { maxOutputTokens: isElaborationRequest ? 1000 : 400 }
    );

    const response = NextResponse.json({
      reply: normalizeReply(synthesis.reply),
      modeUsed: mode,
      provider,
      geminiModel: synthesis.model,
      isAuthenticated: Boolean(user),
      user: user || null,
      guest_remaining: isGuest ? Math.max(0, guestLimit - (guestCount + 1)) : null,
      conversation_id: user ? conversationId : undefined
    });
    if (isGuest) {
      response.cookies.set("guest_count", String(guestCount + 1), { httpOnly: true, sameSite: "lax", path: "/" });
    }
    if (user) {
      await saveMessage(user.uid, conversationId, "assistant", normalizeReply(synthesis.reply));
    }
    return response;
});
