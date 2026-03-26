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

export type TutorMessageResponse = {
  reply: string;
  suggestedGoal: string;
  correction?: string | null;
  exercise?: string | null;
  phase?: "setup" | "practice";
  source?: "openai" | "gemini" | "groq" | "fallback";
  warning?: string;
};

export async function postTutorMessage(
  message: string,
  history: TutorChatMessage[],
): Promise<TutorMessageResponse> {
  return apiRequest<TutorMessageResponse>("/tutor/message", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
