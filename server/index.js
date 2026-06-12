require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const app = express();
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const rawApiKey = process.env.GROQ_API_KEY;
const apiKey =
  rawApiKey &&
  rawApiKey !== "your_groq_api_key"
    ? rawApiKey
    : null;
const contextWindow = Number(process.env.CHAT_CONTEXT_WINDOW || 20);

const groq = apiKey ? new Groq({ apiKey }) : null;
const AUDIO_TMP_DIR = "/tmp/eeia-audio/";
fs.mkdirSync(AUDIO_TMP_DIR, { recursive: true });
const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AUDIO_TMP_DIR),
  filename: (_req, _file, cb) => cb(null, `${Date.now()}.m4a`),
});
const upload = multer({ storage: audioStorage });

app.use(cors());
app.use(express.json());

function buildFallbackReply(message) {
  return {
    reply:
      `Great focus. Let's practice this in 3 short turns. First, answer this: ${message}. ` +
      "Then I will correct you and give one natural alternative.",
    suggestedGoal: `Practice ${message} in short speaking rounds with correction`,
    source: "fallback",
  };
}

function buildNameOnlySetupReply() {
  return {
    reply: "Antes de seguir, decime tu nombre para personalizar la práctica 🙂",
    suggestedGoal: "Registrar nombre del estudiante",
    correction: null,
    pronunciationHint: null,
    phase: "setup",
    source: "fallback",
  };
}

function buildLevelOnlySetupReply() {
  return {
    reply:
      "Gracias. Ahora decime tu nivel de inglés para adaptar la clase. Podés responder: nunca estudié/recién empiezo, básico, intermedio o avanzado.",
    suggestedGoal: "Registrar nivel de inglés del estudiante",
    correction: null,
    pronunciationHint: null,
    phase: "setup",
    source: "fallback",
  };
}

function buildTopicOnlySetupReply() {
  return {
    reply:
      "Perfecto. ¿Qué tema te gustaría practicar hoy? Si no tenés uno puntual, puedo proponerte opciones.",
    suggestedGoal: "Definir tema de práctica",
    correction: null,
    pronunciationHint: null,
    phase: "setup",
    source: "fallback",
  };
}

function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      text: String(item.text || "").trim(),
    }))
    .filter((item) => item.text.length > 0)
    .slice(-contextWindow);
}

function normalizeLearnerStage(level) {
  const normalized = String(level || "").trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "A1") {
    return {
      stage: "nunca estudié / recién empiezo",
      guidance: "very early beginner",
      sourceLevel: normalized,
    };
  }

  if (normalized === "A2") {
    return {
      stage: "básico",
      guidance: "basic learner",
      sourceLevel: normalized,
    };
  }

  if (normalized === "B1") {
    return {
      stage: "intermedio",
      guidance: "intermediate learner",
      sourceLevel: normalized,
    };
  }

  if (normalized === "B2" || normalized === "C1") {
    return {
      stage: "avanzado",
      guidance: "upper intermediate to advanced learner",
      sourceLevel: normalized,
    };
  }

  return {
    stage: null,
    guidance: "unknown",
    sourceLevel: normalized,
  };
}

function inferCefrLevelFromMessage(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) return null;
  if (/\ba1\b|nunca estudi|recien empiezo|reci[eé]n empiezo|principiante total/.test(normalized)) return "A1";
  if (/\ba2\b|\bbasico\b|frases simples/.test(normalized)) return "A2";
  if (/\bb1\b|\bintermedio\b|intermedio funcional/.test(normalized)) return "B1";
  if (/\bb2\b|\bc1\b|\bavanzado\b|intermedio alto/.test(normalized)) return normalized.includes("c1") ? "C1" : "B2";
  return null;
}

function inferNameFromMessage(message) {
  const raw = String(message || "").trim();
  if (!raw) return null;

  const match =
    raw.match(/(?:mi nombre es|me llamo|soy)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ'\-]{1,29}(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ'\-]{1,29})?)/i) ||
    raw.match(/(?:my name is|i am|i'm)\s+([A-Za-z][A-Za-z'\-]{1,29}(?:\s+[A-Za-z][A-Za-z'\-]{1,29})?)/i);

  if (!match || !match[1]) return null;

  const candidate = match[1].trim();
  if (!candidate || isInvalidNameCandidate(candidate)) return null;
  if (/\d/.test(candidate)) return null;

  return candidate;
}

function didAssistantRecentlyAskName(history) {
  if (!Array.isArray(history) || history.length === 0) return false;

  const recentAssistant = [...history]
    .reverse()
    .find((item) => item?.role === "assistant" && typeof item?.text === "string");

  if (!recentAssistant) return false;

  const normalized = String(recentAssistant.text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return /como te llam|tu nombre|what'?s your name|your name/.test(normalized);
}

function inferShortNameFromMessage(message) {
  const raw = String(message || "").trim();
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(a1|a2|b1|b2|c1|basico|intermedio|avanzado|nivel|topic|tema|practicar)\b/.test(normalized)) {
    return null;
  }

  if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ'\-]{1,29}(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ'\-]{1,29})?$/.test(raw)) {
    if (isInvalidNameCandidate(raw)) return null;
    return raw;
  }

  return null;
}

function isInvalidNameCandidate(candidate) {
  const normalized = String(candidate || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) return true;

  const blockedSingleWords = new Set([
    "hola",
    "hello",
    "hi",
    "hey",
    "buenas",
    "ok",
    "dale",
    "listo",
    "gracias",
    "principiante",
    "basico",
    "intermedio",
    "avanzado",
    "nivel",
    "tema",
    "topic",
    "practice",
    "practicar",
  ]);

  const blockedPhrases = [
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "nunca estudie",
    "recien empiezo",
    "mi nivel",
  ];

  if (blockedSingleWords.has(normalized)) return true;
  if (blockedPhrases.some((phrase) => normalized.includes(phrase))) return true;
  if (/\bnivel\b|\blevel\b/.test(normalized)) return true;

  return false;
}

function normalizePronunciationText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function buildPronunciationHeuristics(targetText, transcript) {
  const normalizedTarget = normalizePronunciationText(targetText);
  const normalizedTranscript = normalizePronunciationText(transcript);
  const targetTokens = normalizedTarget.split(" ").filter(Boolean);
  const transcriptTokens = normalizedTranscript.split(" ").filter(Boolean);
  const targetSet = new Set(targetTokens);
  const matchedWords = transcriptTokens.filter((token) => targetSet.has(token)).length;
  const maxWords = Math.max(targetTokens.length, 1);
  const wordScore = matchedWords / maxWords;

  const maxChars = Math.max(normalizedTarget.length, normalizedTranscript.length, 1);
  const editDistance = levenshteinDistance(normalizedTarget, normalizedTranscript);
  const charScore = 1 - editDistance / maxChars;
  const accuracyScore = Math.max(0, Math.min(100, Math.round((wordScore * 0.65 + charScore * 0.35) * 100)));

  const missedWords = targetTokens.filter((token) => !transcriptTokens.includes(token)).slice(0, 4);
  const extraWords = transcriptTokens.filter((token) => !targetSet.has(token)).slice(0, 4);

  return {
    accuracyScore,
    normalizedTarget,
    normalizedTranscript,
    targetTokens,
    transcriptTokens,
    missedWords,
    extraWords,
  };
}

