import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextStyle, View } from "react-native";
import { lookupTutorTerm, TutorLookupResponse } from "../services/api/client";
import { LookupPanel } from "./LookupPanel";
import { theme } from "./theme";

const URL_REGEX = /https?:\/\/[^\s)>\]"']+/;

type Props = {
  /** English text to display word-by-word with tap-to-lookup. */
  text: string;
  /** Style applied to the outer Text wrapper (font size, weight, color…). */
  style?: TextStyle;
  /** Learner CEFR level forwarded to the lookup API for context-aware definitions. */
  level?: string;
  /**
   * Pass any value that changes when the content changes (e.g. exerciseIdx).
   * React will remount the component and clear lookup state automatically.
   */
  resetKey?: string | number;
  /** If provided, words for which this returns true are rendered as plain non-tappable text. */
  skipWord?: (word: string) => boolean;
  /** Called after a word is successfully looked up (useful for recording lookup history). */
  onLookup?: (term: string) => void;
  /**
   * When provided, word taps call this callback instead of showing the inline lookup card.
   * Useful when the parent wants to handle lookup in a custom panel (e.g. ChatScreen).
   */
  onWordPress?: (word: string) => void;
};

/**
 * Renders English text where every word is individually tappable.
 * Tapping a word calls the /tutor/lookup API and shows an inline
 * translation + explanation card below the text.
 *
 * Usage:
 *   <TappableText text={question} style={styles.heading} level="B1" resetKey={idx} />
 */
export function TappableText({ text, style, level, resetKey, skipWord, onLookup, onWordPress }: Props) {
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<TutorLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function onWordPressInternal(raw: string) {
    const word = raw.replace(/[^a-zA-Z'-]/g, "").toLowerCase();
    if (!word || word.length < 2) return;
    // If parent provides its own handler, delegate and skip inline card
    if (onWordPress) {
      onWordPress(word);
      return;
    }
    // Toggle: tap same word again to close
    if (word === lookupWord) {
      setLookupWord(null);
      setLookupResult(null);
      return;
    }
    setLookupWord(word);
    setLookupResult(null);
    setLookupError(null);
    setLookupLoading(true);
    try {
      const result = await lookupTutorTerm(word, level);
      setLookupResult(result);
      onLookup?.(word);
    } catch {
      setLookupError("No se pudo buscar la palabra.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    // key on View resets all state when resetKey changes
    <View key={resetKey}>
      <Text style={style}>
        {text.split(/(\s+)/).map((chunk, i) => {
          if (/^\s+$/.test(chunk)) return chunk;
          // Render URLs as tappable links, not dictionary lookups
          if (URL_REGEX.test(chunk)) {
            return (
              <Text key={i} style={styles.urlLink} onPress={() => Linking.openURL(chunk)}>
                {chunk}
              </Text>
            );
          }
          const cleaned = chunk.replace(/[^a-zA-Z'-]/g, "").toLowerCase();
          if (!cleaned || cleaned.length < 2 || skipWord?.(cleaned)) {
            return <Text key={i}>{chunk}</Text>;
          }
          const isActive = cleaned === lookupWord;
          return (
            <Text
              key={i}
              style={isActive ? styles.wordActive : styles.word}
              onPress={() => onWordPressInternal(chunk)}
            >
              {chunk}
            </Text>
          );
        })}
      </Text>

      {/* Only show inline card when using internal lookup (no onWordPress override) */}
      {!onWordPress && lookupWord && (
        <LookupPanel
          mode="inline"
          word={lookupWord}
          onClose={() => { setLookupWord(null); setLookupResult(null); }}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
          lookupResult={lookupResult}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  word: {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor: theme.colors.accent,
  },
  wordActive: {
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textDecorationColor: theme.colors.accent,
    color: theme.colors.accent,
    fontWeight: "600",
  },
  urlLink: {
    color: theme.colors.accent,
    textDecorationLine: "underline",
  },
});
