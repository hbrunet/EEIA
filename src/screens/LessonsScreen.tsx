import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  US: "🇺🇸",
  UK: "🇬🇧",
  AU: "🇦🇺",
  CA: "🇨🇦",
};

export function LessonsScreen() {
  const { progress, completeSession } = useAppState();
  const lesson = progress?.currentLesson;

  const warmupCount = lesson?.warmupQuestions.length ?? 0;
  const activityCount = lesson?.activities.length ?? 0;

  const [checkedWarmup, setCheckedWarmup] = useState<Record<number, boolean>>({});
  const [checkedActivity, setCheckedActivity] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const doneWarmup = Object.values(checkedWarmup).filter(Boolean).length;
  const doneActivity = Object.values(checkedActivity).filter(Boolean).length;
  const totalItems = warmupCount + activityCount;
  const doneItems = doneWarmup + doneActivity;
  const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const canComplete = doneItems > 0 && !completed;

  function toggleWarmup(i: number) {
    setCheckedWarmup((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function toggleActivity(i: number) {
    setCheckedActivity((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  async function onComplete() {
    if (!lesson || saving) return;
    setSaving(true);
    try {
      await completeSession({
        grammarDelta: checkedActivity[0] ? 3 : 1,
        fluencyDelta: checkedActivity[3] ? 3 : 1,
        pronunciationDelta: doneActivity >= 2 ? 2 : 1,
        listeningDelta: checkedActivity[2] ? 4 : 1,
        accent: lesson.accentFocus,
        notes: `Completado: ${doneItems}/${totalItems} ítems`,
      });
      setCompleted(true);
      Alert.alert("¡Sesión completada!", `Completaste ${doneItems} de ${totalItems} ítems. ¡Buen trabajo!`);
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setCheckedWarmup({});
    setCheckedActivity({});
    setCompleted(false);
  }

  if (!lesson) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={styles.emptyText}>Cargando lección...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lección de hoy</Text>

      <View style={styles.card}>
        <Text style={styles.objective}>{lesson.objective}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {SKILL_LABELS[lesson.focusArea] ?? lesson.focusArea}
            </Text>
          </View>
          <View style={[styles.badge, styles.badgeAccent]}>
            <Text style={styles.badgeText}>{ACCENT_FLAGS[lesson.accentFocus] ?? ""}</Text>
            <Text style={styles.badgeText}> {lesson.accentFocus}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{doneItems}/{totalItems} completados</Text>
        <Text style={styles.progressPct}>{progressPct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🔥 Calentamiento</Text>
        {lesson.warmupQuestions.map((q, i) => (
          <Pressable key={i} style={styles.checkRow} onPress={() => toggleWarmup(i)}>
            <View style={[styles.checkbox, checkedWarmup[i] && styles.checkboxDone]}>
              {checkedWarmup[i] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkText, checkedWarmup[i] && styles.checkTextDone]}>{q}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>⚡ Actividades</Text>
        {lesson.activities.map((a, i) => (
          <Pressable key={i} style={styles.checkRow} onPress={() => toggleActivity(i)}>
            <View style={[styles.checkbox, checkedActivity[i] && styles.checkboxDone]}>
              {checkedActivity[i] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkText, checkedActivity[i] && styles.checkTextDone]}>{a}</Text>
          </Pressable>
        ))}
      </View>

      {progress?.weaknesses && progress.weaknesses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎯 Áreas a reforzar</Text>
          {progress.weaknesses.slice(0, 3).map((w, i) => (
            <View key={i} style={styles.weaknessRow}>
              <View style={[styles.severityDot, { opacity: 0.3 + w.severity * 0.14 }]} />
              <Text style={styles.weaknessText}>{w.detail}</Text>
            </View>
          ))}
        </View>
      )}

      {completed ? (
        <View style={styles.successCard}>
          <Text style={styles.successText}>✅ Sesión completada</Text>
          <Pressable onPress={onReset}>
            <Text style={styles.resetLink}>Empezar nueva sesión</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.button, !canComplete && styles.buttonDisabled]}
          onPress={onComplete}
          disabled={!canComplete || saving}
        >
          <Text style={styles.buttonText}>
            {saving ? "Guardando..." : canComplete ? "Completar sesión" : "Marcá al menos un ítem"}
          </Text>
        </Pressable>
      )}
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
    gap: 10,
  },
  objective: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#ddeef2",
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeAccent: {
    backgroundColor: "#fde8c2",
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: { color: theme.colors.muted, fontSize: 13 },
  progressPct: { color: theme.colors.accent, fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: -8,
  },
  progressFill: {
    height: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accent,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  checkText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  checkTextDone: {
    color: theme.colors.muted,
    textDecorationLine: "line-through",
  },
  weaknessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e05a00",
    flexShrink: 0,
  },
  weaknessText: {
    color: theme.colors.text,
    fontSize: 13,
    flex: 1,
  },
  successCard: {
    backgroundColor: "#e8f5e9",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  successText: {
    color: "#2e7d32",
    fontWeight: "700",
    fontSize: 16,
  },
  resetLink: {
    color: theme.colors.accent,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