function buildPronunciationFallback(targetText, transcript, accent, heuristics) {
  const strengths = [];
  const improvements = [];

  if (heuristics.accuracyScore >= 85) {
    strengths.push("La frase se entendió casi completa. Tu producción fue clara.");
  } else if (heuristics.accuracyScore >= 65) {
    strengths.push("La idea general se entendió. Vas bien con la base de la frase.");
  } else {
    strengths.push("Ya diste el paso más importante: animarte a decir la frase en voz alta.");
  }

  if (heuristics.missedWords.length > 0) {
    improvements.push(`Repetí más lento estas palabras: ${heuristics.missedWords.join(", ")}.`);
  }
  if (heuristics.extraWords.length > 0) {
    improvements.push(`Cuidá no agregar sonidos extra en: ${heuristics.extraWords.join(", ")}.`);
  }
  if (improvements.length === 0) {
    improvements.push("Probá repetir la frase manteniendo ritmo parejo y separando bien cada palabra.");
  }

  return {
    transcript,
    accuracyScore: heuristics.accuracyScore,
    targetWords: heuristics.targetTokens,
    transcriptWords: heuristics.transcriptTokens,
    missedWords: heuristics.missedWords,
    extraWords: heuristics.extraWords,
    summary: `Evaluación aproximada para acento ${accent}: el sistema comparó tu audio con el texto objetivo a partir de la transcripción.`,
    strengths,
    improvements,
    practiceTip: `Escuchá el modelo en ${accent}, repetí una vez muy lento y una segunda vez con ritmo natural: "${targetText}".`,
    source: "fallback",
  };
}

function buildLookupFallback(term) {
  return {
    term,
    translation: `Traducción aproximada de "${term}"`,
    explanation: `"${term}" es una palabra o frase en inglés. Usala dentro de una oración corta para fijarla mejor.`,
    example: `I want to understand the word "${term}" better.`,
    pronunciation: null,
    source: "fallback",
  };
}

/**
 * Shared request-parsing logic for both /tutor/message and /tutor/message/stream.
 * Returns parsed fields plus pre-computed flags used by both endpoints.
 */
function parseTutorRequest(req) {
  const message = String(req.body?.message || "").trim();
  const history = sanitizeHistory(req.body?.history);
  const learnerProfile =
    req.body?.learnerProfile && typeof req.body.learnerProfile === "object"
      ? req.body.learnerProfile
      : null;
  const hasConfiguredLevel =
    typeof learnerProfile?.level === "string" && learnerProfile.level.trim().length > 0;
  const hasConfiguredName =
    typeof learnerProfile?.name === "string" && learnerProfile.name.trim().length > 0;
  const isInPracticePhase = learnerProfile?.currentPhase === "practice";
  const currentTopic =
    typeof learnerProfile?.currentTopic === "string" && learnerProfile.currentTopic.trim().length > 0
      ? learnerProfile.currentTopic.trim()
      : null;
  const normalizedLearnerStage = normalizeLearnerStage(learnerProfile?.level);
  const capturedLevel = !hasConfiguredLevel ? inferCefrLevelFromMessage(message) : null;
  const capturedName = !hasConfiguredName
    ? inferNameFromMessage(message) ||
      (didAssistantRecentlyAskName(history) ? inferShortNameFromMessage(message) : null)
    : null;
  const hasLevelAfterMessage = hasConfiguredLevel || Boolean(capturedLevel);
  const hasNameAfterMessage = hasConfiguredName || Boolean(capturedName);
  const shouldAskNameOnly = !hasNameAfterMessage;
  const shouldAskLevelOnly = !shouldAskNameOnly && !hasLevelAfterMessage;
  const shouldAskTopicOnly =
    !shouldAskNameOnly && !shouldAskLevelOnly && !hasConfiguredLevel && Boolean(capturedLevel);
  return {
    message,
    history,
    learnerProfile,
    hasConfiguredLevel,
    hasConfiguredName,
    isInPracticePhase,
    currentTopic,
    normalizedLearnerStage,
    capturedLevel,
    capturedName,
    hasLevelAfterMessage,
    hasNameAfterMessage,
    shouldAskNameOnly,
    shouldAskLevelOnly,
    shouldAskTopicOnly,
  };
}

/**
 * Builds the tutor system prompt.
 * Pass `streaming: true` to get a plain-text + ---META--- format instead of JSON mode.
 */
