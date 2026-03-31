import { env } from "../../config/env";

export type TutorChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type TutorLearnerProfile = {
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
  exercise?: string | null;
  pronunciationHint?: string | null;
  phase?: "setup" | "practice";
  source?: "openai" | "gemini" | "groq" | "fallback";
  warning?: string;
};

export async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);

  const response = await fetch(`${env.apiBaseUrl}/tutor/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);
  const data = await response.json();
  return data.text as string;
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
