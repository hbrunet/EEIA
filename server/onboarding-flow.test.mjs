import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

const TEST_PORT = 3199;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const SERVER_ENTRY = path.resolve(process.cwd(), "server/index.js");

let serverProcess;

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function waitForServerReady(timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error("Server did not become ready in time");
}

async function sendTutorMessage({ message, history = [], learnerProfile = null }) {
  const response = await fetch(`${BASE_URL}/tutor/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, learnerProfile }),
  });

  assert.equal(response.status, 200);
  return response.json();
}

describe("onboarding flow", () => {
  before(async () => {
    serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
      env: {
        ...process.env,
        SERVER_PORT: String(TEST_PORT),
        GROQ_API_KEY: "", // Force fallback-compatible deterministic setup branch.
      },
      stdio: "ignore",
    });

    await waitForServerReady();
  });

  after(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
  });

  it("asks only for name when profile is empty", async () => {
    const result = await sendTutorMessage({
      message: "hola",
      history: [],
      learnerProfile: {
        name: "",
        level: "",
      },
    });

    assert.equal(result.phase, "setup");
    assert.match(normalize(result.reply), /decime tu nombre/i);
    assert.equal(result.capturedName, null);
    assert.equal(result.capturedLevel, null);
  });

  it("captures short name and then asks level only", async () => {
    const firstAssistantReply = "Antes de seguir, decime tu nombre para personalizar la práctica 🙂";

    const result = await sendTutorMessage({
      message: "Juan",
      history: [
        { role: "user", text: "hola" },
        { role: "assistant", text: firstAssistantReply },
      ],
      learnerProfile: {
        name: "",
        level: "",
      },
    });

    assert.equal(result.phase, "setup");
    assert.equal(result.capturedName, "Juan");
    assert.match(normalize(result.reply), /nivel de ingles/i);
  });

  it("captures level and then asks topic", async () => {
    const result = await sendTutorMessage({
      message: "intermedio",
      history: [
        { role: "user", text: "hola" },
        { role: "assistant", text: "Antes de seguir, decime tu nombre para personalizar la práctica 🙂" },
        { role: "user", text: "Juan" },
        {
          role: "assistant",
          text: "Gracias. Ahora decime tu nivel de inglés para adaptar la clase. Podés responder: nunca estudié/recién empiezo, básico, intermedio o avanzado.",
        },
      ],
      learnerProfile: {
        name: "Juan",
        level: "",
      },
    });

    assert.equal(result.phase, "setup");
    assert.equal(result.capturedLevel, "B1");
    assert.match(normalize(result.reply), /tema te gustaria practicar/i);
  });
});