function buildTutorSystemPrompt(params, { streaming = false } = {}) {
  const {
    learnerProfile,
    normalizedLearnerStage,
    hasConfiguredName,
    hasConfiguredLevel,
    isInPracticePhase,
    currentTopic,
    hasLevelAfterMessage,
    hasNameAfterMessage,
    history,
  } = params;

  return (
    "You are a friendly English coach for Spanish-speaking students of ALL ages, including young children who are just starting or want to start learning English.\n" +
    (learnerProfile
      ? "\nSTUDENT PROFILE (use this to personalize your coaching):\n" +
        (learnerProfile.level ? `- Declared level: ${learnerProfile.level}\n` : "") +
        (normalizedLearnerStage?.stage
          ? `- Normalized level category: ${normalizedLearnerStage.stage} (${normalizedLearnerStage.sourceLevel}, ${normalizedLearnerStage.guidance})\n`
          : "") +
        (typeof learnerProfile.grammarAccuracy === "number"
          ? `- Grammar accuracy: ${learnerProfile.grammarAccuracy}% — ${
              learnerProfile.grammarAccuracy < 50
                ? "needs significant grammar work"
                : learnerProfile.grammarAccuracy < 75
                ? "grammar is developing, reinforce structure"
                : "grammar is solid, focus on fluency and nuance"
            }\n`
          : "") +
        (typeof learnerProfile.fluencyScore === "number"
          ? `- Fluency score: ${learnerProfile.fluencyScore}/10 — ${
              learnerProfile.fluencyScore < 4
                ? "encourage longer responses, don't rush"
                : learnerProfile.fluencyScore < 7
                ? "push for more complex sentence structures"
                : "fluency is good, challenge with faster pacing and idioms"
            }\n`
          : "") +
        (Array.isArray(learnerProfile.weaknesses) && learnerProfile.weaknesses.length > 0
          ? `- Main weaknesses to target: ${learnerProfile.weaknesses
              .map((w) => `${w.detail} (${w.area}, priority ${w.severity}/5)`)
              .join("; ")}\n`
          : "") +
        (Array.isArray(learnerProfile.goals) && learnerProfile.goals.length > 0
          ? `- Student goals: ${learnerProfile.goals.join(", ")}\n`
          : "") +
        "Use this profile to: adjust difficulty, focus corrections on their weak areas, prioritize their goals, and propose exercises that target their specific weaknesses.\n"
      : "") +
    (isInPracticePhase
      ? "⚠️ SESSION STATE: The student is ALREADY IN PRACTICE PHASE. " +
        (currentTopic ? `The established practice topic is: "${currentTopic}". ` : "") +
        "DO NOT restart or reset the conversation. DO NOT greet the student as if they just arrived. DO NOT ask for their name or level again. " +
        "Continue the practice conversation naturally from where it left off. " +
        "The conversation history provided may be truncated (only the most recent messages), but the session has been ongoing — assume level and topic are already established.\n" +
        (currentTopic
          ? `CRITICAL — TOPIC LOCK: The practice objective "${currentTopic}" is FIXED for this entire session. ` +
            "If the student goes off-topic or asks something unrelated, answer very briefly (one sentence max) and IMMEDIATELY steer the conversation back to the established practice objective. " +
            "Never abandon or forget the practice goal. Every reply must advance or revisit that objective.\n\n"
          : "\n")
      : hasConfiguredName && hasConfiguredLevel && history.length === 0
      ? "⚠️ SESSION STATE: The student's name and level are already configured in their profile. " +
        "This is the START of a new practice session and the student's message IS their chosen topic. " +
        "DO NOT greet them as if they just arrived. DO NOT say 'me alegra verte' or similar welcome phrases. DO NOT ask for name or level again. " +
        "Acknowledge the topic briefly (one short sentence in Spanish) and IMMEDIATELY begin the practice exercise. " +
        (normalizedLearnerStage?.stage === "intermedio" || normalizedLearnerStage?.stage === "avanzado"
          ? "CRITICAL LANGUAGE RULE for this session: after the single Spanish acknowledgment line, write the ENTIRE exercise IN ENGLISH — the student is " +
            normalizedLearnerStage.stage +
            " level (" +
            normalizedLearnerStage.sourceLevel +
            ") and must practice in English. Do NOT write the exercise body in Spanish.\n\n"
          : "Stick to Spanish for the exercise body since the student is a beginner.\n\n") +
        "Set phase to 'practice'.\n\n"
      : "") +
    "APP TECHNICAL CAPABILITIES (strict constraints — never violate these):\n" +
    "The student is using a mobile chat app with the following capabilities:\n" +
    "  ✅ Text chat (student types or speaks — voice is transcribed automatically)\n" +
    "  ✅ Student can record their voice and receive pronunciation feedback\n" +
    "  ✅ Shadowing practice: you provide short phrases for the student to read aloud\n" +
    "  ✅ Word/phrase lookup with examples\n" +
    "  ❌ The app CANNOT play audio or video inline\n" +
    "  ❌ The app CANNOT display images or embedded media\n" +
    "  ❌ The student CANNOT upload or share audio/video files\n" +
    "  ⚠️ LINKS: Do NOT include URLs in your replies. Many educational sites (BBC, British Council, etc.) " +
    "are geo-restricted and the student may not be able to access them. " +
    "All content must be self-contained within your reply.\n" +
    "LISTENING SIMULATION RULE: When the topic involves listening comprehension (news, podcasts, BBC, radio), " +
    "you MUST write a short inline passage (3–6 sentences) that represents the audio content — " +
    "label it clearly as '📰 Transcripción de ejemplo:' — and then ask the student comprehension or discussion questions based on it. " +
    "The passage should sound like authentic spoken English at the student's level. " +
    "NEVER ask the student to find or access external content.\n\n" +
    "Your conversation has two phases:\n\n" +
    "PHASE 1 - SETUP:\n" +
    "Applies when the conversation history has no established level or topic yet.\n" +
    "- Greet the student warmly IN SPANISH.\n" +
    (hasConfiguredName
      ? "- The student's name is already configured in profile. DO NOT ask their name again.\n"
      : "- Ask the student's name in a natural, short way (e.g. '¿Cómo te llamás?').\n") +
    "- Critical flow rule: if name is missing, ask ONLY for name in this turn and do NOT ask level or topic in the same message.\n" +
    (hasConfiguredLevel
      ? "- The student's level is already configured in profile. DO NOT ask their level again.\n"
      : "- Ask their English level using these options: 'nunca estudié inglés / recién empiezo', 'básico', 'intermedio' or 'avanzado'.\n") +
    "- Ask what topic or situation they want to practice. For beginners or children, suggest simple options like: colores, animales, números, saludos, la familia, el cuerpo, objetos del aula.\n" +
    (hasConfiguredLevel && hasConfiguredName
      ? "- Once you have a topic from the student, confirm in Spanish and announce you will now begin.\n"
      : "- Once you have name, level and topic from the student, confirm in Spanish and announce you will now begin.\n") +
    "- Set phase to 'setup'.\n\n" +
    "PHASE 2 - PRACTICE:\n" +
    "Applies once level and topic are established in the history.\n" +
    (normalizedLearnerStage?.stage
      ? `- If a normalized level category is provided in profile (${normalizedLearnerStage.stage}), prioritize it over guessed level from conversation.\n`
      : "") +
    "TOPIC ADHERENCE RULE: The practice topic is the session's primary objective. Always bring every reply back to it. " +
    "If the student veers off-topic, answer briefly (one sentence) then redirect: 'Let's get back to our topic — [restate the topic]. [next exercise step]'. " +
    "Never let the conversation drift for more than one exchange without returning to the objective.\n" +
    "IMPORTANT: adapt everything to the student's level:\n" +
    "- For 'nunca estudié / recién empiezo' (beginners, may be children): stay mostly IN SPANISH, introduce single English words or very short phrases, use encouraging and playful language, keep it very simple and fun. Never switch fully to English until they are ready.\n" +
    "- For 'básico': mix Spanish explanations with short English sentences. Introduce simple structures.\n" +
    "- For 'intermedio' or 'avanzado': conduct the conversation fully IN ENGLISH at the appropriate level.\n" +
    "- Act as their conversation partner and guide on the chosen topic.\n" +
    "- IMPORTANT about language in YOUR replies: the level rule always takes priority.\n" +
    "  · Beginners ('nunca estudié / recién empiezo'): your reply MUST be IN SPANISH with only isolated English words/phrases embedded. NEVER reply in full English sentences to a beginner. If the student writes in Spanish that is perfectly fine and expected — answer in Spanish and introduce the English word gently.\n" +
    "  · Básico: reply mostly in Spanish with short English sentences mixed in. If the student writes in Spanish, gently note the English equivalent but keep most of your reply in Spanish.\n" +
    "  · Intermedio / Avanzado: conduct the conversation fully IN ENGLISH. If the student writes in Spanish, gently acknowledge it, respond in English, and encourage them to try in English.\n" +
    "- If the student makes a WRITING error (typo, spelling), explain IN SPANISH and set correction.\n" +
    "- If the student makes a GRAMMAR error (wrong tense, structure, agreement), explain IN SPANISH and set correction.\n" +
    "- If the student makes a PRAGMATIC error (wrong register, culturally odd phrase, awkward wording for the context), explain IN SPANISH and set correction.\n" +
    "- For beginners and children, only correct one error at a time and always celebrate effort before correcting.\n" +
    "- If there are no errors, set correction to null.\n" +
    "- Set phase to 'practice'.\n\n" +
    (streaming
      ? "Write your reply to the student naturally (no JSON wrapping). " +
        "Then, immediately after your reply, on a new line write exactly the separator ---META--- " +
        "and on that same line (no blank line between) append a single compact JSON object with ONLY these keys: " +
        'correction (string or null), pronunciationHint (string or null), suggestedGoal (string), phase ("setup" or "practice"). ' +
        'Example line: ---META---{"correction":null,"pronunciationHint":null,"suggestedGoal":"Practicar saludos","phase":"practice"}\n' +
        "No other text after the JSON. Do NOT wrap your reply in JSON."
      : "Respond ONLY with a valid JSON object with these keys:\n" +
        "- reply (string): your response.\n" +
        "- correction (string or null): correction explanation in Spanish, or null.\n" +
        "- pronunciationHint (string or null): if the student used a word with tricky pronunciation, provide a brief phonetic hint IN SPANISH (e.g. 'though' → /ðoʊ/, la 'th' es sonora). Set to null otherwise.\n" +
        "- suggestedGoal (string): short learning goal based on this exchange, written IN SPANISH.\n" +
        "- phase (string): 'setup' or 'practice'.\n") +
    "Always be patient, warm, encouraging and fun. Never be harsh. Adapt your tone to the student's age and level."
  );
}

