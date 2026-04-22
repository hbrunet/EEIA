import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const BADGE_MILESTONES = [3, 7, 14, 30];

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeCurrentStreak(history: string[]): number {
  const keys = new Set(history || []);
  let streak = 0;
  const cursor = new Date(`${getTodayKey()}T00:00:00`);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!keys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function computeBestStreak(history: string[]): number {
  const sorted = [...new Set(history || [])].sort();
  if (sorted.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = new Date(`${sorted[i - 1]}T00:00:00`);
    const currentDate = new Date(`${sorted[i]}T00:00:00`);
    const diffDays = Math.round((currentDate.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function nextMilestone(streak: number): number | null {
  return BADGE_MILESTONES.find((item) => item > streak) ?? null;
}

function formatTrend(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiHint}>{hint}</Text>
    </View>
  );
}

export function ProgressScreen() {
  const { progress } = useAppState();
  const navigation = useNavigation<any>();

  if (!progress) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>Cargando progreso...</Text>
      </View>
    );
  }

  const { metrics } = progress;
  const pronunciationStats = progress.pronunciationWordStats || [];
  const weakestWords = [...pronunciationStats]
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 2);

  const pronunciationPct = Math.round(metrics.pronunciationScore * 10);

  const history = progress.dailyGoalHistory || [];
  const currentStreak = computeCurrentStreak(history);
  const bestStreak = computeBestStreak(history);
  const upcomingMilestone = nextMilestone(currentStreak);

  const sortedMetricHistory = [...(progress.metricHistory || [])].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const trendWindow = sortedMetricHistory.slice(-7);
  const trendBase = trendWindow.length > 1 ? trendWindow[0] : null;
  const trendLast = trendWindow.length > 0 ? trendWindow[trendWindow.length - 1] : null;

  const pronunciationTrend = trendBase && trendLast
    ? Math.round((trendLast.pronunciationScore - trendBase.pronunciationScore) * 10)
    : 0;


  const chartData = trendWindow.map((item) => ({
    day: item.dateKey.slice(5),
    pronunciation: Math.round(item.pronunciationScore * 10),
  }));

  const focusItems: string[] = [];
  if (weakestWords.length > 0) {
    focusItems.push(`Palabras: ${weakestWords.map((item) => item.word).join(", ")}`);
  }
  focusItems.push(`Objetivo actual: ${progress.nextClassGoal || "Practicar conversación guiada"}`);

  const recentChats = (progress.chatSessionHistory || []).slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mi progreso</Text>

      <View style={styles.cardHero}>
        <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Pronunciación" value={`${pronunciationPct}%`} hint="Puntaje general" />
          <KpiCard label="Racha" value={`${currentStreak} día(s)`} hint={`Mejor: ${bestStreak}`} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Qué practicar ahora</Text>
        {focusItems.map((item) => (
          <View key={item} style={styles.focusRow}>
            <Text style={styles.focusBullet}>•</Text>
            <Text style={styles.focusText}>{item}</Text>
          </View>
        ))}
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={() => navigation.navigate("Accents")}>
            <Text style={styles.actionBtnText}>Ir a pronunciación</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => navigation.navigate("Chat")}>
            <Text style={styles.actionBtnTextSecondary}>Abrir chat</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tendencia semanal</Text>
        {trendBase && trendLast ? (
          <>
            <Text style={styles.trendLine}>Pronunciación: {formatTrend(pronunciationTrend)} pt</Text>
            <View style={styles.chartRow}>
              {chartData.map((item) => (
                <View key={`trend-${item.day}`} style={styles.chartColumn}>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBar, styles.chartBarPron, { height: Math.max(4, Math.round(item.pronunciation * 0.3)) }]} />
                  </View>
                  <Text style={styles.chartDay}>{item.day}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.chartLegend}>Verde: pronunciación por día</Text>
          </>
        ) : (
          <Text style={styles.empty}>Todavía no hay datos suficientes para mostrar tendencia semanal.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Actividad reciente</Text>
        {recentChats.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay sesiones de chat guardadas.</Text>
        ) : (
          recentChats.map((entry) => (
            <View key={`${entry.startedAt}-${entry.endedAt}`} style={styles.chatRow}>
              <View style={styles.chatRowHeader}>
                <Text style={styles.chatDate}>
                  {new Date(entry.endedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                </Text>
                <Text style={styles.chatTurns}>{entry.turns} turno(s)</Text>
              </View>
              <Text style={styles.chatTopic} numberOfLines={2}>{entry.topic}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Insignias de constancia</Text>
        <Text style={styles.contextSubtext}>Racha actual: {currentStreak} día(s)</Text>
        {upcomingMilestone ? (
          <Text style={styles.contextSubtext}>Te faltan {Math.max(0, upcomingMilestone - currentStreak)} día(s) para la insignia de {upcomingMilestone}</Text>
        ) : (
          <Text style={styles.contextSubtext}>Ya desbloqueaste todas las insignias</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: theme.colors.muted, fontSize: 16 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
  },
  cardHero: {
    backgroundColor: "#ecf8f2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c3e6d2",
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accent,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiCard: {
    width: "31%",
    minWidth: 92,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 4,
  },
  kpiLabel: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  kpiValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  kpiHint: {
    color: theme.colors.muted,
    fontSize: 10,
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  focusBullet: {
    color: theme.colors.accent,
    fontSize: 14,
    lineHeight: 18,
  },
  focusText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: theme.colors.border,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  actionBtnTextSecondary: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  trendLine: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 6,
  },
  chartColumn: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  chartBars: {
    height: 36,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  chartBar: {
    width: 6,
    borderRadius: 2,
  },
  chartBarPron: {
    backgroundColor: "#43a047",
  },
  chartDay: {
    color: theme.colors.muted,
    fontSize: 10,
  },
  chartLegend: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  chatRow: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chatRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatDate: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  chatTurns: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  chatTopic: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  contextSubtext: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  empty: {
    color: theme.colors.muted,
    fontSize: 13,
  },
});
