import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const SKILL_LABEL: Record<string, string> = {
  grammar: "Gramática",
  listening: "Escucha",
  fluency: "Fluidez",
  pronunciation: "Pronunciación",
  vocabulary: "Vocabulario",
};

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Buenos días" : HOUR < 19 ? "Buenas tardes" : "Buenas noches";

export function HomeScreen() {
  const { progress, runInitialDiagnostic } = useAppState();
  const navigation = useNavigation<any>();

  const lesson = progress?.currentLesson;
  const profile = progress?.profile;
  const metrics = progress?.metrics;
  const topWeakness = progress?.weaknesses?.[0];

  const grammarPct = metrics?.grammarAccuracy ?? 0;
  const fluencyPct = (metrics?.fluencyScore ?? 0) * 10;
  const accentEntries = Object.entries(metrics?.listeningByAccent ?? {}) as [string, number][];
  const avgAccent = accentEntries.length
    ? Math.round(accentEntries.reduce((s, [, v]) => s + v, 0) / accentEntries.length)
    : 0;

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

      {/* Diagnóstico pendiente */}
      {!progress?.diagnosticCompleted && (
        <Pressable style={styles.diagnosticCard} onPress={runInitialDiagnostic}>
          <Text style={styles.diagnosticTitle}>🔍 Configurar tu perfil</Text>
          <Text style={styles.diagnosticDesc}>
            Generá tu plan de estudio personalizado en base a tu nivel y objetivos.
          </Text>
          <Text style={styles.diagnosticCta}>Comenzar diagnóstico →</Text>
        </Pressable>
      )}

      {/* Sesión de hoy */}
      {lesson && (
        <View style={styles.lessonCard}>
          <Text style={styles.sectionLabel}>📋 Sesión de hoy</Text>
          <Text style={styles.lessonObjective}>{lesson.objective}</Text>
          <Text style={styles.lessonMeta}>
            Foco: {SKILL_LABEL[lesson.focusArea] ?? lesson.focusArea} · Acento: {lesson.accentFocus}
          </Text>
          <View style={styles.lessonButtons}>
            <Pressable style={styles.ctaBtn} onPress={() => navigation.navigate("Chat")}>
              <Text style={styles.ctaBtnText}>💬 Ir al chat</Text>
            </Pressable>
            <Pressable style={[styles.ctaBtn, styles.ctaBtnSecondary]} onPress={() => navigation.navigate("Lessons")}>
              <Text style={styles.ctaBtnTextSecondary}>📖 Ver lección</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Stats rápidas */}
      <Text style={styles.sectionTitle}>Resumen de habilidades</Text>
      <View style={styles.statsRow}>
        {[
          { label: "Gramática", value: grammarPct, suffix: "%" },
          { label: "Fluidez", value: fluencyPct, suffix: "%" },
          { label: "Acentos", value: avgAccent, suffix: "%" },
        ].map(({ label, value }) => {
          const color = value >= 70 ? "#4caf50" : value >= 40 ? "#ffc107" : "#f44336";
          return (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}%</Text>
              <Text style={styles.statLabel}>{label}</Text>
              <View style={styles.statTrack}>
                <View style={[styles.statFill, { width: `${value}%` as any, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Debilidad principal */}
      {topWeakness && (
        <View style={styles.weaknessCard}>
          <Text style={styles.sectionLabel}>⚠️ Área prioritaria</Text>
          <Text style={styles.weaknessDetail}>{topWeakness.detail}</Text>
          <Text style={styles.weaknessMeta}>
            {SKILL_LABEL[topWeakness.area] ?? topWeakness.area} · Prioridad {topWeakness.severity}/5
          </Text>
        </View>
      )}

      {/* Accesos rápidos */}
      <Text style={styles.sectionTitle}>Accesos rápidos</Text>
      <View style={styles.quickGrid}>
        {[
          { icon: "🎯", label: "Acentos", screen: "Accents" },
          { icon: "📊", label: "Progreso", screen: "Progress" },
          { icon: "📅", label: "Planner", screen: "Planner" },
          { icon: "💬", label: "Chat", screen: "Chat" },
        ].map(({ icon, label, screen }) => (
          <Pressable key={screen} style={styles.quickCard} onPress={() => navigation.navigate(screen)}>
            <Text style={styles.quickIcon}>{icon}</Text>
            <Text style={styles.quickLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>

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

  lessonCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 8,
  },
  sectionLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  lessonObjective: { color: theme.colors.text, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  lessonMeta: { color: theme.colors.muted, fontSize: 12 },
  lessonButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  ctaBtn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  ctaBtnSecondary: { backgroundColor: theme.colors.accentAlt },
  ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  ctaBtnTextSecondary: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },

  sectionTitle: { fontWeight: "700", color: theme.colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
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

  weaknessCard: {
    backgroundColor: "#fff5f5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ffd0d0",
    padding: 14,
    gap: 4,
  },
  weaknessDetail: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  weaknessMeta: { color: "#c0392b", fontSize: 12 },

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
});