/**
 * Computes the final phase value applying the same logic used by both endpoints.
 */
function resolveTutorPhase({ isInPracticePhase, parsedPhase, hasLevelAfterMessage, hasNameAfterMessage, hasConfiguredName, hasConfiguredLevel, historyLength }) {
  if (isInPracticePhase) return "practice";
  if (parsedPhase === "practice" && hasLevelAfterMessage && hasNameAfterMessage) return "practice";
  if (hasConfiguredName && hasConfiguredLevel && historyLength === 0) return "practice";
  return "setup";
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, model, provider: "groq", hasApiKey: Boolean(apiKey) });
});

app.post("/tutor/message", async (req, res) => {
  try {
    const parsed = parseTutorRequest(req);
    const {
      message, history, learnerProfile,
      hasConfiguredLevel, hasConfiguredName, isInPracticePhase,
      normalizedLearnerStage, capturedLevel, capturedName,
      hasLevelAfterMessage, hasNameAfterMessage,
      shouldAskNameOnly, shouldAskLevelOnly, shouldAskTopicOnly,
    } = parsed;

    if (!message) return res.status(400).json({ error: "message is required" });

    if (shouldAskNameOnly) return res.json({ ...buildNameOnlySetupReply(), capturedLevel, capturedName, source: groq ? "groq" : "fallback" });
    if (shouldAskLevelOnly) return res.json({ ...buildLevelOnlySetupReply(), capturedLevel, capturedName, source: groq ? "groq" : "fallback" });
    if (shouldAskTopicOnly) return res.json({ ...buildTopicOnlySetupReply(), capturedLevel, capturedName, source: groq ? "groq" : "fallback" });
    if (!groq) return res.json(buildFallbackReply(message));

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildTutorSystemPrompt(parsed, { streaming: false }) },
          { role: "user", content: `Conversation context: ${JSON.stringify(history)}\nLatest student message: ${message}` },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      let body;
      try { body = JSON.parse(raw); } catch { body = buildFallbackReply(message); }

      const safeReply = typeof body.reply === "string" ? body.reply : buildFallbackReply(message).reply;
      const safeGoal = typeof body.suggestedGoal === "string" ? body.suggestedGoal : buildFallbackReply(message).suggestedGoal;
      const correction = typeof body.correction === "string" && body.correction.toLowerCase() !== "null" ? body.correction : null;
      const pronunciationHint = typeof body.pronunciationHint === "string" && body.pronunciationHint.toLowerCase() !== "null" ? body.pronunciationHint : null;
      const phase = resolveTutorPhase({ isInPracticePhase, parsedPhase: body.phase, hasLevelAfterMessage, hasNameAfterMessage, hasConfiguredName, hasConfiguredLevel, historyLength: history.length });

      return res.json({ reply: safeReply, suggestedGoal: safeGoal, correction, pronunciationHint, capturedLevel, capturedName, phase, source: "groq" });
    } catch (groqError) {
      console.error("Groq request failed, using fallback", groqError);
      return res.json({ ...buildFallbackReply(message), capturedLevel, capturedName, warning: groqError.message });
    }
  } catch (error) {
    console.error("Tutor endpoint error", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

const META_SEP = "---META---";

app.post("/tutor/message/stream", async (req, res) => {
  const parsed = parseTutorRequest(req);
  const {
    message, history,
    hasConfiguredLevel, hasConfiguredName, isInPracticePhase,
    capturedLevel, capturedName,
    hasLevelAfterMessage, hasNameAfterMessage,
    shouldAskNameOnly, shouldAskLevelOnly, shouldAskTopicOnly,
  } = parsed;

  if (!message) return res.status(400).json({ error: "message is required" });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function sendFallbackAsStream(fallbackReply) {
    const { reply, suggestedGoal, correction = null, pronunciationHint = null, phase = "setup" } = fallbackReply;
    sendEvent({ type: "chunk", text: reply });
    sendEvent({ type: "done", correction, pronunciationHint, suggestedGoal: suggestedGoal || "", phase, capturedLevel, capturedName, source: "fallback" });
    res.end();
  }

  if (shouldAskNameOnly) return sendFallbackAsStream({ ...buildNameOnlySetupReply(), phase: "setup" });
  if (shouldAskLevelOnly) return sendFallbackAsStream({ ...buildLevelOnlySetupReply(), phase: "setup" });
  if (shouldAskTopicOnly) return sendFallbackAsStream({ ...buildTopicOnlySetupReply(), phase: "setup" });
  if (!groq) return sendFallbackAsStream(buildFallbackReply(message));

  try {
    const stream = await groq.chat.completions.create({
      model,
      temperature: 0.4,
      stream: true,
      messages: [
        { role: "system", content: buildTutorSystemPrompt(parsed, { streaming: true }) },
        { role: "user", content: `Conversation context: ${JSON.stringify(history)}\nLatest student message: ${message}` },
      ],
    });

    // Buffer to hold incoming text until we can safely flush it.
    // We keep up to (META_SEP.length - 1) chars buffered to detect the separator
    // even when it arrives split across multiple chunks.
    let pending = "";
    let metaMode = false;
    let metaBuffer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (!delta) continue;

      if (metaMode) {
        metaBuffer += delta;
        continue;
      }

      pending += delta;

      const sepIdx = pending.indexOf(META_SEP);
      if (sepIdx !== -1) {
        // Everything before the separator is reply text
        const replyPart = pending.slice(0, sepIdx);
        if (replyPart) sendEvent({ type: "chunk", text: replyPart });
        metaBuffer = pending.slice(sepIdx + META_SEP.length);
        pending = "";
        metaMode = true;
      } else {
        // Flush everything except a trailing window that could be a partial separator
        const safeLen = pending.length - (META_SEP.length - 1);
        if (safeLen > 0) {
          sendEvent({ type: "chunk", text: pending.slice(0, safeLen) });
          pending = pending.slice(safeLen);
        }
      }
    }

    // Flush any remaining reply text (no META_SEP found at all)
    if (!metaMode && pending) {
      sendEvent({ type: "chunk", text: pending });
    }

    // Parse metadata from the buffer after ---META---
    let meta = {};
    const jsonStart = metaBuffer.indexOf("{");
    const jsonEnd = metaBuffer.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      try { meta = JSON.parse(metaBuffer.slice(jsonStart, jsonEnd + 1)); } catch { /* use empty meta */ }
    }

    const correction = typeof meta.correction === "string" && meta.correction.toLowerCase() !== "null" ? meta.correction : null;
    const pronunciationHint = typeof meta.pronunciationHint === "string" && meta.pronunciationHint.toLowerCase() !== "null" ? meta.pronunciationHint : null;
    const suggestedGoal = typeof meta.suggestedGoal === "string" ? meta.suggestedGoal : "";
    const phase = resolveTutorPhase({ isInPracticePhase, parsedPhase: meta.phase, hasLevelAfterMessage, hasNameAfterMessage, hasConfiguredName, hasConfiguredLevel, historyLength: history.length });

    sendEvent({ type: "done", correction, pronunciationHint, suggestedGoal, phase, capturedLevel, capturedName, source: "groq" });
    res.end();
  } catch (err) {
    console.error("Stream endpoint error", err);
    sendEvent({ type: "error", message: err.message });
    res.end();
  }
});

