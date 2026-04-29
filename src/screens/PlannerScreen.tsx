import { ScrollView, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { WeeklyPlanItem } from "../types/progress";
import { styles } from "./PlannerScreen.styles";

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
                  <View style={styles.dayTextBlock}>
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

