import { Pressable, Text, View } from "react-native";
import { styles } from "../ChatScreen.styles";
import { ChatMessage, SpeechRate, SPEECH_RATE_LABEL } from "./types";
import { cleanLookupToken, isLikelySpanish } from "./utils";

type Props = {
  item: ChatMessage;
  speakingMessageId: string | null;
  speechRate: SpeechRate;
  onSpeak: (id: string, text: string) => void;
  onChangeSpeechRate: (rate: SpeechRate) => void;
  onToggleCorrection: (id: string) => void;
  onWordPress: (word: string) => void;
};

export function ChatBubble({ item, speakingMessageId, speechRate, onSpeak, onChangeSpeechRate, onToggleCorrection, onWordPress }: Props) {
  return (
    <View style={[styles.bubble, item.role === "assistant" ? styles.assistantBubble : styles.userBubble]}>
      {item.role === "assistant" ? (
        <>
          <Text style={styles.bubbleText}>
            {item.text.split(/(\s+)/).map((part, index) => {
              const cleaned = cleanLookupToken(part);
              if (!cleaned || isLikelySpanish(cleaned)) {
                return <Text key={`${item.id}-${index}`}>{part}</Text>;
              }
              return (
                <Text
                  key={`${item.id}-${index}`}
                  style={styles.lookupInlineWord}
                  onPress={() => onWordPress(part)}
                >
                  {part}
                </Text>
              );
            })}
          </Text>
          <View style={styles.listenMessageRow}>
            <Pressable
              style={[styles.listenMessageBtn, speakingMessageId === item.id && styles.listenMessageBtnActive]}
              onPress={() => onSpeak(item.id, item.text)}
            >
              <Text style={styles.listenMessageBtnText}>
                {speakingMessageId === item.id ? "Detener audio" : "Escuchar mensaje"}
              </Text>
            </Pressable>
            {(["normal", "slow"] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.speechRateChip, speechRate === r && styles.speechRateChipActive]}
                onPress={() => onChangeSpeechRate(r)}
              >
                <Text style={[styles.speechRateChipText, speechRate === r && styles.speechRateChipTextActive]}>
                  {SPEECH_RATE_LABEL[r]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.bubbleText}>{item.text}</Text>
          {item.correctionHint && (
            <View style={styles.correctionHintWrap}>
              <Pressable
                style={[styles.correctionHintChip, item.correctionExpanded && styles.correctionHintChipActive]}
                onPress={() => onToggleCorrection(item.id)}
              >
                <Text style={styles.correctionHintChipText}>
                  {item.correctionExpanded ? "Ocultar corrección" : "Ver corrección"}
                </Text>
              </Pressable>
              {item.correctionExpanded && (
                <View style={styles.correctionHintPanel}>
                  <Text style={styles.correctionHintTitle}>Sugerencia del tutor</Text>
                  <Text style={styles.correctionHintText}>{item.correctionHint}</Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}