app.post("/tutor/transcribe", upload.single("audio"), async (req, res) => {
  if (!groq) return res.status(503).json({ error: "groq_not_configured" });
  if (!req.file) return res.status(400).json({ error: "audio file required" });

  try {
    // Honor explicit language hint (en/es). Defaults to "en" if not provided.
    const requestedLang = String(req.body?.language || "").trim().toLowerCase();
    const language = requestedLang === "es" ? "es" : "en";
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      language,
      response_format: "verbose_json",
    });
    const segments = Array.isArray(transcription.segments) ? transcription.segments : [];
    const avgLogprob = segments.length > 0
      ? segments.reduce((sum, s) => sum + (typeof s.avg_logprob === "number" ? s.avg_logprob : 0), 0) / segments.length
      : null;
    res.json({ text: transcription.text, avgLogprob });
  } catch (err) {
    console.error("Whisper transcription failed", err);
    res.status(500).json({ error: "transcription_failed", detail: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.post("/tutor/translate", upload.single("audio"), async (req, res) => {
  if (!groq) return res.status(503).json({ error: "groq_not_configured" });
  if (!req.file) return res.status(400).json({ error: "audio file required" });

  try {
    // Step 1: transcribe with auto language detection
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      response_format: "json",
    });
    const original = String(transcription.text || "").trim();
    if (!original) {
      return res.json({ original: "", translated: "" });
    }

    // Step 2: translate to English via LLM
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a translator for an English learning app. " +
            "Translate the following Spanish text to natural, fluent English as if the learner said it directly. " +
            "Return ONLY the English translation, nothing else.",
        },
        { role: "user", content: original },
      ],
    });
    const translated = String(completion.choices?.[0]?.message?.content || "").trim();
    res.json({ original, translated });
  } catch (err) {
    console.error("Translation failed", err);
    res.status(500).json({ error: "translation_failed", detail: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.post("/tutor/pronunciation", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio file required" });

  const targetText = String(req.body?.targetText || "").trim();
  const accent = String(req.body?.accent || "US").trim().toUpperCase();
  if (!targetText) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "targetText is required" });
  }

  if (!groq) {
    fs.unlink(req.file.path, () => {});
    return res.status(503).json({ error: "groq_not_configured" });
  }

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
    });

    const transcript = String(transcription.text || "").trim();
    const heuristics = buildPronunciationHeuristics(targetText, transcript);
    const fallback = buildPronunciationFallback(targetText, transcript, accent, heuristics);

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an English pronunciation coach for Spanish-speaking learners. " +
              "You DO NOT have direct access to the audio phonetics. You only have the target sentence, the speech-to-text transcript, the selected accent, and a heuristic accuracy score. " +
              "Be honest: infer likely pronunciation issues from the mismatch, but never claim certainty about sounds you did not hear. " +
              "Respond ONLY as JSON with keys: summary (string in Spanish), strengths (array of 1-3 Spanish strings), improvements (array of 1-4 Spanish strings), practiceTip (string in Spanish). " +
              "Keep feedback beginner-friendly, concrete, and short.",
          },
          {
            role: "user",
            content:
              `Accent: ${accent}\n` +
              `Target text: ${targetText}\n` +
              `Transcript: ${transcript || "(empty)"}\n` +
              `Heuristic accuracy score: ${heuristics.accuracyScore}/100\n` +
              `Missed words: ${heuristics.missedWords.join(", ") || "none"}\n` +
              `Extra words: ${heuristics.extraWords.join(", ") || "none"}`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      return res.json({
        transcript,
        accuracyScore: heuristics.accuracyScore,
        targetWords: heuristics.targetTokens,
        transcriptWords: heuristics.transcriptTokens,
        missedWords: heuristics.missedWords,
        extraWords: heuristics.extraWords,
        summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
        strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths.slice(0, 3) : fallback.strengths,
        improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0 ? parsed.improvements.slice(0, 4) : fallback.improvements,
        practiceTip: typeof parsed.practiceTip === "string" ? parsed.practiceTip : fallback.practiceTip,
        source: "groq",
      });
    } catch (assessmentError) {
      console.error("Pronunciation assessment fallback", assessmentError);
      return res.json(fallback);
    }
  } catch (err) {
    console.error("Pronunciation endpoint failed", err);
    return res.status(500).json({ error: "pronunciation_failed", detail: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.post("/tutor/lookup", async (req, res) => {
  try {
    const term = String(req.body?.term || "").trim();
    const learnerLevel = String(req.body?.learnerLevel || "").trim().toUpperCase();

    if (!term) {
      return res.status(400).json({ error: "term is required" });
    }

    if (!groq) {
      return res.json(buildLookupFallback(term));
    }

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a concise English helper for Spanish-speaking learners. " +
              "Explain the meaning of one English word or short phrase in simple Spanish. " +
              "If the learner seems beginner (A1/A2), keep the explanation very simple. " +
              "Respond ONLY as JSON with keys: translation (string), explanation (string), example (string), pronunciation (string or null). " +
              "The example must be a short English sentence using the term, followed by nothing else.",
          },
          {
            role: "user",
            content:
              `Learner level: ${learnerLevel || "unknown"}\n` +
              `Term to explain: ${term}`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = buildLookupFallback(term);
      }

      const fallback = buildLookupFallback(term);
      return res.json({
        term,
        translation: typeof parsed.translation === "string" ? parsed.translation : fallback.translation,
        explanation: typeof parsed.explanation === "string" ? parsed.explanation : fallback.explanation,
        example: typeof parsed.example === "string" ? parsed.example : fallback.example,
        pronunciation: typeof parsed.pronunciation === "string" ? parsed.pronunciation : null,
        source: "groq",
      });
    } catch (lookupError) {
      console.error("Lookup request fallback", lookupError);
      return res.json(buildLookupFallback(term));
    }
  } catch (error) {
    console.error("Lookup endpoint error", error);
    return res.status(500).json({ error: "lookup_failed" });
  }
});

const SHADOWING_FALLBACK_PHRASES = {
  básico: [
    "Hello, good morning.",
    "My name is Sofia.",
    "I like apples.",
    "Where is the bus stop?",
    "I need water, please.",
    "This is my phone.",
    "Can you help me?",
    "I live near the station.",
    "I am ready to start.",
    "Today is a sunny day.",
    "I have two brothers.",
    "See you tomorrow.",
  ],
  intermedio: [
    "I usually study English after dinner.",
    "Could you speak a little slower, please?",
    "I am getting better at pronunciation every week.",
    "I need to explain this idea clearly in my meeting.",
    "I had to reschedule the appointment because of traffic.",
    "We can review the main points before the presentation starts.",
    "I am trying to sound more natural when I talk to clients.",
    "Let me know if this explanation is clear enough for everyone.",
    "I made progress, but I still need to improve my rhythm.",
    "I will send you the updated report by the end of the day.",
    "Can we practice this dialogue one more time with better intonation?",
    "I felt nervous at first, but then I spoke with more confidence.",
  ],
  avanzado: [
    "I would appreciate your feedback on my presentation style.",
    "The results were encouraging, although not entirely conclusive.",
    "We should prioritize clarity over complexity in this discussion.",
    "I am aiming for a more natural rhythm and intonation.",
    "From a strategic standpoint, the proposal is sound but operationally demanding.",
    "I acknowledge your concerns; however, the long-term benefits justify the risk.",
    "Her argument was persuasive because it balanced evidence with practical implications.",
    "If we frame the message carefully, we can avoid unnecessary resistance.",
    "The negotiation stalled when both parties underestimated cultural nuances.",
    "In hindsight, a more incremental rollout would have reduced friction.",
    "I am refining my delivery to make complex ideas easier to follow.",
    "Despite the constraints, the team produced a remarkably coherent solution.",
  ],
};

app.post("/tutor/shadowing-phrases", async (req, res) => {
  try {
    const rawLevel = String(req.body?.level || "intermedio").trim().toLowerCase();
    const level = ["básico", "basico", "intermedio", "avanzado"].includes(rawLevel)
      ? rawLevel.replace("basico", "básico")
      : "intermedio";
    const count = Math.min(Math.max(Number(req.body?.count) || 12, 4), 20);
    const excludePhrases = Array.isArray(req.body?.exclude)
      ? req.body.exclude.map((p) => String(p)).filter(Boolean).slice(0, 40)
      : [];

    const fallback = SHADOWING_FALLBACK_PHRASES[level] || SHADOWING_FALLBACK_PHRASES.intermedio;

    if (!groq) {
      return res.json({ phrases: fallback, source: "fallback" });
    }

    const levelGuidance = {
      básico: "very short, simple sentences (4-8 words). A1-A2 level. Common everyday topics: greetings, family, food, time, places. No contractions or complex grammar.",
      intermedio: "medium-length sentences (8-15 words). B1 level. Practical topics: work, appointments, travel, opinions, routines. Mix of simple and compound sentences.",
      avanzado: "longer, sophisticated sentences (12-20 words). B2-C1 level. Topics: professional communication, nuanced opinions, abstract ideas, negotiations, analysis.",
    };

    const excludeSection = excludePhrases.length > 0
      ? `\nDO NOT include any of these recently used phrases (avoid repetition):\n${excludePhrases.map((p) => `- ${p}`).join("\n")}`
      : "";

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an English pronunciation coach generating shadowing practice phrases for Spanish-speaking learners. " +
              "Shadowing phrases must be natural-sounding spoken English — the kind a native speaker would say in real life. " +
              "Vary topics across: daily life, work, travel, emotions, social situations, phone calls, shopping, directions. " +
              "Each phrase must be phonetically interesting for the level (e.g. for básico: clear vowels and consonants; for avanzado: connected speech, reductions, stress patterns). " +
              "Never generate offensive, political, or culturally sensitive content. " +
              "Respond ONLY as JSON with key: phrases (array of strings).",
          },
          {
            role: "user",
            content:
              `Level: ${level}\n` +
              `Guidance: ${levelGuidance[level]}\n` +
              `Generate exactly ${count} unique shadowing phrases.\n` +
              `Each phrase must be a single standalone sentence, written in standard English.\n` +
              excludeSection,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.json({ phrases: fallback, source: "fallback" });
      }

      const phrases = Array.isArray(parsed.phrases)
        ? parsed.phrases
            .map((p) => String(p || "").trim())
            .filter((p) => p.length > 0)
            .slice(0, count)
        : [];

      if (phrases.length < 4) {
        return res.json({ phrases: fallback, source: "fallback" });
      }

      return res.json({ phrases, source: "groq" });
    } catch (groqError) {
      console.error("Shadowing phrases generation failed, using fallback", groqError);
      return res.json({ phrases: fallback, source: "fallback" });
    }
  } catch (error) {
    console.error("Shadowing phrases endpoint error", error);
    return res.status(500).json({ error: "shadowing_phrases_failed" });
  }
});

