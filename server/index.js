require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const port = Number(process.env.SERVER_PORT || 3000);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const apiKey = process.env.OPENAI_API_KEY;
const contextWindow = Number(process.env.CHAT_CONTEXT_WINDOW || 8);

const client = apiKey ? new OpenAI({ apiKey }) : null;

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
  res.json({ ok: true, model, hasApiKey: Boolean(apiKey) });
});

app.post("/tutor/message", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const history = sanitizeHistory(req.body?.history);
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    if (!client) {
      return res.json(buildFallbackReply(message));
    }

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an English speaking coach. Reply in simple English. Return strict JSON with keys: reply (string), suggestedGoal (string). Keep it concise and practical.",
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

    return res.json({
      reply: safeReply,
      suggestedGoal: safeGoal,
      source: "openai",
    });
  } catch (error) {
    console.error("Tutor endpoint error", error);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.listen(port, () => {
  console.log(`Tutor API running on http://localhost:${port}`);
  console.log(`Model configured: ${model}`);
});
