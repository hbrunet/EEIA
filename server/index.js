require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const app = express();
const port = Number(process.env.SERVER_PORT || 3000);
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
    if (!message) {
      return res.status(400).json({ error: "message is required" });
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
              "Your conversation has two phases:\n\n" +

              "PHASE 1 - SETUP:\n" +
              "Applies when the conversation history has no established level or topic yet.\n" +
              "- Greet the student warmly IN SPANISH.\n" +
              "- Ask their English level using these options: 'nunca estudié inglés / recién empiezo', 'básico', 'intermedio' or 'avanzado'.\n" +
              "- Ask what topic or situation they want to practice. For beginners or children, suggest simple options like: colores, animales, números, saludos, la familia, el cuerpo, objetos del aula.\n" +
              "- Once you have BOTH level and topic from the student, confirm in Spanish and announce you will now begin.\n" +
              "- Set phase to 'setup'.\n\n" +

              "PHASE 2 - PRACTICE:\n" +
              "Applies once level and topic are established in the history.\n" +
              "IMPORTANT: adapt everything to the student's level:\n" +
              "- For 'nunca estudié / recién empiezo' (beginners, may be children): stay mostly IN SPANISH, introduce single English words or very short phrases, use encouraging and playful language, keep it very simple and fun. Never switch fully to English until they are ready.\n" +
              "- For 'básico': mix Spanish explanations with short English sentences. Introduce simple structures.\n" +
              "- For 'intermedio' or 'avanzado': conduct the conversation fully IN ENGLISH at the appropriate level.\n" +
              "- Act as their conversation partner and guide on the chosen topic.\n" +
              "- IMPORTANT: If the student writes in Spanish (or mixes Spanish and English), DO NOT switch to Spanish yourself. Instead, gently acknowledge what they said, respond in English, and encourage them to try saying it in English. You can briefly hint at the English word they were missing if needed, but always keep YOUR response in English and stay in coach mode.\n" +
              "- If the student makes a WRITING error (typo, spelling), explain IN SPANISH and set correction.\n" +
              "- If the student makes a GRAMMAR error (wrong tense, structure, agreement), explain IN SPANISH and set correction.\n" +
              "- If the student makes a PRAGMATIC error (wrong register, culturally odd phrase, awkward wording for the context), explain IN SPANISH and set correction.\n" +
              "- For beginners and children, only correct one error at a time and always celebrate effort before correcting.\n" +
              "- If there are no errors, set correction to null.\n" +
              "- Propose a short actionable exercise IN SPANISH only when relevant (not every turn). Keep exercises simple and playful for beginners. Set exercise to null otherwise.\n" +
              "- Set phase to 'practice'.\n\n" +

              "Respond ONLY with a valid JSON object with these keys:\n" +
              "- reply (string): your response.\n" +
              "- correction (string or null): correction explanation in Spanish, or null.\n" +
              "- exercise (string or null): proposed exercise in Spanish, or null.\n" +
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

      const safeReply = typeof parsed.reply === "string" ? parsed.reply : buildFallbackReply(message).reply;
      const safeGoal =
        typeof parsed.suggestedGoal === "string"
          ? parsed.suggestedGoal
          : buildFallbackReply(message).suggestedGoal;
      const correction = typeof parsed.correction === "string" && parsed.correction.toLowerCase() !== "null" ? parsed.correction : null;
      const exercise = typeof parsed.exercise === "string" && parsed.exercise.toLowerCase() !== "null" ? parsed.exercise : null;
      const pronunciationHint = typeof parsed.pronunciationHint === "string" && parsed.pronunciationHint.toLowerCase() !== "null" ? parsed.pronunciationHint : null;
      // If the conversation already has history (level+topic established), never revert to setup
      const phase = (parsed.phase === "practice" || history.length >= 4) ? "practice" : "setup";

      return res.json({
        reply: safeReply,
        suggestedGoal: safeGoal,
        correction,
        exercise,
        pronunciationHint,
        phase,
        source: "groq",
      });
    } catch (groqError) {
      console.error("Groq request failed, using fallback", groqError);
      return res.json({ ...buildFallbackReply(message), warning: groqError.message });
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
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
    });
    res.json({ text: transcription.text });
  } catch (err) {
    console.error("Whisper transcription failed", err);
    res.status(500).json({ error: "transcription_failed", detail: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.listen(port, () => {
  console.log(`Tutor API running on http://localhost:${port}`);
  console.log(`Provider: Groq | Model: ${model} | API key loaded: ${Boolean(apiKey)}`);
});
