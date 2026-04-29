import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { styles } from "./LessonsScreen.styles";

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
            <Text style={styles.badgeText}>{ACCENT_FLAGS[lesson.accentFocus ?? ""] ?? ""}</Text>
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

