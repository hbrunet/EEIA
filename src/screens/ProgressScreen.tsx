import { StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

export function ProgressScreen() {
  const { progress } = useAppState();
  const recent = progress?.sessionHistory.slice(0, 3) || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>
      <View style={styles.card}>
        <Text style={styles.metric}>Grammar accuracy: {progress?.metrics.grammarAccuracy}%</Text>
        <Text style={styles.metric}>Fluency: {progress?.metrics.fluencyScore}/10</Text>
        <Text style={styles.metric}>Pronunciation: {progress?.metrics.pronunciationScore}/10</Text>
      </View>
      <Text style={styles.subtitle}>Listening by accent</Text>
      <View style={styles.card}>
        <Text style={styles.metric}>US: {progress?.metrics.listeningByAccent.US}%</Text>
        <Text style={styles.metric}>UK: {progress?.metrics.listeningByAccent.UK}%</Text>
        <Text style={styles.metric}>AU: {progress?.metrics.listeningByAccent.AU}%</Text>
        <Text style={styles.metric}>CA: {progress?.metrics.listeningByAccent.CA}%</Text>
      </View>

      <Text style={styles.subtitle}>Top weaknesses</Text>
      <View style={styles.card}>
        {progress?.weaknesses.slice(0, 4).map((item) => (
          <Text key={`${item.area}-${item.detail}`} style={styles.metric}>
            {item.area}: {item.detail} ({item.severity}/5)
          </Text>
        ))}
      </View>

      <Text style={styles.subtitle}>Recent sessions</Text>
      <View style={styles.card}>
        {recent.length === 0 && <Text style={styles.metric}>No sessions completed yet.</Text>}
        {recent.map((entry) => (
          <Text key={entry.completedAt} style={styles.metric}>
            {new Date(entry.completedAt).toLocaleDateString()} - {entry.result.accent} listening +
            {entry.result.listeningDelta}
          </Text>
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
  subtitle: {
    color: theme.colors.muted,
    fontWeight: "600",
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  metric: {
    color: theme.colors.text,
    fontSize: 15,
  },
});
