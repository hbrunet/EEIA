import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { fetchExercises, fetchListeningExercises } from "../services/api/client";
import { Exercise } from "../types/progress";
import { useAppState } from "../state/AppContext";
import { TappableText } from "../ui/TappableText";
import { styles } from "./LessonsScreen.styles";

const SKILL_LABELS: Record<string, string> = {
  grammar: "Gramática",
  fluency: "Fluidez",
  pronunciation: "Pronunciación",
  listening: "Comprensión",
  vocabulary: "Vocabulario",
};

type ExercisePhase = "idle" | "loading" | "running" | "done";

const RECENT_TOPICS_KEY = "exercises_recent_topics";
const MAX_RECENT_TOPICS = 20;

export function LessonsScreen() {
  const { progress, recordExerciseResults } = useAppState();
  const lesson = progress?.currentLesson;

  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [exercisePhase, setExercisePhase] = useState<ExercisePhase>("idle");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [fillAnswer, setFillAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const progressPct =
    exercisePhase === "done"
      ? 100
      : exercisePhase === "running" && exercises.length > 0
      ? Math.round((exerciseIdx / exercises.length) * 100)
      : 0;

  async function onStartExercises() {
    if (!lesson) return;
    setExercisePhase("loading");
    setExerciseError(null);
    try {
      const storedRaw = await AsyncStorage.getItem(RECENT_TOPICS_KEY).catch(() => null);
      const recentTopics: string[] = storedRaw ? JSON.parse(storedRaw) : [];

      const isListening = lesson.focusArea === "listening";
      const fetchFn = isListening ? fetchListeningExercises : fetchExercises;
      const result = await fetchFn({
        level: progress?.profile?.level ?? "A2",
        focusArea: lesson.focusArea,
        objective: lesson.objective,
        weaknesses: progress?.weaknesses?.slice(0, 3).map((w) => w.detail) ?? [],
        count: 5,
        recentTopics,
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
    if (ex.type === "multiple_choice" || ex.type === "listening_comprehension") {
      isCorrect = selectedOption === ex.correctIndex;
    } else {
      isCorrect = fillAnswer.trim().toLowerCase() === ex.correctAnswer.trim().toLowerCase();
    }
    setExerciseResults((prev) => [...prev, isCorrect]);
  }

  function onNextExercise() {
    Speech.stop();
    if (exerciseIdx + 1 >= exercises.length) {
      setExercisePhase("done");
    } else {
      setExerciseIdx((i) => i + 1);
      setSelectedOption(null);
      setFillAnswer("");
      setSubmitted(false);
      setIsPlaying(false);
      setHasPlayed(false);
    }
  }

  async function onComplete() {
    if (!lesson || saving) return;
    setSaving(true);
    try {
      // Persist topics covered in this session to avoid repeats next time
      const newTopics = exercises
        .map((ex) => ex.topic)
        .filter((t): t is string => Boolean(t));
      if (newTopics.length > 0) {
        const storedRaw = await AsyncStorage.getItem(RECENT_TOPICS_KEY).catch(() => null);
        const existing: string[] = storedRaw ? JSON.parse(storedRaw) : [];
        const merged = [...newTopics, ...existing.filter((t) => !newTopics.includes(t))].slice(0, MAX_RECENT_TOPICS);
        AsyncStorage.setItem(RECENT_TOPICS_KEY, JSON.stringify(merged)).catch(() => {});
      }

      await recordExerciseResults({
        exercises,
        results: exerciseResults,
        focusArea: lesson.focusArea,
        level: progress?.profile?.level ?? "A2",
      });

      const score = exerciseResults.filter(Boolean).length;
      const total = exerciseResults.length;
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
    Speech.stop();
    setExercisePhase("idle");
    setExercises([]);
    setExerciseIdx(0);
    setExerciseResults([]);
    setSelectedOption(null);
    setFillAnswer("");
    setSubmitted(false);
    setExerciseError(null);
    setCompleted(false);
    setIsPlaying(false);
    setHasPlayed(false);
  }

  if (!lesson) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={styles.emptyText}>Cargando lección...</Text>
      </View>
    );
  }

  function renderExercise() {
    const ex = exercises[exerciseIdx];
    if (!ex) return null;

    // ── Listening comprehension ───────────────────────────────────────────────
    if (ex.type === "listening_comprehension") {
      const listenEx = ex;
      const isCorrectAnswer = selectedOption === listenEx.correctIndex;
      const canSubmit = hasPlayed && selectedOption !== null;

      function playPassage() {
        setIsPlaying(true);
        Speech.speak(listenEx.passage, {
          language: "en-US",
          rate: 0.85,
          onDone: () => { setIsPlaying(false); setHasPlayed(true); },
          onError: () => { setIsPlaying(false); setHasPlayed(true); },
        });
      }

      return (
        <View style={styles.card}>
          <Text style={styles.exerciseCounter}>
            Ejercicio {exerciseIdx + 1} de {exercises.length}
          </Text>

          {/* Audio player */}
          <View style={{ alignItems: "center", marginVertical: 12 }}>
            <Pressable
              style={[styles.exerciseStartBtn, isPlaying && styles.buttonDisabled]}
              onPress={playPassage}
              disabled={isPlaying}
            >
              <Text style={styles.buttonText}>
                {isPlaying ? "Reproduciendo..." : hasPlayed ? "Escuchar de nuevo" : "▶  Escuchar"}
              </Text>
            </Pressable>
            {!hasPlayed && (
              <Text style={{ color: "#888", fontSize: 12, marginTop: 6 }}>
                Escucha el audio antes de responder
              </Text>
            )}
          </View>

          {/* Passage revealed after answering */}
          {submitted && (
            <View style={{ backgroundColor: "#f0f4ff", borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Texto completo:</Text>
              <Text style={{ fontSize: 14, color: "#222", fontStyle: "italic" }}>{listenEx.passage}</Text>
            </View>
          )}

          <Text style={styles.exerciseQuestion}>{listenEx.question}</Text>

          {listenEx.options.map((opt, i) => {
            const isSelected = i === selectedOption;
            const isCorrectOpt = i === listenEx.correctIndex;
            const extraStyle = submitted
              ? isCorrectOpt ? styles.optionBtnCorrect : isSelected ? styles.optionBtnWrong : undefined
              : isSelected ? styles.optionBtnSelected : undefined;
            return (
              <Pressable
                key={i}
                style={[styles.optionBtn, extraStyle]}
                onPress={() => !submitted && hasPlayed && setSelectedOption(i)}
                disabled={submitted || !hasPlayed}
              >
                <Text style={styles.optionBtnText}>{opt}</Text>
              </Pressable>
            );
          })}

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
              <View style={[styles.feedbackBox, isCorrectAnswer ? styles.feedbackCorrect : styles.feedbackWrong]}>
                <Text style={styles.feedbackText}>
                  {isCorrectAnswer ? "✅ ¡Correcto!" : `❌ Respuesta: "${listenEx.options[listenEx.correctIndex]}"`}
                </Text>
                <Text style={styles.feedbackExplanation}>{listenEx.explanation}</Text>
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

    // ── Grammar / fill_blank / multiple_choice ────────────────────────────────
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

        <TappableText
          text={ex.type === "multiple_choice" ? ex.question : ex.sentence.replace("___", "_____")}
          style={styles.exerciseQuestion}
          level={progress?.profile?.level}
          resetKey={exerciseIdx}
        />

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
            <View style={[styles.feedbackBox, isCorrectAnswer ? styles.feedbackCorrect : styles.feedbackWrong]}>
              <Text style={styles.feedbackText}>
                {isCorrectAnswer
                  ? "✅ ¡Correcto!"
                  : `❌ Respuesta: "${ex.type === "fill_blank" ? ex.correctAnswer : ex.options[ex.correctIndex]}"`}
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header: objetivo + área */}
      <View style={styles.card}>
        <Text style={styles.objective}>{lesson.objective}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {SKILL_LABELS[lesson.focusArea] ?? lesson.focusArea}
            </Text>
          </View>
          <View style={[styles.badge, styles.badgeAccent]}>
            <Text style={styles.badgeText}>
              {progress?.profile?.level ?? "A2"}
            </Text>
          </View>
        </View>
      </View>

      {/* Barra de progreso */}
      {exercisePhase !== "idle" && (
        <>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {exercisePhase === "done"
                ? `${exercises.length}/${exercises.length} ejercicios`
                : `${exerciseIdx}/${exercises.length} ejercicios`}
            </Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
        </>
      )}

      {/* Runner de ejercicios */}
      {exercisePhase === "idle" && (
        <View style={styles.card}>
          {exerciseError ? <Text style={styles.errorText}>{exerciseError}</Text> : null}
          <Pressable style={styles.exerciseStartBtn} onPress={onStartExercises}>
            <Text style={styles.buttonText}>Iniciar ejercicios</Text>
          </Pressable>
        </View>
      )}

      {exercisePhase === "loading" && (
        <View style={styles.card}>
          <ActivityIndicator size="small" color={styles.exerciseStartBtn.backgroundColor as string} style={{ marginTop: 4 }} />
          <Text style={styles.loadingText}>Generando ejercicios...</Text>
        </View>
      )}

      {exercisePhase === "running" && renderExercise()}

      {exercisePhase === "done" && (() => {
        const score = exerciseResults.filter(Boolean).length;
        const total = exerciseResults.length;
        return (
          <View style={[styles.card, styles.scoreCard]}>
            <Text style={styles.scoreTitle}>🏆 Resultado</Text>
            <Text style={styles.scoreValue}>{score} / {total}</Text>
            <Text style={styles.scoreSubtitle}>
              {score === total
                ? "¡Perfecto! Sin errores."
                : score >= Math.ceil(total * 0.7)
                ? "¡Muy bien! Sigue así."
                : "¡Buen intento! Sigue practicando."}
            </Text>
          </View>
        );
      })()}

      {/* Botón completar / reiniciar */}
      {completed ? (
        <View style={styles.successCard}>
          <Text style={styles.successText}>✅ Sesión completada</Text>
          <Pressable onPress={onReset}>
            <Text style={styles.resetLink}>Hacer otra serie</Text>
          </Pressable>
        </View>
      ) : exercisePhase === "done" ? (
        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={onComplete}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? "Guardando..." : "Completar sesión"}</Text>
        </Pressable>
      ) : null}

    </ScrollView>
  );
}

