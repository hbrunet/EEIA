import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

export function HomeScreen() {
  const { progress, runInitialDiagnostic } = useAppState();
  const topWeakness = progress?.weaknesses[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>English Coach</Text>
      <Text style={styles.subtitle}>Your adaptive lesson flow</Text>
      <View style={styles.card}>
        <Text style={styles.goal}>{progress?.currentLesson.objective || "Loading objective..."}</Text>
      </View>
      {!progress?.diagnosticCompleted && (
        <Pressable style={styles.button} onPress={runInitialDiagnostic}>
          <Text style={styles.buttonText}>Run initial diagnostic</Text>
        </Pressable>
      )}
      <Text style={styles.muted}>
        Focus weakness: {topWeakness ? `${topWeakness.detail} (sev ${topWeakness.severity}/5)` : "Analyzing your profile"}
      </Text>
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
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.muted,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
  },
  goal: {
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 25,
  },
  muted: {
    color: theme.colors.muted,
  },
  button: {
    backgroundColor: theme.colors.accentAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
});
