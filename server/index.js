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
const contextWindow = Number(process.env.CHAT_CONTEXT_WINDOW || 8);

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

app.get("/health", (_req, res) => {
  res.json({ ok: true, model, provider: "groq", hasApiKey: Boolean(apiKey) });
});

app.post("/tutor/message", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const history = sanitizeHistory(req.body?.history);
    const learnerProfile = req.body?.learnerProfile && typeof req.body.learnerProfile === "object"
      ? req.body.learnerProfile
      : null;
    const hasConfiguredLevel = typeof learnerProfile?.level === "string" && learnerProfile.level.trim().length > 0;
    const hasConfiguredName = typeof learnerProfile?.name === "string" && learnerProfile.name.trim().length > 0;
    const isInPracticePhase = learnerProfile?.currentPhase === "practice";
    const currentTopic = typeof learnerProfile?.currentTopic === "string" && learnerProfile.currentTopic.trim().length > 0
      ? learnerProfile.currentTopic.trim()
      : null;
    const normalizedLearnerStage = normalizeLearnerStage(learnerProfile?.level);
    const capturedLevel = !hasConfiguredLevel ? inferCefrLevelFromMessage(message) : null;
    const capturedName = !hasConfiguredName
      ? inferNameFromMessage(message) || (didAssistantRecentlyAskName(history) ? inferShortNameFromMessage(message) : null)
      : null;
    const hasLevelAfterMessage = hasConfiguredLevel || Boolean(capturedLevel);
    const hasNameAfterMessage = hasConfiguredName || Boolean(capturedName);
    const shouldAskNameOnly = !hasNameAfterMessage;
    const shouldAskLevelOnly = !shouldAskNameOnly && !hasLevelAfterMessage;
    const shouldAskTopicOnly = !shouldAskNameOnly && !shouldAskLevelOnly && !hasConfiguredLevel && Boolean(capturedLevel);
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    if (shouldAskNameOnly) {
      return res.json({ ...buildNameOnlySetupReply(), capturedLevel, capturedName, source: groq ? "groq" : "fallback" });
    }
    if (shouldAskLevelOnly) {
      return res.json({ ...buildLevelOnlySetupReply(), capturedLevel, capturedName, source: groq ? "groq" : "fallback" });
    }
    if (shouldAskTopicOnly) {
      return res.json({ ...buildTopicOnlySetupReply(), capturedLevel, capturedName, source: groq ? "groq" : "fallback" });
    }

    if (!groq) {
      return res.json(buildFallbackReply(message));
    }

    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a friendly English coach for Spanish-speaking students of ALL ages, including young children who are just starting or want to start learning English.\n" +
              (learnerProfile ? (
                "\nSTUDENT PROFILE (use this to personalize your coaching):\n" +
                (learnerProfile.level ? `- Declared level: ${learnerProfile.level}\n` : "") +
                (normalizedLearnerStage?.stage ? `- Normalized level category: ${normalizedLearnerStage.stage} (${normalizedLearnerStage.sourceLevel}, ${normalizedLearnerStage.guidance})\n` : "") +
                (typeof learnerProfile.grammarAccuracy === "number" ? `- Grammar accuracy: ${learnerProfile.grammarAccuracy}% — ${
                  learnerProfile.grammarAccuracy < 50 ? "needs significant grammar work" :
                  learnerProfile.grammarAccuracy < 75 ? "grammar is developing, reinforce structure" :
                  "grammar is solid, focus on fluency and nuance"}\n` : "") +
                (typeof learnerProfile.fluencyScore === "number" ? `- Fluency score: ${learnerProfile.fluencyScore}/10 — ${
                  learnerProfile.fluencyScore < 4 ? "encourage longer responses, don't rush" :
                  learnerProfile.fluencyScore < 7 ? "push for more complex sentence structures" :
                  "fluency is good, challenge with faster pacing and idioms"}\n` : "") +
                (Array.isArray(learnerProfile.weaknesses) && learnerProfile.weaknesses.length > 0
                  ? `- Main weaknesses to target: ${learnerProfile.weaknesses.map((w) => `${w.detail} (${w.area}, priority ${w.severity}/5)`).join("; ")}\n`
                  : "") +
                (Array.isArray(learnerProfile.goals) && learnerProfile.goals.length > 0
                  ? `- Student goals: ${learnerProfile.goals.join(", ")}\n`
                  : "") +
                "Use this profile to: adjust difficulty, focus corrections on their weak areas, prioritize their goals, and propose exercises that target their specific weaknesses.\n"
              ) : "") +
              (isInPracticePhase
                ? "⚠️ SESSION STATE: The student is ALREADY IN PRACTICE PHASE. " +
                  (currentTopic ? `The established practice topic is: "${currentTopic}". ` : "") +
                  "DO NOT restart or reset the conversation. DO NOT greet the student as if they just arrived. DO NOT ask for their name or level again. " +
                  "Continue the practice conversation naturally from where it left off. " +
                  "The conversation history provided may be truncated (only the most recent messages), but the session has been ongoing — assume level and topic are already established.\n\n"
                : (hasConfiguredName && hasConfiguredLevel && history.length === 0)
                  ? "⚠️ SESSION STATE: The student's name and level are already configured in their profile. " +
                    "This is the START of a new practice session and the student's message IS their chosen topic. " +
                    "DO NOT greet them as if they just arrived. DO NOT say 'me alegra verte' or similar welcome phrases. DO NOT ask for name or level again. " +
                    "Acknowledge the topic briefly (one short sentence in Spanish) and IMMEDIATELY begin the practice exercise. Set phase to 'practice'.\n\n"
                  : "") +
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

              "Respond ONLY with a valid JSON object with these keys:\n" +
              "- reply (string): your response.\n" +
              "- correction (string or null): correction explanation in Spanish, or null.\n" +
              "- pronunciationHint (string or null): if the student used a word with tricky pronunciation, provide a brief phonetic hint IN SPANISH (e.g. 'though' → /ðoʊ/, la 'th' es sonora). Set to null otherwise.\n" +
              "- suggestedGoal (string): short learning goal based on this exchange, written IN SPANISH.\n" +
              "- phase (string): 'setup' or 'practice'.\n" +
              "Always be patient, warm, encouraging and fun. Never be harsh. Adapt your tone to the student's age and level.",
          },
          {
            role: "user",
            content:
              `Conversation context: ${JSON.stringify(history)}\n` +
              `Latest student message: ${message}`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = buildFallbackReply(message);
      }

      const modelReply = typeof parsed.reply === "string" ? parsed.reply : buildFallbackReply(message).reply;
      const modelGoal =
        typeof parsed.suggestedGoal === "string"
          ? parsed.suggestedGoal
          : buildFallbackReply(message).suggestedGoal;
      const safeReply = modelReply;
      const safeGoal = modelGoal;
      const correction = typeof parsed.correction === "string" && parsed.correction.toLowerCase() !== "null" ? parsed.correction : null;
      const pronunciationHint = typeof parsed.pronunciationHint === "string" && parsed.pronunciationHint.toLowerCase() !== "null" ? parsed.pronunciationHint : null;
      // Keep setup until both name and level are captured/configured.
      const phase = isInPracticePhase
        ? "practice"
        : (parsed.phase === "practice" && hasLevelAfterMessage && hasNameAfterMessage)
          ? "practice"
          : (hasConfiguredName && hasConfiguredLevel && history.length === 0)
            ? "practice"
            : "setup";

      return res.json({
        reply: safeReply,
        suggestedGoal: safeGoal,
        correction,
        pronunciationHint,
        capturedLevel,
        capturedName,
        phase,
        source: "groq",
      });
    } catch (groqError) {
      console.error("Groq request failed, using fallback", groqError);
      return res.json({ ...buildFallbackReply(message), capturedLevel, capturedName, warning: groqError.message });
    }
  } catch (error) {
    console.error("Tutor endpoint error", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.post("/tutor/transcribe", upload.single("audio"), async (req, res) => {
  if (!groq) return res.status(503).json({ error: "groq_not_configured" });
  if (!req.file) return res.status(400).json({ error: "audio file required" });

  try {
    const requestedLanguage = String(req.body?.language || "").trim().toLowerCase();
    const language = requestedLanguage === "en" || requestedLanguage === "es" ? requestedLanguage : undefined;
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      ...(language ? { language } : {}),
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

app.listen(port, () => {
  console.log(`Tutor API running on http://localhost:${port}`);
  console.log(`Provider: Groq | Model: ${model} | API key loaded: ${Boolean(apiKey)}`);
});
