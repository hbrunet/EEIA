import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { fetchExercises } from "../services/api/client";
import { Exercise } from "../types/progress";
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

  const [checkedWarmup, setCheckedWarmup] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Exercise runner state
  type ExercisePhase = "idle" | "loading" | "running" | "done";
  const [exercisePhase, setExercisePhase] = useState<ExercisePhase>("idle");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [exerciseError, setExerciseError] = useState<string | null>(null);

  const doneWarmup = Object.values(checkedWarmup).filter(Boolean).length;
  const exercisesDone =
    exercisePhase === "done"
      ? exercises.length
      : exercisePhase === "running"
      ? exerciseIdx
      : 0;
  const estimatedExercises = exercises.length || 5;
  const totalItems = warmupCount + estimatedExercises;
  const doneItems = doneWarmup + exercisesDone;
  const progressPct =
    exercisePhase === "done" && doneWarmup === warmupCount
      ? 100
      : totalItems > 0
      ? Math.round((doneItems / totalItems) * 100)
      : 0;
  const canComplete = exercisePhase === "done" && !completed;

  function toggleWarmup(i: number) {
    setCheckedWarmup((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  async function onStartExercises() {
    if (!lesson) return;
    setExercisePhase("loading");
    setExerciseError(null);
    try {
      const result = await fetchExercises({
        level: progress?.profile?.level ?? "A2",
        focusArea: lesson.focusArea,
        objective: lesson.objective,
        weaknesses: progress?.weaknesses?.slice(0, 3).map((w) => w.detail) ?? [],
        count: 5,
      });
      setExercises(result.exercises);
      setExerciseIdx(0);
      setExerciseResults([]);
      setSelectedOption(null);
      setFillAnswer("");
      setSubmitted(false);
      setExercisePhase("running");
    } catch {
      setExerciseError("No se pudieron cargar los ejercicios. Intenta de nuevo.");
      setExercisePhase("idle");
    }
  }

  function onSubmitExercise() {
    if (submitted) return;
    setSubmitted(true);
    const ex = exercises[exerciseIdx];
    let isCorrect = false;
    if (ex.type === "multiple_choice") {
      isCorrect = selectedOption === ex.correctIndex;
    } else {
      isCorrect =
        fillAnswer.trim().toLowerCase() === ex.correctAnswer.trim().toLowerCase();
    }
    setExerciseResults((prev) => [...prev, isCorrect]);
  }

  function onNextExercise() {
    if (exerciseIdx + 1 >= exercises.length) {
      setExercisePhase("done");
    } else {
      setExerciseIdx((i) => i + 1);
      setSelectedOption(null);
      setFillAnswer("");
      setSubmitted(false);
    }
  }

  async function onComplete() {
    if (!lesson || saving) return;
    setSaving(true);
    try {
      const score = exerciseResults.filter(Boolean).length;
      const total = exerciseResults.length;
      const pct = total > 0 ? score / total : 0;
      await completeSession({
        grammarDelta: Math.max(1, Math.round(pct * 5)),
        fluencyDelta: 1,
        pronunciationDelta: 1,
        listeningDelta: 1,
        notes: `Ejercicios: ${score}/${total} correctos`,
      });
      setCompleted(true);
      Alert.alert(
        "¡Sesión completada!",
        `Obtuviste ${score}/${total} en los ejercicios. ¡Buen trabajo!`,
      );
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setCheckedWarmup({});
    setExercisePhase("idle");
    setExercises([]);
    setExerciseIdx(0);
    setExerciseResults([]);
    setSelectedOption(null);
    setFillAnswer("");
    setSubmitted(false);
    setExerciseError(null);
    setCompleted(false);
  }

  function renderExercise() {
    const ex = exercises[exerciseIdx];
    if (!ex) return null;

    const isCorrectAnswer =
      ex.type === "multiple_choice"
        ? selectedOption === ex.correctIndex
        : fillAnswer.trim().toLowerCase() === ex.correctAnswer.trim().toLowerCase();

    const canSubmit =
      ex.type === "multiple_choice" ? selectedOption !== null : fillAnswer.trim().length > 0;

    return (
      <View style={styles.card}>
        <Text style={styles.exerciseCounter}>
          Ejercicio {exerciseIdx + 1} de {exercises.length}
        </Text>

        {ex.type === "multiple_choice" ? (
          <Text style={styles.exerciseQuestion}>{ex.question}</Text>
        ) : (
          <Text style={styles.exerciseQuestion}>
            {ex.sentence.replace("___", "_____")}
          </Text>
        )}

        {ex.type === "multiple_choice"
          ? ex.options.map((opt, i) => {
              const isSelected = i === selectedOption;
              const isCorrectOpt = i === ex.correctIndex;
              const extraStyle = submitted
                ? isCorrectOpt
                  ? styles.optionBtnCorrect
                  : isSelected
                  ? styles.optionBtnWrong
                  : undefined
                : isSelected
                ? styles.optionBtnSelected
                : undefined;
              return (
                <Pressable
                  key={i}
                  style={[styles.optionBtn, extraStyle]}
                  onPress={() => !submitted && setSelectedOption(i)}
                  disabled={submitted}
                >
                  <Text style={styles.optionBtnText}>{opt}</Text>
                </Pressable>
              );
            })
          : (
            <>
              {(ex as any).hint ? (
                <Text style={styles.exerciseHint}>Pista: {(ex as any).hint}</Text>
              ) : null}
              <TextInput
                style={styles.fillInput}
                value={fillAnswer}
                onChangeText={setFillAnswer}
                placeholder="Escribe tu respuesta..."
                editable={!submitted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

        {!submitted ? (
          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.buttonDisabled]}
            onPress={onSubmitExercise}
            disabled={!canSubmit}
          >
            <Text style={styles.buttonText}>Verificar</Text>
          </Pressable>
        ) : (
          <>
            <View
              style={[
                styles.feedbackBox,
                isCorrectAnswer ? styles.feedbackCorrect : styles.feedbackWrong,
              ]}
            >
              <Text style={styles.feedbackText}>
                {isCorrectAnswer
                  ? "✅ ¡Correcto!"
                  : `❌ Respuesta: "${
                      ex.type === "fill_blank"
                        ? ex.correctAnswer
                        : ex.options[ex.correctIndex]
                    }"`}
              </Text>
              <Text style={styles.feedbackExplanation}>{ex.explanation}</Text>
            </View>
            <Pressable style={styles.nextBtn} onPress={onNextExercise}>
              <Text style={styles.buttonText}>
                {exerciseIdx + 1 >= exercises.length ? "Ver resultado" : "Siguiente →"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  function renderExercisesSection() {
    switch (exercisePhase) {
      case "idle":
        return (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⚡ Ejercicios interactivos</Text>
            {exerciseError ? (
              <Text style={styles.errorText}>{exerciseError}</Text>
            ) : null}
            <Pressable style={styles.exerciseStartBtn} onPress={onStartExercises}>
              <Text style={styles.buttonText}>Iniciar ejercicios</Text>
            </Pressable>
          </View>
        );
      case "loading":
        return (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⚡ Ejercicios interactivos</Text>
            <ActivityIndicator size="small" color="#6C63FF" style={{ marginTop: 12 }} />
            <Text style={styles.loadingText}>Generando ejercicios...</Text>
          </View>
        );
      case "running":
        return renderExercise();
      case "done": {
        const score = exerciseResults.filter(Boolean).length;
        const total = exerciseResults.length;
        return (
          <View style={[styles.card, styles.scoreCard]}>
            <Text style={styles.scoreTitle}>🏆 Resultado de ejercicios</Text>
            <Text style={styles.scoreValue}>
              {score} / {total}
            </Text>
            <Text style={styles.scoreSubtitle}>
              {score === total
                ? "¡Perfecto! Sin errores."
                : score >= Math.ceil(total * 0.7)
                ? "¡Muy bien! Sigue así."
                : "¡Buen intento! Sigue practicando."}
            </Text>
          </View>
        );
      }
    }
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

      {renderExercisesSection()}

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
            {saving
              ? "Guardando..."
              : canComplete
              ? "Completar sesión"
              : exercisePhase === "idle" || exercisePhase === "loading"
              ? "Completa los ejercicios"
              : "Cargando..."}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