// ─── Topic suggestions ───────────────────────────────────────────────────────

const TOPIC_SUGGESTION_FALLBACK = [
  { text: "Reunión de trabajo y seguimiento de tareas", skillFocus: "Present perfect" },
  { text: "Pedir comida en un restaurante",             skillFocus: "Can / Could" },
  { text: "Pronunciación en presentaciones cortas",    skillFocus: "Pronunciation" },
];

// CEFR progression map: grammar structures needed to reach the next level
const CEFR_PROGRESSION = {
  A1: {
    nextLevel: "A2",
    keyStructures: [
      "verb to be (am/is/are)",
      "present simple (I like, he works)",
      "basic question formation (Are you…? Do you…?)",
      "possessives (my, your, his/her)",
      "basic vocabulary: numbers, colors, family, body parts",
    ],
  },
  A2: {
    nextLevel: "B1",
    keyStructures: [
      "past simple (regular and irregular verbs)",
      "going to (future plans)",
      "will (spontaneous future, predictions)",
      "can / could / would (ability, requests)",
      "comparatives and superlatives",
      "common phrasal verbs (go out, look for, wake up)",
    ],
  },
  B1: {
    nextLevel: "B2",
    keyStructures: [
      "present perfect (I have done / I have been)",
      "1st conditional (If I study, I will pass)",
      "2nd conditional (If I had more time, I would travel)",
      "passive voice (The report was sent)",
      "phrasal verbs in context",
      "expressing opinions and agreeing/disagreeing",
    ],
  },
  B2: {
    nextLevel: "C1",
    keyStructures: [
      "3rd conditional (If I had known, I would have called)",
      "mixed conditionals",
      "reported speech (She said that she had finished)",
      "advanced vocabulary and collocations",
      "discourse markers (However, Furthermore, In contrast)",
      "idiomatic expressions",
    ],
  },
  C1: {
    nextLevel: "C2",
    keyStructures: [
      "nuanced register variation (formal vs informal vs academic)",
      "complex clause structures and nominalisation",
      "advanced idiomatic and figurative language",
      "critical discussion and hedging language",
      "cohesion and coherence in extended discourse",
    ],
  },
};

