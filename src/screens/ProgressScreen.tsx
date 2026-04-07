import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const ACCENT_FLAGS: Record<string, string> = {
  US: "🇺🇸 US",
  UK: "🇬🇧 UK",
  AU: "🇦🇺 AU",
  CA: "🇨🇦 CA",
};

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

function formatTrend(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function MetricBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const barColor = pct >= 70 ? "#4caf50" : pct >= 40 ? "#ffc107" : "#f44336";
  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={[barStyles.value, { color: barColor }]}>{value}{max === 100 ? "%" : "/10"}</Text>
      </View>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { gap: 4 },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: theme.colors.text, fontSize: 13 },
  value: { fontSize: 13, fontWeight: "700" },
  track: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});

export function ProgressScreen() {
  const { progress } = useAppState();

  if (!progress) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>Cargando progreso...</Text>
      </View>
    );
  }

  const { metrics, profile } = progress;
  const pronunciationStats = progress.pronunciationWordStats || [];
  const pronunciationAttempts = pronunciationStats.reduce((sum, item) => sum + item.attempts, 0);
  const pronunciationAverage = pronunciationStats.length
    ? Math.round(pronunciationStats.reduce((sum, item) => sum + item.avgScore, 0) / pronunciationStats.length)
    : null;
  const weakestPronunciationWords = [...pronunciationStats]
    .sort((a, b) => {
      if (a.avgScore === b.avgScore) return b.attempts - a.attempts;
      return a.avgScore - b.avgScore;
    })
    .slice(0, 5);
  const chatFocus = progress.nextClassGoal || "Definí un objetivo de conversación en el chat";
  const fluencyPercent = Math.round(metrics.fluencyScore * 10);
  const pronunciationPercent = Math.round(metrics.pronunciationScore * 10);
  const chatSessions = (progress.chatSessionHistory || []).slice(0, 5);
  const currentStreak = computeCurrentStreak(progress.dailyGoalHistory || []);
  const bestStreak = computeBestStreak(progress.dailyGoalHistory || []);
  const completedDays = (progress.dailyGoalHistory || []).length;

  const sortedMetricHistory = [...(progress.metricHistory || [])].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const trendWindow = sortedMetricHistory.slice(-7);
  const trendGraphData = trendWindow.map((item) => ({
    day: item.dateKey.slice(5),
    grammar: item.grammarAccuracy,
    fluency: Math.round(item.fluencyScore * 10),
    pronunciation: Math.round(item.pronunciationScore * 10),
    listeningUS: item.listeningByAccent.US,
    listeningUK: item.listeningByAccent.UK,
    listeningAU: item.listeningByAccent.AU,
    listeningCA: item.listeningByAccent.CA,
  }));
  const trendBase = trendWindow.length > 1 ? trendWindow[0] : null;
  const trendLast = trendWindow.length > 0 ? trendWindow[trendWindow.length - 1] : null;
  const grammarTrend = trendBase && trendLast ? Math.round(trendLast.grammarAccuracy - trendBase.grammarAccuracy) : 0;
  const fluencyTrend = trendBase && trendLast
    ? Math.round((trendLast.fluencyScore - trendBase.fluencyScore) * 10)
    : 0;
  const pronunciationTrend = trendBase && trendLast
    ? Math.round((trendLast.pronunciationScore - trendBase.pronunciationScore) * 10)
    : 0;
  const listeningTrends = trendBase && trendLast
    ? {
        US: Math.round(trendLast.listeningByAccent.US - trendBase.listeningByAccent.US),
        UK: Math.round(trendLast.listeningByAccent.UK - trendBase.listeningByAccent.UK),
        AU: Math.round(trendLast.listeningByAccent.AU - trendBase.listeningByAccent.AU),
        CA: Math.round(trendLast.listeningByAccent.CA - trendBase.listeningByAccent.CA),
      }
    : null;
  const weakestAccentEntry = (Object.entries(metrics.listeningByAccent) as Array<[keyof typeof metrics.listeningByAccent, number]>)
    .reduce((worst, current) => current[1] < worst[1] ? current : worst);
  const prioritizedAreas = [
    pronunciationStats.length > 0 && weakestPronunciationWords[0]
      ? `Pronunciación de palabras críticas: ${weakestPronunciationWords.slice(0, 3).map((item) => item.word).join(", ")}`
      : null,
    `Comprensión auditiva a reforzar en ${weakestAccentEntry[0]} (${weakestAccentEntry[1]}%)`,
    metrics.grammarAccuracy < 75 ? `Gramática en conversación (${metrics.grammarAccuracy}%)` : null,
    fluencyPercent < 70 ? `Fluidez conversacional (${fluencyPercent}%)` : null,
    chatSessions.length === 0 ? "Falta práctica conversacional en chat" : null,
  ].filter(Boolean) as string[];
  const todayKey = getTodayKey();
  const unlockedToday = BADGE_MILESTONES.filter((milestone) => currentStreak === milestone && (progress.dailyGoalHistory || []).includes(todayKey));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mi progreso</Text>

      {/* Perfil */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 Perfil</Text>
        <Text style={styles.profileName}>{profile.name || "Estudiante"}</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Nivel {profile.level}</Text>
        </View>
        {profile.goals.length > 0 && (
          <Text style={styles.goal}>🎯 {profile.goals[0]}</Text>
        )}
      </View>

      {/* Resultados de chat */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>💬 Resultados de chat</Text>
        <Text style={styles.contextText}>Tema/objetivo actual: {chatFocus}</Text>
        <Text style={styles.contextSubtext}>Sesiones de chat registradas: {progress.chatSessionHistory.length}</Text>
        <MetricBar label="Gramática" value={metrics.grammarAccuracy} max={100} />
        <MetricBar label="Fluidez conversacional" value={fluencyPercent} max={100} />
      </View>

      {/* Tendencia 7 días */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📉 Tendencia últimos 7 días</Text>
        {trendBase && trendLast ? (
          <>
            <Text style={styles.trendLine}>
              Gramática: {formatTrend(grammarTrend)} pt
            </Text>
            <Text style={styles.trendLine}>
              Fluidez: {formatTrend(fluencyTrend)} pt
            </Text>
            <Text style={styles.trendLine}>
              Pronunciación: {formatTrend(pronunciationTrend)} pt
            </Text>
            <View style={styles.chartRow}>
              {trendGraphData.map((item) => (
                <View key={`trend-${item.day}`} style={styles.chartColumn}>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBar, styles.chartBarGrammar, { height: Math.max(4, Math.round(item.grammar * 0.28)) }]} />
                    <View style={[styles.chartBar, styles.chartBarFluency, { height: Math.max(4, Math.round(item.fluency * 0.28)) }]} />
                    <View style={[styles.chartBar, styles.chartBarPronunciation, { height: Math.max(4, Math.round(item.pronunciation * 0.28)) }]} />
                  </View>
                  <Text style={styles.chartDay}>{item.day}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.chartLegend}>Azul: gramática · Amarillo: fluidez · Verde: pronunciación</Text>
            {listeningTrends && (
              <View style={styles.listeningTrendBox}>
                <Text style={styles.listeningTrendTitle}>Variación semanal listening por acento</Text>
                <Text style={styles.listeningTrendLine}>US: {formatTrend(listeningTrends.US)} pt</Text>
                <Text style={styles.listeningTrendLine}>UK: {formatTrend(listeningTrends.UK)} pt</Text>
                <Text style={styles.listeningTrendLine}>AU: {formatTrend(listeningTrends.AU)} pt</Text>
                <Text style={styles.listeningTrendLine}>CA: {formatTrend(listeningTrends.CA)} pt</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.empty}>Todavía no hay datos suficientes para calcular tendencia.</Text>
        )}
      </View>

      {/* Resultados de pronunciación */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🗣 Resultados de pronunciación</Text>
        <Text style={styles.contextSubtext}>Palabras practicadas: {pronunciationStats.length}</Text>
        <Text style={styles.contextSubtext}>Intentos totales: {pronunciationAttempts}</Text>
        <MetricBar label="Pronunciación general" value={pronunciationPercent} max={100} />
        {pronunciationAverage !== null && (
          <MetricBar label="Promedio en palabras practicadas" value={pronunciationAverage} max={100} />
        )}

        {weakestPronunciationWords.length > 0 ? (
          <View style={styles.wordList}>
            <Text style={styles.assistTitle}>Palabras a reforzar</Text>
            {weakestPronunciationWords.map((item) => (
              <View key={`weak-word-${item.word}`} style={styles.wordRow}>
                <Text style={styles.wordLabel}>{item.word}</Text>
                <Text style={styles.wordMeta}>{Math.round(item.avgScore)}% · {item.attempts} intento(s)</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Todavía no hay práctica de pronunciación registrada.</Text>
        )}
      </View>

      {/* Comprensión auditiva por acento */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎧 Comprensión auditiva por acento</Text>
        {(Object.entries(metrics.listeningByAccent) as [string, number][]).map(([accent, val]) => (
          <MetricBar key={accent} label={ACCENT_FLAGS[accent] ?? accent} value={val} max={100} />
        ))}
      </View>

      {/* Historial de chat */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🧾 Historial de chat</Text>
        {chatSessions.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay sesiones de chat guardadas.</Text>
        ) : (
          chatSessions.map((entry) => (
            <View key={`${entry.startedAt}-${entry.endedAt}`} style={styles.chatRow}>
              <View style={styles.chatRowHeader}>
                <Text style={styles.chatDate}>
                  {new Date(entry.endedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                </Text>
                <Text style={styles.chatTurns}>{entry.turns} turno(s)</Text>
              </View>
              <Text style={styles.chatTopic} numberOfLines={2}>{entry.topic}</Text>
              <Text style={styles.chatMeta}>
                Correcciones: {entry.correctionCount} · Tips pron: {entry.pronunciationHintCount}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Badges */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🏅 Insignias de constancia</Text>
        <Text style={styles.contextSubtext}>Racha actual: {currentStreak} día(s)</Text>
        <Text style={styles.contextSubtext}>Mejor racha: {bestStreak} día(s)</Text>
        <Text style={styles.contextSubtext}>Días completados: {completedDays}</Text>
        {unlockedToday.length > 0 && (
          <View style={styles.badgeNotice}>
            <Text style={styles.badgeNoticeText}>Nueva insignia desbloqueada hoy: {unlockedToday.join(", ")} días</Text>
          </View>
        )}
        <View style={styles.badgesRow}>
          {BADGE_MILESTONES.map((milestone) => {
            const unlocked = bestStreak >= milestone;
            return (
              <View key={`badge-${milestone}`} style={[styles.badge, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                <Text style={[styles.badgeText, unlocked ? styles.badgeTextUnlocked : styles.badgeTextLocked]}>
                  {milestone} días
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Áreas prioritarias */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎯 Áreas a mejorar</Text>
        {prioritizedAreas.length === 0 ? (
          <Text style={styles.empty}>No hay alertas activas por ahora.</Text>
        ) : (
          prioritizedAreas.slice(0, 5).map((item) => (
            <View key={item} style={styles.priorityRow}>
              <Text style={styles.priorityBullet}>•</Text>
              <Text style={styles.priorityText}>{item}</Text>
            </View>
          ))
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
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accent,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  levelBadge: {
    backgroundColor: "#ddeef2",
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  levelText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  goal: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  contextText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  contextSubtext: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  wordList: {
    marginTop: 4,
    gap: 6,
  },
  assistTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  wordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  wordLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  wordMeta: {
    color: theme.colors.muted,
    fontSize: 11,
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
  listeningTrendBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  listeningTrendTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  listeningTrendLine: {
    color: theme.colors.muted,
    fontSize: 12,
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
  chatMeta: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeUnlocked: {
    borderColor: "#f0a500",
    backgroundColor: "#fff7e6",
  },
  badgeLocked: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextUnlocked: {
    color: "#8a5a00",
  },
  badgeTextLocked: {
    color: theme.colors.muted,
  },
  badgeNotice: {
    backgroundColor: "#fff3cd",
    borderColor: "#f0a500",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badgeNoticeText: {
    color: "#7d5200",
    fontSize: 12,
    fontWeight: "700",
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  priorityBullet: {
    color: theme.colors.accent,
    fontSize: 14,
    lineHeight: 18,
  },
  priorityText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  empty: {
    color: theme.colors.muted,
    fontSize: 13,
  },
});
