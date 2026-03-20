import * as Speech from "expo-speech";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { Accent } from "../types/progress";
import { theme } from "../ui/theme";

const accents: Accent[] = ["US", "UK", "AU", "CA"];
const localeByAccent: Record<Accent, string> = {
  US: "en-US",
  UK: "en-GB",
  AU: "en-AU",
  CA: "en-CA",
};
const sampleLine = "Could you tell me how to improve my speaking confidence in meetings?";

export function AccentsScreen() {
  const { progress, boostListening } = useAppState();

  function playAccent(accent: Accent) {
    Speech.speak(sampleLine, {
      language: localeByAccent[accent],
      rate: 0.95,
      pitch: 1,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accent Lab</Text>
      <Text style={styles.helper}>Tap Listen to hear a sample in that accent, then tap +Progress after your practice.</Text>
      <View style={styles.grid}>
        {accents.map((accent) => (
          <View key={accent} style={styles.accentCard}>
            <Text style={styles.accentName}>{accent}</Text>
            <Text style={styles.score}>{progress?.metrics.listeningByAccent[accent]}%</Text>

            <Pressable style={styles.listenButton} onPress={() => playAccent(accent)}>
              <Text style={styles.listenButtonText}>Listen</Text>
            </Pressable>

            <Pressable style={styles.progressButton} onPress={() => boostListening(accent)}>
              <Text style={styles.progressButtonText}>+Progress</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
  },
  helper: {
    color: theme.colors.muted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  accentCard: {
    width: "47%",
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  listenButton: {
    marginTop: 10,
    backgroundColor: theme.colors.accentAlt,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  listenButtonText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  progressButton: {
    marginTop: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  progressButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  accentName: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.accent,
  },
  score: {
    color: theme.colors.text,
    marginTop: 8,
  },
});
