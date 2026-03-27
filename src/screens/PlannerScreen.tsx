import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { WeeklyPlanItem } from "../types/progress";
import { theme } from "../ui/theme";

const DAY_ES: Record<WeeklyPlanItem["day"], string> = {
  Mon: "Lunes",
  Tue: "Martes",
  Wed: "Miércoles",
  Thu: "Jueves",
  Fri: "Viernes",
};

const DAY_ICON: Record<WeeklyPlanItem["day"], string> = {
  Mon: "📖",
  Tue: "💬",
  Wed: "🔊",
  Thu: "🏃",
  Fri: "🎯",
};

const TODAY_EN = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[new Date().getDay()];

const SKILL_LABEL: Record<string, string> = {
  grammar: "Gramática",
  listening: "Escucha",
  fluency: "Fluidez",
  pronunciation: "Pronunciación",
  vocabulary: "Vocabulario",
};

export function PlannerScreen() {
  const { progress } = useAppState();
  const plan = progress?.weeklyPlan ?? [];
  const lesson = progress?.currentLesson;
  const profile = progress?.profile;
  const weaknesses = (progress?.weaknesses ?? []).slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Planificador semanal</Text>

      {/* Meta actual */}
      {progress?.nextClassGoal ? (
        <View style={styles.goalCard}>
          <Text style={styles.goalLabel}>🎯 Meta para la próxima clase</Text>
          <Text style={styles.goalText}>{progress.nextClassGoal}</Text>
        </View>
      ) : null}

      {/* Foco de hoy */}
      {lesson && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Sesión de hoy</Text>
          <View style={styles.todayCard}>
            <View style={styles.todayRow}>
              <Text style={styles.todayIcon}>📋</Text>
              <View style={styles.todayInfo}>
                <Text style={styles.todayObjective}>{lesson.objective}</Text>
                <Text style={styles.todayMeta}>
                  Foco: {SKILL_LABEL[lesson.focusArea] ?? lesson.focusArea} · Acento: {lesson.accentFocus}
                </Text>
              </View>
            </View>
            {lesson.warmupQuestions?.length > 0 && (
              <View style={styles.warmupBlock}>
                <Text style={styles.warmupTitle}>Calentamiento sugerido</Text>
                {lesson.warmupQuestions.slice(0, 2).map((q, i) => (
                  <Text key={i} style={styles.warmupItem}>• {q}</Text>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Plan semanal */}
      {plan.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Plan de la semana</Text>
          {plan.map((item) => {
            const isToday = item.day === TODAY_EN;
            return (
              <View
                key={item.day}
                style={[styles.dayRow, isToday && styles.dayRowToday]}
              >
                <View style={styles.dayLeft}>
                  <Text style={styles.dayIcon}>{DAY_ICON[item.day]}</Text>
                  <View>
                    <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                      {DAY_ES[item.day]}{isToday ? "  ← hoy" : ""}
                    </Text>
                    <Text style={styles.dayObjective}>{item.objective}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Áreas prioritarias */}
      {weaknesses.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Áreas prioritarias</Text>
          <View style={styles.weaknessCard}>
            {weaknesses.map((w, i) => (
              <View key={i} style={styles.weaknessRow}>
                <View style={[styles.dot, { backgroundColor: w.severity >= 4 ? "#f44336" : w.severity >= 3 ? "#ffc107" : "#4caf50" }]} />
                <View style={styles.weaknessInfo}>
                  <Text style={styles.weaknessDetail}>{w.detail}</Text>
                  <Text style={styles.weaknessArea}>{SKILL_LABEL[w.area] ?? w.area}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Info perfil */}
      {profile && (
        <View style={styles.profileRow}>
          <Text style={styles.profileChip}>{profile.level}</Text>
          {profile.goals.slice(0, 1).map((g, i) => (
            <Text key={i} style={styles.profileGoal} numberOfLines={1}>{g}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginTop: 12 },
  goalCard: {
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#c8e6c9",
    padding: 14,
    gap: 6,
  },
  goalLabel: { color: "#2e7d32", fontWeight: "700", fontSize: 13 },
  goalText: { color: "#1b5e20", fontSize: 15, lineHeight: 21 },
  sectionBlock: { gap: 10 },
  sectionTitle: { fontWeight: "700", color: theme.colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  todayCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  todayRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  todayIcon: { fontSize: 28 },
  todayInfo: { flex: 1, gap: 4 },
  todayObjective: { color: theme.colors.text, fontWeight: "700", fontSize: 15, lineHeight: 21 },
  todayMeta: { color: theme.colors.muted, fontSize: 12 },
  warmupBlock: { gap: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 },
  warmupTitle: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
  warmupItem: { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  dayRow: {
    backgroundColor: theme.colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  dayRowToday: { borderColor: theme.colors.accent, backgroundColor: "#f0f8fa" },
  dayLeft: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dayIcon: { fontSize: 22, marginTop: 1 },
  dayName: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  dayNameToday: { color: theme.colors.accent },
  dayObjective: { color: theme.colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 },
  weaknessCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  weaknessRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  weaknessInfo: { flex: 1, gap: 2 },
  weaknessDetail: { color: theme.colors.text, fontSize: 14 },
  weaknessArea: { color: theme.colors.muted, fontSize: 11 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileChip: {
    backgroundColor: theme.colors.accent,
    color: "#fff",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 13,
  },
  profileGoal: { color: theme.colors.muted, fontSize: 12, flex: 1 },
});
