import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const SKILL_LABELS: Record<string, string> = {
  grammar: "Gramática",
  fluency: "Fluidez",
  pronunciation: "Pronunciación",
  listening: "Comprensión",
  vocabulary: "Vocabulario",
};

const ACCENT_FLAGS: Record<string, string> = {
  US: "🇺🇸 US",
  UK: "🇬🇧 UK",
  AU: "🇦🇺 AU",
  CA: "🇨🇦 CA",
};

const SEVERITY_COLORS = ["#4caf50", "#8bc34a", "#ffc107", "#ff9800", "#f44336"];

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
  const recent = progress?.sessionHistory.slice(-5).reverse() || [];

  if (!progress) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>Cargando progreso...</Text>
      </View>
    );
  }

  const { metrics, weaknesses, profile } = progress;

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

      {/* Métricas principales */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📈 Habilidades</Text>
        <MetricBar label="Gramática" value={metrics.grammarAccuracy} max={100} />
        <MetricBar label="Fluidez" value={metrics.fluencyScore} max={10} />
        <MetricBar label="Pronunciación" value={metrics.pronunciationScore} max={10} />
      </View>

      {/* Comprensión por acento */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎧 Comprensión por acento</Text>
        {(Object.entries(metrics.listeningByAccent) as [string, number][]).map(([accent, val]) => (
          <MetricBar key={accent} label={ACCENT_FLAGS[accent] ?? accent} value={val} max={100} />
        ))}
      </View>

      {/* Debilidades */}
      {weaknesses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 Áreas a mejorar</Text>
          {weaknesses.slice(0, 5).map((w, i) => (
            <View key={i} style={styles.weakRow}>
              <View style={[styles.weakDot, { backgroundColor: SEVERITY_COLORS[w.severity - 1] }]} />
              <View style={styles.weakContent}>
                <Text style={styles.weakArea}>{SKILL_LABELS[w.area] ?? w.area}</Text>
                <Text style={styles.weakDetail}>{w.detail}</Text>
              </View>
              <Text style={styles.severity}>{"●".repeat(w.severity)}{"○".repeat(5 - w.severity)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Historial */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📅 Últimas sesiones</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>Todavía no completaste ninguna sesión.</Text>
        ) : (
          recent.map((entry) => (
            <View key={entry.completedAt} style={styles.sessionRow}>
              <View style={styles.sessionLeft}>
                <Text style={styles.sessionDate}>
                  {new Date(entry.completedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                </Text>
                <Text style={styles.sessionAccent}>{ACCENT_FLAGS[entry.result.accent] ?? entry.result.accent}</Text>
              </View>
              <Text style={styles.sessionNotes} numberOfLines={2}>{entry.result.notes}</Text>
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
  weakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weakDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  weakContent: {
    flex: 1,
    gap: 1,
  },
  weakArea: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  weakDetail: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  severity: {
    color: "#f0a500",
    fontSize: 10,
    letterSpacing: 1,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sessionLeft: {
    gap: 2,
    minWidth: 48,
  },
  sessionDate: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  sessionAccent: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  sessionNotes: {
    color: theme.colors.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  empty: {
    color: theme.colors.muted,
    fontSize: 13,
  },
});