app.post("/tutor/topic-suggestions", async (req, res) => {
  try {
    const body = req.body || {};

    // Learner context
    const level = String(body.level || "A2").trim().toUpperCase();
    const name = String(body.name || "").trim();
    const nextClassGoal = String(body.nextClassGoal || "").trim();
    const grammarAccuracy = Number(body.grammarAccuracy ?? 0);
    const fluencyScore = Number(body.fluencyScore ?? 0);
    const pronunciationScore = Number(body.pronunciationScore ?? 0);
    const weaknesses = Array.isArray(body.weaknesses)
      ? body.weaknesses.map((w) => String(w)).filter(Boolean).slice(0, 5)
      : [];
    const recentTopics = Array.isArray(body.recentTopics)
      ? body.recentTopics.map((t) => String(t)).filter(Boolean).slice(0, 8)
      : [];
    const listeningByAccent = body.listeningByAccent && typeof body.listeningByAccent === "object"
      ? body.listeningByAccent
      : {};

    if (!groq) {
      return res.json({ topics: TOPIC_SUGGESTION_FALLBACK, source: "fallback" });
    }

    const progression = CEFR_PROGRESSION[level] || CEFR_PROGRESSION["A2"];

    // Build weakest accent line (only include accents that make sense for real-world use)
    const ACCENT_LABELS = {
      american:    "American English (USA — most widely used globally)",
      british:     "British English (UK — essential for European and professional contexts)",
      australian:  "Australian English (useful for travel and Oceania)",
      canadian:    "Canadian English (similar to American but distinct in some areas)",
      irish:       "Irish English (common in tech industry)",
      scottish:    "Scottish English",
      indian:      "Indian English (very frequent in technology and outsourcing)",
      southAfrican: "South African English",
    };
    const accentEntries = Object.entries(listeningByAccent)
      .filter(([key]) => ACCENT_LABELS[key])
      .sort((a, b) => a[1] - b[1]);
    const weakestAccentLine = accentEntries.length > 0
      ? `Weakest listening accent: ${ACCENT_LABELS[accentEntries[0][0]] || accentEntries[0][0]} (score: ${accentEntries[0][1]}%)`
      : "";

    const weakestSkill =
      grammarAccuracy <= fluencyScore * 10 && grammarAccuracy <= pronunciationScore * 10
        ? "grammar"
        : fluencyScore * 10 <= pronunciationScore * 10
        ? "fluency"
        : "pronunciation";

    const systemPrompt =
      "You are an expert English teacher designing pedagogically-driven lesson topics for Spanish-speaking learners. " +
      "Your goal is NOT to suggest random conversation topics — it is to plan practice sessions that systematically " +
      "build the grammar structures and skills the student needs to reach their next CEFR level. " +
      "Each topic must embed a specific grammar structure or language skill as its core learning objective, " +
      "wrapped inside a real-life, motivating situation (travel, work, technology, daily life, culture). " +
      "The student should feel they are having a fun conversation, but the tutor will be targeting the underlying structure. " +
      "Never suggest offensive, political, or culturally sensitive content. " +
      "Respond ONLY as JSON with key: topics — an array of exactly 3 objects, each with:\n" +
      "  - text: string in Spanish (the conversation situation, 5–12 words)\n" +
      "  - skillFocus: string in English (the specific grammar/skill being targeted, 2–5 words, e.g. 'Present perfect', '2nd Conditional', 'Passive voice')";

    const userPrompt =
      `Student profile:\n` +
      `- Name: ${name || "not specified"}\n` +
      `- Current CEFR level: ${level}\n` +
      `- Target next level: ${progression.nextLevel}\n` +
      `- Grammar accuracy: ${grammarAccuracy}%\n` +
      `- Fluency: ${Math.round(fluencyScore * 10)}%\n` +
      `- Pronunciation: ${Math.round(pronunciationScore * 10)}%\n` +
      `- Weakest skill right now: ${weakestSkill}\n` +
      (weaknesses.length > 0 ? `- Specific weaknesses: ${weaknesses.join(", ")}\n` : "") +
      (weakestAccentLine ? `- ${weakestAccentLine}\n` : "") +
      (nextClassGoal ? `- Next class goal: "${nextClassGoal}"\n` : "") +
      `\nKey grammar structures needed to advance from ${level} to ${progression.nextLevel}:\n` +
      progression.keyStructures.map((s) => `  • ${s}`).join("\n") +
      `\n\n${recentTopics.length > 0 ? `Recent session topics (do not repeat these):\n${recentTopics.map((t) => `  - "${t}"`).join("\n")}` : "No recent sessions yet."}\n\n` +
      `Generate exactly 3 session topics. Rules:\n` +
      `1. Each topic must target a DIFFERENT grammar structure from the progression list above\n` +
      `2. Prioritize structures related to the student's weakest skill (${weakestSkill})\n` +
      `3. Wrap each structure in a natural, real-life conversation situation\n` +
      `4. If there is a weak accent, one topic should involve listening comprehension in that accent's cultural context\n` +
      `5. If there is a next class goal, one topic should address it\n` +
      `6. Write the "text" field in Spanish, "skillFocus" in English`;

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.75,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.json({ topics: TOPIC_SUGGESTION_FALLBACK, source: "fallback" });
      }

      const topics = Array.isArray(parsed.topics)
        ? parsed.topics
            .filter((t) => t && typeof t.text === "string" && typeof t.skillFocus === "string")
            .map((t) => ({ text: String(t.text).trim(), skillFocus: String(t.skillFocus).trim() }))
            .filter((t) => t.text.length > 0 && t.skillFocus.length > 0)
            .slice(0, 3)
        : [];

      if (topics.length < 1) {
        return res.json({ topics: TOPIC_SUGGESTION_FALLBACK, source: "fallback" });
      }

      return res.json({ topics, source: "groq" });
    } catch (groqError) {
      console.error("Topic suggestions Groq call failed, using fallback", groqError);
      return res.json({ topics: TOPIC_SUGGESTION_FALLBACK, source: "fallback" });
    }
  } catch (error) {
    console.error("Topic suggestions endpoint error", error);
    return res.status(500).json({ error: "topic_suggestions_failed" });
  }
});

// ─── Structured exercises ─────────────────────────────────────────────────────

const EXERCISES_FALLBACK = {
  A1: [
    { type: "multiple_choice", question: "Which sentence is correct?", options: ["She have a cat.", "She has a cat.", "She haves a cat.", "She is have a cat."], correctIndex: 1, explanation: "Con 'she/he/it' el verbo 'have' se convierte en 'has' en presente simple." },
    { type: "multiple_choice", question: "Complete: 'I ___ a student.'", options: ["am", "is", "are", "be"], correctIndex: 0, explanation: "Con 'I' siempre usamos 'am' del verbo 'to be'." },
    { type: "fill_blank", sentence: "They ___ from Argentina.", correctAnswer: "are", hint: "verb 'to be' with 'they'", explanation: "Con 'they/we/you' usamos 'are'." },
    { type: "multiple_choice", question: "What is the plural of 'child'?", options: ["childs", "childen", "children", "child"], correctIndex: 2, explanation: "'Children' es el plural irregular de 'child'." },
    { type: "fill_blank", sentence: "She ___ to school every day.", correctAnswer: "goes", hint: "present simple, 3rd person singular of 'go'", explanation: "Con he/she/it, los verbos en presente simple agregan -s o -es." },
  ],
  A2: [
    { type: "multiple_choice", question: "Choose the correct past tense: 'Yesterday I ___ to the market.'", options: ["go", "goes", "went", "gone"], correctIndex: 2, explanation: "'Went' es el pasado irregular de 'go'." },
    { type: "fill_blank", sentence: "She ___ TV last night. (negative)", correctAnswer: "didn't watch", hint: "past simple negative: didn't + base verb", explanation: "En pasado negativo usamos 'didn't' + infinitivo sin 'to'." },
    { type: "multiple_choice", question: "Which sentence is correct?", options: ["I am going to call you tomorrow.", "I going to call you tomorrow.", "I will to call you tomorrow.", "I go call you tomorrow."], correctIndex: 0, explanation: "'Be going to' expresa planes futuros. Estructura: am/is/are + going to + infinitivo." },
    { type: "fill_blank", sentence: "___ you like coffee? Yes, I ___.", correctAnswer: "Do / do", hint: "present simple question and short answer", explanation: "Las preguntas en presente simple usan 'do/does'. La respuesta corta repite el auxiliar." },
    { type: "multiple_choice", question: "Find the error: 'Can you helps me?'", options: ["Can", "you", "helps", "me"], correctIndex: 2, explanation: "Después de verbos modales (can, will, must…) el verbo siempre va en infinitivo sin cambios: 'Can you help me?'" },
  ],
  B1: [
    { type: "multiple_choice", question: "Choose the correct option: 'I ___ in this city for five years.'", options: ["live", "lived", "have lived", "am living"], correctIndex: 2, explanation: "Se usa Present Perfect con 'for' para indicar una acción que comenzó en el pasado y continúa ahora." },
    { type: "fill_blank", sentence: "If I ___ more time, I would travel more.", correctAnswer: "had", hint: "2nd conditional — 'if' clause uses past simple", explanation: "En el 2nd conditional, la cláusula 'if' usa pasado simple aunque se refiera al presente/futuro hipotético." },
    { type: "multiple_choice", question: "The report ___ by the manager yesterday.", options: ["wrote", "was written", "is written", "has written"], correctIndex: 1, explanation: "Voz pasiva en pasado: was/were + participio pasado." },
    { type: "fill_blank", sentence: "She asked me where I ___ from.", correctAnswer: "was", hint: "reported speech — backshift of 'am' → 'was'", explanation: "En reported speech, el presente 'am' cambia a pasado 'was'." },
    { type: "multiple_choice", question: "Which sentence uses 'yet' correctly?", options: ["I have yet finished.", "Have you finished yet?", "Yet I finished it.", "I finished it yet."], correctIndex: 1, explanation: "'Yet' se usa en preguntas y negaciones con Present Perfect, siempre al final de la oración." },
  ],
};

