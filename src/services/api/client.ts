import { env } from "../../config/env";
import { Exercise, TopicSuggestion } from "../../types/progress";

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
  currentPhase?: "setup" | "practice";
  currentTopic?: string;
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

export type TranscriptionLanguage = "en" | "es";

export type TranscriptionResult = {
  text: string;
  avgLogprob: number | null;
};

export type TranslationResult = {
  original: string;
  translated: string;
};

export async function transcribeAudio(audioUri: string, language: TranscriptionLanguage = "en"): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);
  formData.append("language", language);

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

export async function transcribeAndTranslate(audioUri: string): Promise<TranslationResult> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/tutor/translate`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw buildNetworkError("Translation request", error);
  }

  if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
  const data = await response.json();
  return { original: data.original as string, translated: data.translated as string };
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

export type StreamTutorCallbacks = {
  onChunk: (text: string) => void;
  onDone: (meta: Omit<TutorMessageResponse, "reply">) => void;
  onError: (err: Error) => void;
};

export async function streamTutorMessage(
  message: string,
  history: TutorChatMessage[],
  learnerProfile: TutorLearnerProfile | undefined,
  callbacks: StreamTutorCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // React Native / Hermes does not support response.body ReadableStream,
  // so we use XMLHttpRequest with onprogress which works reliably on both
  // iOS and Android for SSE-style streaming.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.apiBaseUrl}/tutor/message/stream`);
    xhr.setRequestHeader("Content-Type", "application/json");

    let processedLength = 0;
    let sseBuffer = "";
    let settled = false;

    function processBuffer() {
      const blocks = sseBuffer.split("\n\n");
      sseBuffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const event = JSON.parse(dataLine.slice(6));
          if (event.type === "chunk") {
            callbacks.onChunk(String(event.text ?? ""));
          } else if (event.type === "done") {
            callbacks.onDone({
              suggestedGoal: event.suggestedGoal ?? "",
              correction: event.correction ?? null,
              pronunciationHint: event.pronunciationHint ?? null,
              capturedLevel: event.capturedLevel ?? null,
              capturedName: event.capturedName ?? null,
              phase: event.phase ?? "setup",
              source: event.source ?? "groq",
            });
          } else if (event.type === "error") {
            callbacks.onError(new Error(event.message ?? "Stream error"));
          }
        } catch {
          // malformed event — skip
        }
      }
    }

    xhr.onprogress = () => {
      const newData = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      sseBuffer += newData;
      processBuffer();
    };

    xhr.onload = () => {
      // Flush any remaining data that arrived after the last onprogress
      const remaining = xhr.responseText.slice(processedLength);
      if (remaining) {
        sseBuffer += remaining;
        processBuffer();
      }
      if (!settled) { settled = true; resolve(); }
    };

    xhr.onerror = () => {
      if (!settled) {
        settled = true;
        reject(buildNetworkError("Stream request", new Error("XMLHttpRequest network error")));
      }
    };

    xhr.ontimeout = () => {
      if (!settled) {
        settled = true;
        reject(new Error("Stream request timed out"));
      }
    };

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        if (!settled) { settled = true; resolve(); }
      });
    }

    try {
      xhr.send(JSON.stringify({ message, history, learnerProfile }));
    } catch (err) {
      reject(buildNetworkError("Stream request", err));
    }
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

export type TopicSuggestionsPayload = {
  level?: string;
  name?: string;
  nextClassGoal?: string;
  grammarAccuracy?: number;
  fluencyScore?: number;
  pronunciationScore?: number;
  weaknesses?: string[];
  recentTopics?: string[];
  listeningByAccent?: Record<string, number>;
};

export type TopicSuggestionsResponse = {
  topics: TopicSuggestion[];
  source: "groq" | "fallback";
};

export async function fetchTopicSuggestions(
  payload: TopicSuggestionsPayload,
): Promise<TopicSuggestionsResponse> {
  return apiRequest<TopicSuggestionsResponse>("/tutor/topic-suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type FetchExercisesPayload = {
  level: string;
  focusArea: string;
  objective?: string;
  weaknesses?: string[];
  count?: number;
};

export async function fetchExercises(
  payload: FetchExercisesPayload,
): Promise<{ exercises: Exercise[]; source: "groq" | "fallback" }> {
  return apiRequest<{ exercises: Exercise[]; source: "groq" | "fallback" }>("/tutor/exercises", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
