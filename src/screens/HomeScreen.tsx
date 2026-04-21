import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const BADGE_MILESTONES = [3, 7, 14, 30];

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Buenos días" : HOUR < 19 ? "Buenas tardes" : "Buenas noches";

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeCurrentStreak(history: string[]): number {
  const set = new Set(history || []);
  let streak = 0;
  const cursor = new Date(`${getTodayKey()}T00:00:00`);

  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    if (!set.has(day)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function nextMilestone(streak: number): number | null {
  return BADGE_MILESTONES.find((item) => item > streak) ?? null;
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function HomeScreen() {
  const { progress, runInitialDiagnostic, markDailyGoalCompleted } = useAppState();
  const navigation = useNavigation<any>();

  const profile = progress?.profile;
  const metrics = progress?.metrics;
  const dailyGoal = progress?.dailyGoal;
  const dailyGoalHistory = progress?.dailyGoalHistory || [];
  const streak = computeCurrentStreak(dailyGoalHistory);
  const nextBadge = nextMilestone(streak);
  const chatSessions = progress?.chatSessionHistory || [];
  const lastChatSession = chatSessions[0] || null;
  const words = progress?.pronunciationWordStats || [];

  const pronunciationPct = Math.round((metrics?.pronunciationScore ?? 0) * 10);
  const accentEntries = Object.entries(metrics?.listeningByAccent ?? {}) as [string, number][];
  const avgAccent = accentEntries.length
    ? Math.round(accentEntries.reduce((s, [, v]) => s + v, 0) / accentEntries.length)
    : 0;
  const wordsAverage = words.length
    ? Math.round(words.reduce((sum, item) => sum + item.avgScore, 0) / words.length)
    : null;
  const weakestWords = [...words]
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 3);
  const routineProgressPct = dailyGoal
    ? Math.round((dailyGoal.completedRoutines / Math.max(1, dailyGoal.targetRoutines)) * 100)
    : 0;
  const trendWindow = [...(progress?.metricHistory || [])]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-7);
  const trendGraphData = trendWindow.map((item) => ({
    day: item.dateKey.slice(5),
    grammar: item.grammarAccuracy,
    fluency: Math.round(item.fluencyScore * 10),
    pronunciation: Math.round(item.pronunciationScore * 10),
  }));
  const trendBase = trendWindow.length > 1 ? trendWindow[0] : null;
  const trendLast = trendWindow.length > 0 ? trendWindow[trendWindow.length - 1] : null;
  const listeningDelta = trendBase && trendLast
    ? {
        US: Math.round(trendLast.listeningByAccent.US - trendBase.listeningByAccent.US),
        UK: Math.round(trendLast.listeningByAccent.UK - trendBase.listeningByAccent.UK),
        AU: Math.round(trendLast.listeningByAccent.AU - trendBase.listeningByAccent.AU),
        CA: Math.round(trendLast.listeningByAccent.CA - trendBase.listeningByAccent.CA),
      }
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Saludo */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{GREETING} 👋</Text>
          <Text style={styles.name}>{profile?.name ?? "Estudiante"}</Text>
        </View>
        {profile?.level && (
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{profile.level}</Text>
          </View>
        )}
      </View>

      {/* Objetivo diario y foco de hoy */}
      {dailyGoal && (
        <View style={[styles.dailyGoalCard, dailyGoal.completed && styles.dailyGoalDone]}>
          <View style={styles.dailyGoalHeader}>
            <Text style={styles.sectionLabel}>🎯 Foco de hoy</Text>
            <Text style={styles.dailyGoalStatus}>{dailyGoal.completed ? "Completado" : "En curso"}</Text>
          </View>
          <Text style={styles.dailyGoalTitle}>{dailyGoal.title}</Text>
          <Text style={styles.dailyGoalMeta}>
            {dailyGoal.completedRoutines}/{dailyGoal.targetRoutines} rutina(s) completadas hoy
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${routineProgressPct}%` as any }]} />
          </View>
          {dailyGoal.checklist.map((item, index) => {
            const checked = dailyGoal.completed || index < dailyGoal.completedRoutines;
            return (
              <Text key={`goal-item-${index}`} style={[styles.dailyGoalItem, checked && styles.dailyGoalItemChecked]}>
                {checked ? "✓" : "○"} {item}
              </Text>
            );
          })}
          <View style={styles.dailyGoalActions}>
            <Pressable style={styles.dailyGoalBtn} onPress={() => navigation.navigate("Accents")}>
              <Text style={styles.dailyGoalBtnText}>Ir a pronunciación</Text>
            </Pressable>
            <Pressable style={[styles.dailyGoalBtn, styles.dailyGoalBtnNeutral]} onPress={() => navigation.navigate("Chat")}>
              <Text style={styles.dailyGoalBtnTextNeutral}>Abrir chat</Text>
            </Pressable>
            {!dailyGoal.completed && (
              <Pressable style={[styles.dailyGoalBtn, styles.dailyGoalBtnSecondary]} onPress={markDailyGoalCompleted}>
                <Text style={styles.dailyGoalBtnTextSecondary}>Marcar completo</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.streakRow}>
            <Text style={styles.streakText}>🔥 Racha actual: {streak} día(s)</Text>
            {nextBadge ? (
              <Text style={styles.badgeText}>Próxima insignia: {nextBadge} días</Text>
            ) : (
              <Text style={styles.badgeText}>🏅 Todas las insignias desbloqueadas</Text>
            )}
          </View>
        </View>
      )}

      {/* Resumen rápido */}
      <Text style={styles.sectionTitle}>Resumen rápido</Text>
      <View style={styles.statsRow}>
        {[
          { label: "Pronunciación", value: pronunciationPct, suffix: "%" },
          { label: "Acentos", value: avgAccent, suffix: "%" },
        ].map(({ label, value, suffix }) => {
          const color = value >= 70 ? "#4caf50" : value >= 40 ? "#ffc107" : "#f44336";
          return (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}{suffix}</Text>
              <Text style={styles.statLabel}>{label}</Text>
              <View style={styles.statTrack}>
                <View style={[styles.statFill, { width: `${value}%` as any, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.trendCard}>
        <Text style={styles.sectionLabel}>📈 Dashboard 7 días</Text>
        {trendGraphData.length > 1 ? (
          <>
            <View style={styles.chartRow}>
              {trendGraphData.map((item) => (
                <View key={`home-trend-${item.day}`} style={styles.chartColumn}>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBar, styles.chartBarGrammar, { height: Math.max(4, Math.round(item.grammar * 0.28)) }]} />
                    <View style={[styles.chartBar, styles.chartBarFluency, { height: Math.max(4, Math.round(item.fluency * 0.28)) }]} />
                    <View style={[styles.chartBar, styles.chartBarPronunciation, { height: Math.max(4, Math.round(item.pronunciation * 0.28)) }]} />
                  </View>
                  <Text style={styles.chartDay}>{item.day}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.chartLegend}>Azul: pronunciación · Amarillo: listening · Verde: tendencia diaria</Text>
            {listeningDelta && (
              <Text style={styles.listeningDeltaLine}>
                Listening semanal: US {listeningDelta.US >= 0 ? `+${listeningDelta.US}` : listeningDelta.US} · UK {listeningDelta.UK >= 0 ? `+${listeningDelta.UK}` : listeningDelta.UK} · AU {listeningDelta.AU >= 0 ? `+${listeningDelta.AU}` : listeningDelta.AU} · CA {listeningDelta.CA >= 0 ? `+${listeningDelta.CA}` : listeningDelta.CA}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.activityHint}>Todavía no hay datos suficientes para mostrar tendencia semanal.</Text>
        )}
      </View>

      {/* Actividad reciente */}
      <View style={styles.activityCard}>
        <Text style={styles.sectionLabel}>🧾 Actividad reciente</Text>
        <Text style={styles.activityLine}>Sesiones de chat: {chatSessions.length}</Text>
        <Text style={styles.activityLine}>
          Última sesión: {lastChatSession ? `${formatShortDate(lastChatSession.endedAt)} · ${lastChatSession.turns} turno(s)` : "Sin sesiones aún"}
        </Text>
        <Text style={styles.activityLine}>Palabras practicadas: {words.length}</Text>
        <Text style={styles.activityLine}>
          Promedio de palabras: {wordsAverage !== null ? `${wordsAverage}%` : "Sin datos todavía"}
        </Text>
        {weakestWords.length > 0 && (
          <Text style={styles.activityHint}>A reforzar: {weakestWords.map((item) => item.word).join(", ")}</Text>
        )}
      </View>

      {!progress?.diagnosticCompleted && (
        <Pressable style={styles.diagnosticCard} onPress={runInitialDiagnostic}>
          <Text style={styles.diagnosticTitle}>🔍 Activar análisis inicial</Text>
          <Text style={styles.diagnosticDesc}>Esto ayuda a personalizar recomendaciones en tu progreso.</Text>
          <Text style={styles.diagnosticCta}>Ejecutar ahora →</Text>
        </Pressable>
      )}

      {/* Accesos */}
      <Text style={styles.sectionTitle}>Accesos rápidos</Text>
      <View style={styles.quickGrid}>
        {[
          { icon: "💬", label: "Chat", screen: "Chat" },
          { icon: "🗣", label: "Pronunciación", screen: "Accents" },
          { icon: "📊", label: "Progreso", screen: "Progress" },
          { icon: "👤", label: "Perfil", screen: "Profile" },
        ].map(({ icon, label, screen }) => (
          <Pressable key={screen} style={styles.quickCard} onPress={() => navigation.navigate(screen)}>
            <Text style={styles.quickIcon}>{icon}</Text>
            <Text style={styles.quickLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  headerText: { gap: 2 },
  greeting: { color: theme.colors.muted, fontSize: 14 },
  name: { color: theme.colors.text, fontSize: 24, fontWeight: "700" },
  levelBadge: { backgroundColor: theme.colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  levelText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  sectionLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  sectionTitle: { fontWeight: "700", color: theme.colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },

  dailyGoalCard: {
    backgroundColor: "#eef9f0",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#b8e5bf",
    padding: 14,
    gap: 6,
  },
  dailyGoalDone: {
    backgroundColor: "#eaf6ff",
    borderColor: "#b7d8f4",
  },
  dailyGoalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dailyGoalStatus: { color: "#236b35", fontSize: 12, fontWeight: "700" },
  dailyGoalTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  dailyGoalMeta: { color: theme.colors.muted, fontSize: 12 },
  progressTrack: {
    marginTop: 4,
    width: "100%",
    height: 6,
    borderRadius: 6,
    backgroundColor: "#c8e6ce",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "#2e7d32",
  },
  dailyGoalItem: { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  dailyGoalItemChecked: { color: "#236b35", fontWeight: "600" },
  dailyGoalActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  dailyGoalBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  dailyGoalBtnNeutral: { backgroundColor: theme.colors.border },
  dailyGoalBtnSecondary: { backgroundColor: "#d9ecdf" },
  dailyGoalBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  dailyGoalBtnTextNeutral: { color: theme.colors.text, fontWeight: "700", fontSize: 12 },
  dailyGoalBtnTextSecondary: { color: "#236b35", fontWeight: "700", fontSize: 12 },
  streakRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#c8e6ce",
    gap: 4,
  },
  streakText: { color: "#236b35", fontSize: 12, fontWeight: "700" },
  badgeText: { color: "#1e4e9d", fontSize: 12, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statCard: {
    width: "47%",
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 4,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { color: theme.colors.muted, fontSize: 11 },
  statTrack: { width: "100%", height: 4, backgroundColor: theme.colors.border, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  statFill: { height: 4, borderRadius: 2 },

  activityCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
  },
  activityLine: { color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  activityHint: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },

  trendCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
  },
  chartColumn: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  chartBars: {
    height: 34,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  chartBar: {
    width: 5,
    borderRadius: 2,
  },
  chartBarGrammar: {
    backgroundColor: "#1e88e5",
  },
  chartBarFluency: {
    backgroundColor: "#f9a825",
  },
  chartBarPronunciation: {
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
  listeningDeltaLine: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 18,
  },

  diagnosticCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0d070",
    padding: 16,
    gap: 6,
  },
  diagnosticTitle: { fontWeight: "700", color: "#7c5a00", fontSize: 15 },
  diagnosticDesc: { color: "#7c5a00", fontSize: 13, lineHeight: 19 },
  diagnosticCta: { color: theme.colors.accent, fontWeight: "700", fontSize: 13, marginTop: 4 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: "47%",
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  quickIcon: { fontSize: 28 },
  quickLabel: { color: theme.colors.text, fontWeight: "600", fontSize: 13 },
  footerSpace: { height: 8 },
});
