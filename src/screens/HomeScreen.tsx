import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const BADGE_MILESTONES = [3, 7, 14, 30];

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Buenos días" : HOUR < 19 ? "Buenas tardes" : "Buenas noches";

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToLocalKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeCurrentStreak(history: string[]): number {
  const set = new Set(history || []);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const day = dateToLocalKey(cursor);
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

const BADGE_DATA: { days: number; icon: string; label: string }[] = [
  { days: 3, icon: "🥉", label: "3 días" },
  { days: 7, icon: "🥈", label: "7 días" },
  { days: 14, icon: "🥇", label: "14 días" },
  { days: 30, icon: "🏆", label: "30 días" },
];

export function HomeScreen() {
  const { progress, runInitialDiagnostic } = useAppState();
  const navigation = useNavigation<any>();

  const profile = progress?.profile;
  const metrics = progress?.metrics;
  const dailyGoalHistory = progress?.dailyGoalHistory || [];
  const streak = computeCurrentStreak(dailyGoalHistory);
  const nextBadge = nextMilestone(streak);
  const chatSessions = progress?.chatSessionHistory || [];
  const lastChatSession = chatSessions[0] || null;
  const words = progress?.pronunciationWordStats || [];
  const todayPracticed = dailyGoalHistory.includes(getTodayKey());

  const grammarPct = Math.round(metrics?.grammarAccuracy ?? 0);
  const fluencyPct = Math.round((metrics?.fluencyScore ?? 0) * 10);
  const pronunciationPct = Math.round((metrics?.pronunciationScore ?? 0) * 10);

  const trendWindow = [...(progress?.metricHistory || [])]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-7);
  const trendGraphData = trendWindow.map((item) => ({
    day: item.dateKey.slice(5),
    grammar: item.grammarAccuracy,
    fluency: Math.round(item.fluencyScore * 10),
    pronunciation: Math.round(item.pronunciationScore * 10),
  }));

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

      {/* Tarjeta principal: Foco de hoy */}
      <View style={[styles.focusCard, todayPracticed && styles.focusCardDone]}>
        <View style={styles.focusHeaderRow}>
          <Text style={styles.focusLabel}>🎯 Foco de hoy</Text>
          <Text style={[styles.focusStatus, todayPracticed && styles.focusStatusDone]}>
            {todayPracticed ? "¡Completado!" : "Pendiente"}
          </Text>
        </View>

        <Text style={styles.focusTitle}>
          {todayPracticed
            ? "¡Genial! Ya practicaste hoy. Seguí con otra sesión."
            : "Abrí el chat y conversá con tu tutor virtual."}
        </Text>
        <Text style={styles.focusDesc}>
          El chat con el tutor es la actividad principal de la app. Practicá inglés en situaciones reales, recibí correcciones al instante y avanzá a tu ritmo.
        </Text>

        <Pressable style={styles.chatBtn} onPress={() => navigation.navigate("Chat")}>
          <Text style={styles.chatBtnText}>💬 Abrir chat con el tutor</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Accents")}>
          <Text style={styles.secondaryBtnText}>🎙 Práctica de pronunciación</Text>
        </Pressable>

        {/* Racha e insignias */}
        <View style={styles.streakSection}>
          <View style={styles.streakMainRow}>
            <Text style={styles.streakNumber}>🔥 {streak}</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>día{streak !== 1 ? "s" : ""} seguido{streak !== 1 ? "s" : ""}</Text>
              {nextBadge ? (
                <Text style={styles.streakHint}>Faltan {nextBadge - streak} para la próxima insignia</Text>
              ) : streak > 0 ? (
                <Text style={styles.streakHint}>¡Todas las insignias desbloqueadas!</Text>
              ) : (
                <Text style={styles.streakHint}>Practicá hoy para empezar tu racha</Text>
              )}
            </View>
          </View>

          <View style={styles.badgesRow}>
            {BADGE_DATA.map(({ days, icon, label }) => {
              const unlocked = streak >= days;
              return (
                <View key={days} style={[styles.badgeChip, unlocked && styles.badgeChipUnlocked]}>
                  <Text style={styles.badgeIcon}>{unlocked ? icon : "🔒"}</Text>
                  <Text style={[styles.badgeLabel, unlocked && styles.badgeLabelUnlocked]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Resumen rápido */}
      <Text style={styles.sectionTitle}>Resumen rápido</Text>
      <View style={styles.statsRow}>
        {[
          { label: "Gramática", value: grammarPct, suffix: "%" },
          { label: "Fluidez", value: fluencyPct, suffix: "%" },
          { label: "Pronunciación", value: pronunciationPct, suffix: "%" },
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

      {/* Actividad reciente */}
      <View style={styles.activityCard}>
        <Text style={styles.sectionLabel}>🧾 Actividad reciente</Text>
        <Text style={styles.activityLine}>
          Sesiones de chat: <Text style={styles.activityBold}>{chatSessions.length}</Text>
        </Text>
        <Text style={styles.activityLine}>
          Última sesión:{" "}
          <Text style={styles.activityBold}>
            {lastChatSession
              ? `${formatShortDate(lastChatSession.endedAt)} · ${lastChatSession.turns} turno(s)`
              : "Sin sesiones aún"}
          </Text>
        </Text>
        <Text style={styles.activityLine}>
          Palabras practicadas: <Text style={styles.activityBold}>{words.length}</Text>
        </Text>
      </View>

      {/* Tendencia */}
      <View style={styles.trendCard}>
        <Text style={styles.sectionLabel}>📈 Evolución 7 días</Text>
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
            <Text style={styles.chartLegend}>Azul: gramática · Naranja: fluidez · Verde: pronunciación</Text>
          </>
        ) : (
          <Text style={styles.activityHint}>Todavía no hay datos suficientes para mostrar tendencia semanal.</Text>
        )}
      </View>

      {!progress?.diagnosticCompleted && (
        <Pressable style={styles.diagnosticCard} onPress={runInitialDiagnostic}>
          <Text style={styles.diagnosticTitle}>🔍 Activar análisis inicial</Text>
          <Text style={styles.diagnosticDesc}>Esto ayuda a personalizar recomendaciones en tu progreso.</Text>
          <Text style={styles.diagnosticCta}>Ejecutar ahora →</Text>
        </Pressable>
      )}

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

  // Tarjeta foco
  focusCard: {
    backgroundColor: "#eef9f0",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#b8e5bf",
    padding: 16,
    gap: 10,
  },
  focusCardDone: {
    backgroundColor: "#eaf6ff",
    borderColor: "#b7d8f4",
  },
  focusHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  focusLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  focusStatus: { color: "#7c5a00", fontSize: 12, fontWeight: "700", backgroundColor: "#fff3cd", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  focusStatusDone: { color: "#1e5a2a", backgroundColor: "#c8f0d0" },
  focusTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  focusDesc: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },

  chatBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 2,
  },
  chatBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#d9ecdf",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#236b35", fontWeight: "700", fontSize: 13 },

  // Racha e insignias
  streakSection: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#c8e6ce",
    gap: 10,
  },
  streakMainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  streakNumber: { fontSize: 32, fontWeight: "700", color: "#e65100" },
  streakInfo: { gap: 2, flex: 1 },
  streakLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  streakHint: { color: theme.colors.muted, fontSize: 12 },
  badgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeChipUnlocked: { backgroundColor: "#fff3cd", borderWidth: 1, borderColor: "#f0c040" },
  badgeIcon: { fontSize: 16 },
  badgeLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
  badgeLabelUnlocked: { color: "#7c5a00", fontWeight: "700" },

  // Stats
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
  activityBold: { fontWeight: "700" },
  activityHint: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },

  trendCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6 },
  chartColumn: { alignItems: "center", gap: 4, flex: 1 },
  chartBars: { height: 34, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  chartBar: { width: 5, borderRadius: 2 },
  chartBarGrammar: { backgroundColor: "#1e88e5" },
  chartBarFluency: { backgroundColor: "#f9a825" },
  chartBarPronunciation: { backgroundColor: "#43a047" },
  chartDay: { color: theme.colors.muted, fontSize: 10 },
  chartLegend: { color: theme.colors.muted, fontSize: 11 },

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

  footerSpace: { height: 8 },
});