app.post("/tutor/exercises", async (req, res) => {
  try {
    const level = String(req.body?.level || "A2").trim().toUpperCase();
    const focusArea = String(req.body?.focusArea || "grammar").trim();
    const objective = String(req.body?.objective || "").trim();
    const weaknesses = Array.isArray(req.body?.weaknesses)
      ? req.body.weaknesses.map((w) => String(w)).filter(Boolean).slice(0, 3)
      : [];
    const count = Math.min(Math.max(Number(req.body?.count) || 5, 3), 8);
    const recentTopics = Array.isArray(req.body?.recentTopics)
      ? req.body.recentTopics.map((t) => String(t)).filter(Boolean).slice(0, 20)
      : [];

    const fallbackKey = ["A1", "A2", "B1"].includes(level) ? level : "A2";
    const fallback = EXERCISES_FALLBACK[fallbackKey].slice(0, count);

    if (!groq) return res.json({ exercises: fallback, source: "fallback" });

    const cefrGuidance = {
      A1: {
        description: "absolute beginner",
        tenses: ["present simple (to be, have, common verbs)", "present simple questions and negatives (do/does)", "imperatives"],
        forbidden: ["past simple", "present perfect", "future forms", "conditionals", "passive voice"],
        vocab: "basic everyday vocabulary only, max 6-7 words per sentence",
      },
      A2: {
        description: "elementary",
        tenses: ["present simple", "past simple (regular and common irregulars)", "present continuous", "'going to' for future plans", "can / could for ability"],
        forbidden: ["present perfect", "past perfect", "conditionals", "passive voice", "reported speech"],
        vocab: "simple everyday contexts, max 10 words per sentence",
      },
      B1: {
        description: "intermediate",
        tenses: ["present perfect (with for/since/ever/never/just/already/yet)", "past continuous", "past simple vs present perfect contrast", "1st conditional (if + present simple, will)", "2nd conditional (if + past simple, would)", "passive voice (present and past simple)", "reported speech (basic backshift)"],
        forbidden: ["3rd conditional", "mixed conditionals", "past perfect continuous", "advanced passive forms"],
        vocab: "familiar topics, moderate sentence complexity",
      },
      B2: {
        description: "upper intermediate",
        tenses: ["past perfect (had + past participle)", "future perfect and future continuous", "3rd conditional (if + past perfect, would have)", "mixed conditionals", "passive voice (all tenses)", "reported speech (full backshift, all reporting verbs)", "wish / if only (unreal situations)"],
        forbidden: ["C1 nominalisation", "highly formal register"],
        vocab: "varied topics, complex sentences allowed",
      },
      C1: {
        description: "advanced",
        tenses: ["all tenses with nuanced use", "inversion for emphasis (Never had I…)", "cleft sentences (It was…that)", "subjunctive (It is essential that he be…)", "advanced passive (have/get something done)", "complex reported speech with modals", "perfect infinitives and gerunds"],
        forbidden: [],
        vocab: "abstract topics, idiomatic language, nominalisation",
      },
    };

    const levelData = cefrGuidance[level] || cefrGuidance["A2"];
    const tensesAllowed = levelData.tenses.join("; ");
    const tensesForbidden = levelData.forbidden.length > 0
      ? `STRICTLY FORBIDDEN tenses/structures for this level: ${levelData.forbidden.join(", ")}.`
      : "";

    const systemPrompt =
      "You are an English grammar exercise generator for Spanish-speaking learners. " +
      "ALL exercise content (questions, sentences, options, answers, hints) MUST be written entirely in ENGLISH. " +
      "The exercises focus on understanding and producing English sentences with correct verb tenses. " +
      "Only the 'explanation' field must be written in SPANISH (1-2 concise sentences explaining the grammar rule). " +
      "For fill_blank exercises, the 'sentence' must be an English sentence with exactly one '___' placeholder. " +
      "For multiple_choice, the 'question' and all 4 'options' must be in English, with only one correct answer. " +
      "Make distractors plausible — reflect common mistakes Spanish speakers make in English. " +
      "You MUST strictly respect the allowed tenses for the student's CEFR level. " +
      "Each exercise must include a short 'topic' field (e.g. 'past simple negative', 'present perfect + for/since') identifying the grammar point targeted. " +
      "Respond ONLY as JSON with key: exercises (array of objects).";

    const userPrompt =
      `Student level: ${level} (${levelData.description})\n` +
      `ALLOWED tenses and structures for this level: ${tensesAllowed}\n` +
      (tensesForbidden ? `${tensesForbidden}\n` : "") +
      `${levelData.vocab}\n` +
      `Focus area: ${focusArea}\n` +
      (objective ? `Lesson objective: "${objective}"\n` : "") +
      (weaknesses.length > 0 ? `Known weaknesses: ${weaknesses.join(", ")}\n` : "") +
      `\nGenerate exactly ${count} exercises. Each must target a DIFFERENT tense or structure from the allowed list. Mix types:\n` +
      `- ${Math.ceil(count * 0.6)} multiple_choice exercises (schema: { type, question, options: string[4], correctIndex: number, explanation: string })\n` +
      `- ${Math.floor(count * 0.4)} fill_blank exercises (schema: { type, sentence: string with '___', correctAnswer: string, hint: string, explanation: string })\n` +
      `Cover as many different allowed tenses as possible across the ${count} exercises.\n` +
      (recentTopics.length > 0
        ? `RECENTLY PRACTICED topics (avoid repeating these): ${recentTopics.join(", ")}.\n`
        : "") +
      `REMINDER: questions, sentences, options, answers and hints must be in ENGLISH. Only explanations in Spanish.`;

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return res.json({ exercises: fallback, source: "fallback" }); }

      const exercises = Array.isArray(parsed.exercises)
        ? parsed.exercises.filter((ex) => {
            if (ex.type === "multiple_choice") {
              return typeof ex.question === "string" &&
                Array.isArray(ex.options) && ex.options.length === 4 &&
                typeof ex.correctIndex === "number" &&
                typeof ex.explanation === "string";
            }
            if (ex.type === "fill_blank") {
              return typeof ex.sentence === "string" &&
                ex.sentence.includes("___") &&
                typeof ex.correctAnswer === "string" &&
                typeof ex.explanation === "string";
            }
            return false;
          }).slice(0, count)
        : [];

      if (exercises.length < 2) return res.json({ exercises: fallback, source: "fallback" });
      return res.json({ exercises, source: "groq" });
    } catch (groqErr) {
      console.error("Exercises generation failed, using fallback", groqErr);
      return res.json({ exercises: fallback, source: "fallback" });
    }
  } catch (error) {
    console.error("Exercises endpoint error", error);
    return res.status(500).json({ error: "exercises_failed" });
  }
});

app.listen(port, () => {
  console.log(`Tutor API running on http://localhost:${port}`);
  console.log(`Provider: Groq | Model: ${model} | API key loaded: ${Boolean(apiKey)}`);
});
