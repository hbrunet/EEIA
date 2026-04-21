import { env } from "../../config/env";

export type TutorChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function buildNetworkError(action: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${action} failed. Verify that the backend is reachable at ${env.apiBaseUrl}. Original error: ${error.message}`);
  }

  return new Error(`${action} failed. Verify that the backend is reachable at ${env.apiBaseUrl}.`);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      ...init,
    });
  } catch (error) {
    throw buildNetworkError("API request", error);
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type TutorLearnerProfile = {
  name?: string;
  level?: string;
  grammarAccuracy?: number;
  fluencyScore?: number;
  pronunciationScore?: number;
  weaknesses?: Array<{ area: string; detail: string; severity: number }>;
  goals?: string[];
};

export type TutorMessageResponse = {
  reply: string;
  suggestedGoal: string;
  correction?: string | null;
  pronunciationHint?: string | null;
  capturedLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | null;
  capturedName?: string | null;
  phase?: "setup" | "practice";
  source?: "openai" | "gemini" | "groq" | "fallback";
  warning?: string;
};

export type PronunciationAssessmentResponse = {
  transcript: string;
  accuracyScore: number;
  targetWords: string[];
  transcriptWords: string[];
  missedWords: string[];
  extraWords: string[];
  summary: string;
  strengths: string[];
  improvements: string[];
  practiceTip: string;
  source?: "groq" | "fallback";
};

export type TutorLookupResponse = {
  term: string;
  translation: string;
  explanation: string;
  example: string;
  pronunciation?: string | null;
  source?: "groq" | "fallback";
};

export type TranscriptionLanguage = "auto" | "en" | "es";

export type TranscriptionResult = {
  text: string;
  avgLogprob: number | null;
};

export async function transcribeAudio(audioUri: string, language: TranscriptionLanguage = "auto"): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);
  if (language !== "auto") {
    formData.append("language", language);
  }

  let response: Response;

  try {
    response = await fetch(`${env.apiBaseUrl}/tutor/transcribe`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw buildNetworkError("Transcription request", error);
  }

  if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);
  const data = await response.json();
  return { text: data.text as string, avgLogprob: typeof data.avgLogprob === "number" ? data.avgLogprob : null };
}

export async function assessPronunciation(
  audioUri: string,
  targetText: string,
  accent: string,
): Promise<PronunciationAssessmentResponse> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: "pronunciation.m4a",
  } as any);
  formData.append("targetText", targetText);
  formData.append("accent", accent);

  let response: Response;

  try {
    response = await fetch(`${env.apiBaseUrl}/tutor/pronunciation`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw buildNetworkError("Pronunciation assessment", error);
  }

  if (!response.ok) {
    throw new Error(`Pronunciation assessment failed: ${response.status}`);
  }

  return (await response.json()) as PronunciationAssessmentResponse;
}

export async function postTutorMessage(
  message: string,
  history: TutorChatMessage[],
  learnerProfile?: TutorLearnerProfile,
): Promise<TutorMessageResponse> {
  return apiRequest<TutorMessageResponse>("/tutor/message", {
    method: "POST",
    body: JSON.stringify({ message, history, learnerProfile }),
  });
}

export async function fetchShadowingPhrases(
  level: "básico" | "intermedio" | "avanzado",
  count = 12,
  exclude: string[] = [],
): Promise<string[]> {
  const data = await apiRequest<{ phrases: string[] }>("/tutor/shadowing-phrases", {
    method: "POST",
    body: JSON.stringify({ level, count, exclude }),
  });
  return Array.isArray(data.phrases) && data.phrases.length > 0 ? data.phrases : [];
}

export async function lookupTutorTerm(
  term: string,
  learnerLevel?: string,
): Promise<TutorLookupResponse> {
  return apiRequest<TutorLookupResponse>("/tutor/lookup", {
    method: "POST",
    body: JSON.stringify({ term, learnerLevel }),
  });
}
