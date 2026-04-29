import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";
import { styles } from "./ProgressScreen.styles";

const BADGE_MILESTONES = [3, 7, 14, 30];

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToLocalKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeCurrentStreak(history: string[]): number {
  const keys = new Set(history || []);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = dateToLocalKey(cursor);
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
  const grammarPct = Math.round(metrics.grammarAccuracy);
  const fluencyPct = Math.round(metrics.fluencyScore * 10);

  const totalChatTurns = (progress.chatSessionHistory || []).reduce((sum, s) => sum + s.turns, 0);
  const totalCorrections = (progress.chatSessionHistory || []).reduce((sum, s) => sum + s.correctionCount, 0);

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
  const grammarTrend = trendBase && trendLast
    ? Math.round(trendLast.grammarAccuracy - trendBase.grammarAccuracy)
    : 0;
  const fluencyTrend = trendBase && trendLast
    ? Math.round((trendLast.fluencyScore - trendBase.fluencyScore) * 10)
    : 0;

  const chartData = trendWindow.map((item) => ({
    day: item.dateKey.slice(5),
    pronunciation: Math.round(item.pronunciationScore * 10),
    grammar: Math.round(item.grammarAccuracy),
    fluency: Math.round(item.fluencyScore * 10),
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
          <KpiCard label="Gramática" value={`${grammarPct}%`} hint="Precisión en chat" />
          <KpiCard label="Fluidez" value={`${fluencyPct}%`} hint="Score de conversación" />
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
            <Text style={styles.trendLine}>Gramática: {formatTrend(grammarTrend)} pt</Text>
            <Text style={styles.trendLine}>Fluidez: {formatTrend(fluencyTrend)} pt</Text>
            <Text style={styles.trendLine}>Pronunciación: {formatTrend(pronunciationTrend)} pt</Text>
            <View style={styles.chartRow}>
              {chartData.map((item) => (
                <View key={`trend-${item.day}`} style={styles.chartColumn}>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBar, styles.chartBarGrammar, { height: Math.max(4, Math.round(item.grammar * 0.3)) }]} />
                    <View style={[styles.chartBar, styles.chartBarFluency, { height: Math.max(4, Math.round(item.fluency * 0.3)) }]} />
                    <View style={[styles.chartBar, styles.chartBarPron, { height: Math.max(4, Math.round(item.pronunciation * 0.3)) }]} />
                  </View>
                  <Text style={styles.chartDay}>{item.day}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.chartLegend}>Naranja: gramática · Amarillo: fluidez · Verde: pronunciación</Text>
          </>
        ) : (
          <Text style={styles.empty}>Todavía no hay datos suficientes para mostrar tendencia semanal.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Estadísticas del tutor</Text>
        <Text style={styles.contextSubtext}>Sesiones de chat: {(progress.chatSessionHistory || []).length}</Text>
        <Text style={styles.contextSubtext}>Turnos totales de conversación: {totalChatTurns}</Text>
        <Text style={styles.contextSubtext}>Correcciones recibidas: {totalCorrections}</Text>
        {pronunciationStats.length > 0 && (
          <Text style={styles.contextSubtext}>Palabras practicadas: {pronunciationStats.length}</Text>
        )}
        {weakestWords.length > 0 && (
          <Text style={[styles.contextSubtext, { color: theme.colors.accent }]}>A reforzar: {weakestWords.map((w) => w.word).join(", ")}</Text>
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
