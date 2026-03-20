import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

export function LessonsScreen() {
  const { progress, completeSession } = useAppState();
  const lesson = progress?.currentLesson;

  async function onCompletePractice() {
    if (!lesson) return;

    await completeSession({
      grammarDelta: 2,
      fluencyDelta: 1,
      pronunciationDelta: 1,
      listeningDelta: 3,
      accent: lesson.accentFocus,
      notes: "Practice session completed from mobile flow",
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today Lesson Plan</Text>
      <View style={styles.card}>
        <Text style={styles.goal}>Objective: {lesson?.objective}</Text>
        <Text style={styles.meta}>Focus: {lesson?.focusArea}</Text>
        <Text style={styles.meta}>Accent: {lesson?.accentFocus}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Warm-up</Text>
        {lesson?.warmupQuestions.map((question) => (
          <Text style={styles.step} key={question}>- {question}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Activities</Text>
        {lesson?.activities.map((activity) => (
          <Text style={styles.step} key={activity}>- {activity}</Text>
        ))}
      </View>

      <Pressable style={styles.button} onPress={onCompletePractice}>
        <Text style={styles.buttonText}>Complete practice and update metrics</Text>
      </Pressable>
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
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  step: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  goal: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  meta: {
    color: theme.colors.muted,
  },
  section: {
    color: theme.colors.accent,
    fontWeight: "700",
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
