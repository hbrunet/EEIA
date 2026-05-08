import { Linking, Pressable, Text, View } from "react-native";
import { styles } from "../ChatScreen.styles";
import { ChatMessage, SpeechRate, SPEECH_RATE_LABEL } from "./types";
import { cleanLookupToken, isLikelySpanish } from "./utils";

const URL_REGEX = /https?:\/\/[^\s)>\]"']+/;

/** Split text into alternating non-URL / URL segments */
function splitWithUrls(text: string): Array<{ type: "text" | "url"; value: string }> {
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  let remaining = text;
  while (remaining.length > 0) {
    const match = remaining.match(URL_REGEX);
    if (!match || match.index === undefined) {
      parts.push({ type: "text", value: remaining });
      break;
    }
    if (match.index > 0) {
      parts.push({ type: "text", value: remaining.slice(0, match.index) });
    }
    parts.push({ type: "url", value: match[0] });
    remaining = remaining.slice(match.index + match[0].length);
  }
  return parts;
}

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
            {splitWithUrls(item.text).map((segment, si) => {
              if (segment.type === "url") {
                return (
                  <Text
                    key={`${item.id}-url-${si}`}
                    style={styles.linkText}
                    onPress={() => Linking.openURL(segment.value)}
                  >
                    {segment.value}
                  </Text>
                );
              }
              return segment.value.split(/(\s+)/).map((part, wi) => {
                const cleaned = cleanLookupToken(part);
                if (!cleaned || isLikelySpanish(cleaned)) {
                  return <Text key={`${item.id}-${si}-${wi}`}>{part}</Text>;
                }
                return (
                  <Text
                    key={`${item.id}-${si}-${wi}`}
                    style={styles.lookupInlineWord}
                    onPress={() => onWordPress(part)}
                  >
                    {part}
                  </Text>
                );
              });
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
