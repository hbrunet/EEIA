export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  correctionHint?: string;
  correctionExpanded?: boolean;
};

export type SpeechRate = "normal" | "slow";

export const SPEECH_RATE_VALUE: Record<SpeechRate, number> = { normal: 0.95, slow: 0.65 };
export const SPEECH_RATE_LABEL: Record<SpeechRate, string> = { normal: "Normal", slow: "Lento" };
