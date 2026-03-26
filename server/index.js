require("dotenv").config();

const express = require("express");
const cors = require("cors");
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
              "- suggestedGoal (string): short learning goal based on this exchange.\n" +
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
      const phase = parsed.phase === "practice" ? "practice" : "setup";

      return res.json({
        reply: safeReply,
        suggestedGoal: safeGoal,
        correction,
        exercise,
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

app.listen(port, () => {
  console.log(`Tutor API running on http://localhost:${port}`);
  console.log(`Provider: Groq | Model: ${model} | API key loaded: ${Boolean(apiKey)}`);
});
