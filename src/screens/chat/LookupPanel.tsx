import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { TutorLookupResponse } from "../../services/api/client";
import { theme } from "../../ui/theme";
import { styles } from "../ChatScreen.styles";

type Props = {
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

export function LookupPanel({
  recentLookups,
  onClearHistory,
  onClose,
  lookupQuery,
  onQueryChange,
  onSearch,
  lookupLoading,
  lookupError,
  lookupResult,
  onHistoryItemPress,
}: Props) {
  return (
    <View style={styles.lookupPanel}>
      <View style={styles.lookupPanelHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.lookupHistoryScroll}
          keyboardShouldPersistTaps="handled"
        >
          {recentLookups.map((term) => (
            <Pressable
              key={`rh-${term}`}
              style={styles.lookupHistoryChip}
              onPress={() => onHistoryItemPress(term)}
            >
              <Text style={styles.lookupHistoryChipText}>{term}</Text>
            </Pressable>
          ))}
          {recentLookups.length > 0 && (
            <Pressable style={styles.lookupClearChip} onPress={onClearHistory}>
              <Text style={styles.lookupClearChipText}>Limpiar</Text>
            </Pressable>
          )}
        </ScrollView>
        <Pressable style={styles.lookupCloseBtn} onPress={onClose}>
          <Text style={styles.lookupCloseBtnText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.lookupInputRow}>
        <TextInput
          value={lookupQuery}
          onChangeText={onQueryChange}
          placeholder="Palabra o frase..."
          placeholderTextColor={theme.colors.muted}
          style={styles.lookupInput}
          returnKeyType="search"
          onSubmitEditing={() => { if (lookupQuery.trim()) onSearch(); }}
        />
        <Pressable
          style={[styles.lookupButton, (!lookupQuery.trim() || lookupLoading) && styles.buttonDisabled]}
          disabled={!lookupQuery.trim() || lookupLoading}
          onPress={onSearch}
        >
          <Text style={styles.lookupButtonText}>{lookupLoading ? "⏳" : "Buscar"}</Text>
        </Pressable>
      </View>

      {lookupError && <Text style={styles.lookupErrorText}>{lookupError}</Text>}
      {lookupResult && (
        <View style={styles.lookupResult}>
          <View style={styles.lookupResultRow}>
            <Text style={styles.lookupWord}>{lookupResult.term}</Text>
            <Text style={styles.lookupTranslation}>{lookupResult.translation}</Text>
          </View>
          <Text style={styles.lookupExample} numberOfLines={2}>
            Ej: {lookupResult.example}
          </Text>
        </View>
      )}
    </View>
  );
}
