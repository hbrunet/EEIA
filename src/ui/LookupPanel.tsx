import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { TutorLookupResponse } from "../services/api/client";
import { theme } from "./theme";

// ─── Panel mode ───────────────────────────────────────────────────────────────
// Full dictionary panel (search input + history) shown at the bottom of the
// screen. Used by ChatScreen.
type PanelProps = {
  mode: "panel";
  recentLookups: string[];
  onClearHistory: () => void;
  onClose: () => void;
  lookupQuery: string;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  lookupLoading: boolean;
  lookupError: string | null;
  lookupResult: TutorLookupResponse | null;
  onHistoryItemPress: (term: string) => void;
};

// ─── Inline mode ──────────────────────────────────────────────────────────────
// Compact result card shown inline below tapped text (no search input).
// Used by TappableText.
type InlineProps = {
  mode: "inline";
  word: string;
  onClose: () => void;
  lookupLoading: boolean;
  lookupError: string | null;
  lookupResult: TutorLookupResponse | null;
};

type Props = PanelProps | InlineProps;

// ─── Shared result body ───────────────────────────────────────────────────────
function LookupResult({
  loading,
  error,
  result,
}: {
  loading: boolean;
  error: string | null;
  result: TutorLookupResponse | null;
}) {
  if (loading) {
    return <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: 6 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }
  if (!result) return null;
  return (
    <View style={styles.resultBody}>
      <Text style={styles.translation}>{result.translation}</Text>
      <Text style={styles.explanation}>{result.explanation}</Text>
      {result.example ? (
        <Text style={styles.example}>"{result.example}"</Text>
      ) : null}
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function LookupPanel(props: Props) {
  if (props.mode === "inline") {
    return (
      <View style={styles.inlineCard}>
        <View style={styles.inlineHeader}>
          <Text style={styles.inlineWord}>{props.word}</Text>
          <Pressable onPress={props.onClose} hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <LookupResult
          loading={props.lookupLoading}
          error={props.lookupError}
          result={props.lookupResult}
        />
      </View>
    );
  }

  // mode === "panel"
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyScroll}
          keyboardShouldPersistTaps="handled"
        >
          {props.recentLookups.map((term) => (
            <Pressable
              key={`rh-${term}`}
              style={styles.historyChip}
              onPress={() => props.onHistoryItemPress(term)}
            >
              <Text style={styles.historyChipText}>{term}</Text>
            </Pressable>
          ))}
          {props.recentLookups.length > 0 && (
            <Pressable style={styles.clearChip} onPress={props.onClearHistory}>
              <Text style={styles.clearChipText}>Limpiar</Text>
            </Pressable>
          )}
        </ScrollView>
        <Pressable style={styles.panelCloseBtn} onPress={props.onClose}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={props.lookupQuery}
          onChangeText={props.onQueryChange}
          placeholder="Palabra o frase..."
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => { if (props.lookupQuery.trim()) props.onSearch(); }}
        />
        <Pressable
          style={[
            styles.searchBtn,
            (!props.lookupQuery.trim() || props.lookupLoading) && styles.searchBtnDisabled,
          ]}
          disabled={!props.lookupQuery.trim() || props.lookupLoading}
          onPress={props.onSearch}
        >
          <Text style={styles.searchBtnText}>{props.lookupLoading ? "⏳" : "Buscar"}</Text>
        </Pressable>
      </View>

      {props.lookupError && <Text style={styles.error}>{props.lookupError}</Text>}
      {props.lookupResult && (
        <View style={styles.panelResult}>
          <View style={styles.panelResultRow}>
            <Text style={styles.panelWord}>{props.lookupResult.term}</Text>
            <Text style={styles.translation}>{props.lookupResult.translation}</Text>
          </View>
          <Text style={styles.explanation} numberOfLines={3}>{props.lookupResult.explanation}</Text>
          {props.lookupResult.example ? (
            <Text style={styles.example} numberOfLines={2}>"{props.lookupResult.example}"</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Shared ──────────────────────────────────────────────────
  closeText: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
  translation: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  explanation: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  example: {
    color: theme.colors.text,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 17,
  },
  error: {
    color: "#b00020",
    fontSize: 12,
    marginTop: 4,
  },
  resultBody: {
    gap: 3,
    marginTop: 4,
  },

  // ── Inline card ─────────────────────────────────────────────
  inlineCard: {
    marginTop: 14,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.accent + "55",
  },
  inlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  inlineWord: {
    fontWeight: "700",
    fontSize: 15,
    color: theme.colors.accent,
  },

  // ── Panel ───────────────────────────────────────────────────
  panel: {
    backgroundColor: theme.colors.panel,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyScroll: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingRight: 4,
  },
  historyChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  historyChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  clearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearChipText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  panelCloseBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 13,
  },
  searchBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  searchBtnDisabled: {
    opacity: 0.45,
  },
  searchBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  panelResult: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  panelResultRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  panelWord: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
