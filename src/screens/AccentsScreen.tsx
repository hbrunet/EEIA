import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { assessPronunciation, fetchShadowingPhrases, PronunciationAssessmentResponse } from "../services/api/client";
import { useAppState } from "../state/AppContext";
import { Accent } from "../types/progress";
import { theme } from "../ui/theme";

const ACCENT_META: Record<Accent, { flag: string; name: string; locale: string; description: string }> = {
  US: { flag: "🇺🇸", name: "Inglés americano", locale: "en-US", description: "El más común en cine, series y negocios globales." },
  UK: { flag: "🇬🇧", name: "Inglés británico", locale: "en-GB", description: "Estándar en educación formal y medios internacionales." },
  AU: { flag: "🇦🇺", name: "Inglés australiano", locale: "en-AU", description: "Vocales abiertas y entonación ascendente característica." },
  CA: { flag: "🇨🇦", name: "Inglés canadiense", locale: "en-CA", description: "Mezcla de rasgos americanos y británicos, muy claro." },
};

const SHADOWING_FALLBACK: Record<"básico" | "intermedio" | "avanzado", string[]> = {
  básico: [
    "Hello, good morning.",
    "My name is Sofia.",
    "I like apples.",
    "Where is the bus stop?",
    "I need water, please.",
    "Can you help me?",
  ],
  intermedio: [
    "I usually study English after dinner.",
    "Could you speak a little slower, please?",
    "I am getting better at pronunciation every week.",
    "I need to explain this idea clearly in my meeting.",
    "I will send you the updated report by the end of the day.",
    "I felt nervous at first, but then I spoke with more confidence.",
  ],
  avanzado: [
    "I would appreciate your feedback on my presentation style.",
    "The results were encouraging, although not entirely conclusive.",
    "We should prioritize clarity over complexity in this discussion.",
    "I acknowledge your concerns; however, the long-term benefits justify the risk.",
    "The negotiation stalled when both parties underestimated cultural nuances.",
    "Despite the constraints, the team produced a remarkably coherent solution.",
  ],
};

const ACCENTS: Accent[] = ["US", "UK", "AU", "CA"];

function buildWordMatches(targetWords: string[], transcriptWords: string[]): boolean[] {
  const counts = transcriptWords.reduce<Record<string, number>>((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  return targetWords.map((word) => {
    if ((counts[word] || 0) > 0) {
      counts[word] -= 1;
      return true;
    }

    return false;
  });
}

function normalizeWordToken(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "").trim();
}

function formatDayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createShuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, index) => index);

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = indices[index];
    indices[index] = indices[randomIndex];
    indices[randomIndex] = temp;
  }

  return indices;
}

function createShadowingPhraseKey(level: "básico" | "intermedio" | "avanzado", phrase: string): string {
  return `${level}::${phrase.trim().toLowerCase()}`;
}

function createShadowingOrder(
  phrases: string[],
  level: "básico" | "intermedio" | "avanzado",
  seenPhraseKeys: Set<string>,
): number[] {
  const unseenIndices: number[] = [];
  const seenIndices: number[] = [];

  phrases.forEach((phrase, index) => {
    const key = createShadowingPhraseKey(level, phrase);
    if (seenPhraseKeys.has(key)) {
      seenIndices.push(index);
      return;
    }

    unseenIndices.push(index);
  });

  const shuffledUnseen = createShuffledIndices(unseenIndices.length).map((idx) => unseenIndices[idx]);
  const shuffledSeen = createShuffledIndices(seenIndices.length).map((idx) => seenIndices[idx]);

  return [...shuffledUnseen, ...shuffledSeen];
}

function mergeRetryIntoAssessment(
  previous: PronunciationAssessmentResponse,
  retriedWord: string,
  retryScore: number,
): PronunciationAssessmentResponse {
  const normalizedRetryWord = normalizeWordToken(retriedWord);
  if (!normalizedRetryWord) return previous;

  const retryPassed = retryScore >= 75;
  const alreadyMatched = previous.transcriptWords.some((word) => normalizeWordToken(word) === normalizedRetryWord);
  const nextTranscriptWords = retryPassed && !alreadyMatched
    ? [...previous.transcriptWords, normalizedRetryWord]
    : previous.transcriptWords;

  const nextMissedWords = retryPassed
    ? previous.missedWords.filter((word) => normalizeWordToken(word) !== normalizedRetryWord)
    : previous.missedWords;

  const blendedScore = retryPassed
    ? previous.accuracyScore * 0.8 + retryScore * 0.2
    : previous.accuracyScore * 0.9 + retryScore * 0.1;

  const improvedSummary = retryPassed
    ? `Buen reintento en "${retriedWord}". Se actualizó la evaluación general.`
    : `Reintento registrado para "${retriedWord}". Seguimos practicando ese sonido.`;

  const nextImprovements = retryPassed
    ? previous.improvements.filter((tip) => !tip.toLowerCase().includes(normalizedRetryWord))
    : previous.improvements;

  return {
    ...previous,
    accuracyScore: clampScore(blendedScore),
    transcriptWords: nextTranscriptWords,
    missedWords: nextMissedWords,
    summary: improvedSummary,
    improvements: nextImprovements.length > 0 ? nextImprovements : previous.improvements,
  };
}

function getFriendlyPronunciationError(error: unknown, context: "phrase" | "word" | "routine"): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("empty") ||
    normalized.includes("no speech") ||
    normalized.includes("silence") ||
    normalized.includes("failed: 400")
  ) {
    return context === "phrase"
      ? "No detectamos voz en tu intento. Probá de nuevo diciendo la frase completa cerca del micrófono."
      : "No detectamos voz en tu intento. Probá de nuevo pronunciando la palabra en voz clara.";
  }

  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("timeout")) {
    return "No pudimos evaluar por un problema de conexión. Revisá internet e intentá nuevamente.";
  }

  if (context === "phrase") return "No pudimos evaluar tu pronunciación en este intento. Probá de nuevo.";
  if (context === "routine") return "No pudimos evaluar esta palabra de la rutina. Intentá nuevamente.";
  return "No pudimos evaluar la palabra seleccionada. Intentá nuevamente.";
}

function getFriendlyRecordingStartError(error: unknown, context: "phrase" | "word" | "routine"): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("permission") || normalized.includes("not allowed")) {
    return "No tenemos permiso de micrófono. Activá el permiso e intentá nuevamente.";
  }

  if (normalized.includes("audio mode") || normalized.includes("busy") || normalized.includes("interrupted")) {
    return "No pudimos iniciar la grabación porque el audio del dispositivo está ocupado. Probá otra vez en unos segundos.";
  }

  if (context === "phrase") return "No pudimos iniciar la grabación para evaluar la frase.";
  if (context === "routine") return "No pudimos iniciar la grabación para la rutina diaria.";
  return "No pudimos iniciar la grabación de la palabra.";
}

function computePracticeStreak(days: string[]): number {
  if (days.length === 0) return 0;

  const unique = Array.from(new Set(days)).sort();
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!unique.includes(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function AccentsScreen() {
  const {
    progress,
    recordShadowingPhraseSeen,
    recordPronunciationPractice,
    recordPronunciationWordAttempts,
    recordPronunciationWordAttempt,
    recordDailyRoutineCompleted,
  } = useAppState();
  const [playing, setPlaying] = useState<Accent | null>(null);
  const [speakMode, setSpeakMode] = useState<"free" | "shadow">("free");
  const [shadowLevel, setShadowLevel] = useState<"básico" | "intermedio" | "avanzado">("básico");
  const [shadowPhrasePool, setShadowPhrasePool] = useState<string[]>(SHADOWING_FALLBACK["básico"]);
  const [shadowPhrasesLoading, setShadowPhrasesLoading] = useState(false);
  const [shadowOrder, setShadowOrder] = useState<number[]>(() => createShuffledIndices(SHADOWING_FALLBACK.básico.length));
  const [shadowCursor, setShadowCursor] = useState(0);
  const [customText, setCustomText] = useState("Hello! I am learning English pronunciation.");
  const [customAccent, setCustomAccent] = useState<Accent>("US");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessment, setAssessment] = useState<PronunciationAssessmentResponse | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordRecording, setWordRecording] = useState<Audio.Recording | null>(null);
  const [isWordAssessing, setIsWordAssessing] = useState(false);
  const [wordAssessment, setWordAssessment] = useState<PronunciationAssessmentResponse | null>(null);
  const [wordAssessmentError, setWordAssessmentError] = useState<string | null>(null);
  const [routineStep, setRoutineStep] = useState<1 | 2 | 3>(1);
  const [routineWordIndex, setRoutineWordIndex] = useState(0);
  const [routineListened, setRoutineListened] = useState<string[]>([]);
  const [routineResults, setRoutineResults] = useState<Array<{ word: string; score: number }>>([]);
  const [routineBaselineAvg, setRoutineBaselineAvg] = useState<number>(0);
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);

  const shadowPhrases = shadowPhrasePool;
  const shadowPhraseIndex = shadowOrder[shadowCursor] ?? 0;
  const currentShadowPhrase = shadowPhrases[shadowPhraseIndex] || "";
  const seenShadowingPhraseKeys = new Set(progress?.shadowingPractice?.seenPhraseKeys || []);

  function getSpeechOptions(accent: Accent, rate = 0.9): Speech.SpeechOptions {
    const locale = ACCENT_META[accent].locale;
    const normalizedLocale = locale.toLowerCase();
    const voice = availableVoices.find((item) => item.language?.toLowerCase() === normalizedLocale)
      || availableVoices.find((item) => item.language?.toLowerCase().startsWith(normalizedLocale));

    return {
      language: locale,
      ...(voice ? { voice: voice.identifier } : {}),
      rate,
      pitch: 1,
    };
  }

  function playCustomText() {
    const trimmed = customText.trim();
    if (!trimmed) return;

    Speech.stop();
    setPlaying(customAccent);
    Speech.speak(trimmed, {
      ...getSpeechOptions(customAccent, 0.9),
      onDone: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  }

  function playShadowPhrase() {
    Speech.stop();
    setPlaying(customAccent);
    if (currentShadowPhrase) {
      void recordShadowingPhraseSeen(shadowLevel, currentShadowPhrase);
    }
    Speech.speak(currentShadowPhrase, {
      ...getSpeechOptions(customAccent, 0.88),
      onDone: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  }

  function nextShadowPhrase() {
    Speech.stop();
    setPlaying(null);
    setAssessment(null);
    setAssessmentError(null);
    if (shadowPhrases.length <= 1) return;

    if (shadowCursor >= shadowOrder.length - 1) {
      setShadowOrder(createShadowingOrder(shadowPhrases, shadowLevel, seenShadowingPhraseKeys));
      setShadowCursor(0);
      return;
    }

    setShadowCursor((index) => index + 1);
  }

  useEffect(() => {
    const nextOrder = createShadowingOrder(shadowPhrases, shadowLevel, seenShadowingPhraseKeys);
    setShadowOrder(nextOrder);
    setShadowCursor(0);
  }, [shadowPhrasePool, shadowLevel, progress?.shadowingPractice?.dateKey, progress?.shadowingPractice?.seenPhraseKeys]);

  useEffect(() => {
    let cancelled = false;
    setShadowPhrasesLoading(true);

    const seenKeys = new Set(progress?.shadowingPractice?.seenPhraseKeys || []);
    const recentlySeenPhrases = shadowPhrasePool.filter((p) =>
      seenKeys.has(createShadowingPhraseKey(shadowLevel, p)),
    );

    fetchShadowingPhrases(shadowLevel, 12, recentlySeenPhrases)
      .then((phrases) => {
        if (!cancelled && phrases.length > 0) {
          setShadowPhrasePool(phrases);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShadowPhrasePool(SHADOWING_FALLBACK[shadowLevel]);
        }
      })
      .finally(() => {
        if (!cancelled) setShadowPhrasesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shadowLevel]);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => setAvailableVoices(Array.isArray(voices) ? voices : []))
      .catch(() => setAvailableVoices([]));

    return () => {
      Speech.stop();
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => null);
      }
      if (wordRecording) {
        wordRecording.stopAndUnloadAsync().catch(() => null);
      }
    };
  }, [recording, wordRecording]);

  async function onPronunciationPress() {
    const targetText = speakMode === "shadow" ? currentShadowPhrase : customText.trim();
    const trimmed = targetText.trim();
    if (!trimmed || isAssessing) return;

    if (recording) {
      setIsAssessing(true);
      setAssessmentError(null);

      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        if (!uri) {
          throw new Error("No se pudo recuperar el audio grabado.");
        }

        const result = await assessPronunciation(uri, trimmed, customAccent);
        setAssessment(result);
        await recordPronunciationPractice(result.accuracyScore, customAccent);

        const missed = new Set(result.missedWords.map((word) => normalizeWordToken(word)).filter(Boolean));
        const attempts = Array.from(new Set(result.targetWords.map((word) => normalizeWordToken(word)).filter(Boolean))).map((word) => ({
          word,
          score: missed.has(word) ? Math.max(35, Math.min(68, result.accuracyScore - 8)) : Math.max(80, result.accuracyScore),
          accent: customAccent,
        }));
        await recordPronunciationWordAttempts(attempts);
      } catch (error) {
        setAssessmentError(getFriendlyPronunciationError(error, "phrase"));
      } finally {
        setIsAssessing(false);
      }

      return;
    }

    try {
      setAssessmentError(null);
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setAssessmentError("Necesitamos acceso al micrófono para evaluar tu pronunciación.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setAssessment(null);
      setRecording(newRecording);
    } catch (error) {
      setAssessmentError(getFriendlyRecordingStartError(error, "phrase"));
    }
  }

  function playSelectedWord() {
    if (!selectedWord) return;

    Speech.stop();
    setPlaying(customAccent);
    Speech.speak(selectedWord, {
      ...getSpeechOptions(customAccent, 0.82),
      onDone: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  }

  async function onWordPracticePress() {
    if (!selectedWord || isWordAssessing) return;

    if (wordRecording) {
      setIsWordAssessing(true);
      setWordAssessmentError(null);

      try {
        await wordRecording.stopAndUnloadAsync();
        const uri = wordRecording.getURI();
        setWordRecording(null);

        if (!uri) {
          throw new Error("No se pudo recuperar el audio grabado.");
        }

        const result = await assessPronunciation(uri, selectedWord, customAccent);
        setWordAssessment(result);
        await recordPronunciationPractice(result.accuracyScore, customAccent);
        await recordPronunciationWordAttempt(normalizeWordToken(selectedWord), result.accuracyScore, customAccent);
        setAssessment((prev) => {
          if (!prev) return prev;
          return mergeRetryIntoAssessment(prev, selectedWord, result.accuracyScore);
        });
      } catch (error) {
        setWordAssessmentError(getFriendlyPronunciationError(error, "word"));
      } finally {
        setIsWordAssessing(false);
      }

      return;
    }

    try {
      setWordAssessmentError(null);
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setWordAssessmentError("Necesitamos acceso al micrófono para practicar esa palabra.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setWordAssessment(null);
      setWordRecording(newRecording);
    } catch (error) {
      setWordAssessmentError(getFriendlyRecordingStartError(error, "word"));
    }
  }

  function startRoutine() {
    if (routineWords.length === 0) return;
    setRoutineStep(1);
    setRoutineWordIndex(0);
    setRoutineListened([]);
    setRoutineResults([]);
    setRoutineBaselineAvg(
      Math.round((dailyRoutineWords.reduce((sum, item) => sum + item.avgScore, 0) / dailyRoutineWords.length) * 10) / 10,
    );
    setSelectedWord(null);
    setWordAssessment(null);
    setWordAssessmentError(null);
  }

  function onRoutineHeardWord() {
    if (!currentRoutineWord) return;
    setRoutineListened((prev) => Array.from(new Set([...prev, currentRoutineWord])));

    if (routineWordIndex >= routineWords.length - 1) {
      setRoutineStep(2);
      setRoutineWordIndex(0);
      return;
    }

    setRoutineWordIndex((index) => index + 1);
  }

  function playCurrentRoutineWord() {
    if (!currentRoutineWord) return;
    Speech.stop();
    setPlaying(customAccent);
    Speech.speak(currentRoutineWord, {
      ...getSpeechOptions(customAccent, 0.82),
      onDone: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  }

  async function onRoutineRecordPress() {
    if (!currentRoutineWord || routineStep !== 2 || isWordAssessing) return;

    if (wordRecording) {
      setIsWordAssessing(true);
      setWordAssessmentError(null);
      try {
        await wordRecording.stopAndUnloadAsync();
        const uri = wordRecording.getURI();
        setWordRecording(null);
        if (!uri) throw new Error("No se pudo recuperar el audio grabado.");

        const result = await assessPronunciation(uri, currentRoutineWord, customAccent);
        await recordPronunciationPractice(result.accuracyScore, customAccent);
        await recordPronunciationWordAttempt(currentRoutineWord, result.accuracyScore, customAccent);

        setRoutineResults((prev) => {
          const without = prev.filter((item) => item.word !== currentRoutineWord);
          return [...without, { word: currentRoutineWord, score: result.accuracyScore }];
        });

        if (routineWordIndex >= routineWords.length - 1) {
          setRoutineStep(3);
          await recordDailyRoutineCompleted();
        } else {
          setRoutineWordIndex((index) => index + 1);
        }
      } catch (error) {
        setWordAssessmentError(getFriendlyPronunciationError(error, "routine"));
      } finally {
        setIsWordAssessing(false);
      }
      return;
    }

    try {
      setWordAssessmentError(null);
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setWordAssessmentError("Necesitamos acceso al micrófono para completar la rutina diaria.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setWordRecording(newRecording);
    } catch (error) {
      setWordAssessmentError(getFriendlyRecordingStartError(error, "routine"));
    }
  }

  const pronunciationScoreColor = assessment
    ? assessment.accuracyScore >= 85
      ? "#4caf50"
      : assessment.accuracyScore >= 65
        ? "#ffc107"
        : "#f44336"
    : theme.colors.text;

  const isPlayingCustom = playing === customAccent;
  const wordMatches = assessment ? buildWordMatches(assessment.targetWords, assessment.transcriptWords) : [];
  const dailyRoutineWords = [...(progress?.pronunciationWordStats || [])]
    .map((item) => ({
      ...item,
      difficultyScore:
        (100 - item.avgScore) +
        item.lowScoreCount * 8 +
        Math.max(0, 4 - item.attempts) * 2,
    }))
    .sort((a, b) => b.difficultyScore - a.difficultyScore)
    .slice(0, 5);
  const routineWords = dailyRoutineWords.map((item) => item.word);
  const currentRoutineWord = routineWords[routineWordIndex] || null;
  const practiceStreak = computePracticeStreak((progress?.pronunciationWordStats || []).map((item) => formatDayKey(item.lastPracticedAt)));

  useEffect(() => {
    if (dailyRoutineWords.length === 0) return;
    if (routineStep === 1 && routineListened.length === 0 && routineResults.length === 0) {
      setRoutineBaselineAvg(
        Math.round((dailyRoutineWords.reduce((sum, item) => sum + item.avgScore, 0) / dailyRoutineWords.length) * 10) / 10,
      );
      setRoutineWordIndex((index) => Math.min(index, Math.max(dailyRoutineWords.length - 1, 0)));
    }
  }, [dailyRoutineWords, routineStep, routineListened.length, routineResults.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pronunciación</Text>
      <Text style={styles.helper}>
        Practicá en modo libre o seguí frases guiadas con feedback inmediato de pronunciación.
      </Text>

      <View style={styles.speakCard}>
          {speakMode === "shadow" && (
            <Text style={styles.shadowHint}>El sistema prioriza frases no vistas hoy para evitar repetición.</Text>
          )}

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeBtn, speakMode === "free" && styles.modeBtnActive]}
              onPress={() => {
                setSpeakMode("free");
                setAssessment(null);
                setAssessmentError(null);
                setSelectedWord(null);
                setWordAssessment(null);
                setWordAssessmentError(null);
                Speech.stop();
                setPlaying(null);
              }}
            >
              <Text style={[styles.modeBtnText, speakMode === "free" && styles.modeBtnTextActive]}>Texto libre</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, speakMode === "shadow" && styles.modeBtnActive]}
              onPress={() => {
                setSpeakMode("shadow");
                setAssessment(null);
                setAssessmentError(null);
                setSelectedWord(null);
                setWordAssessment(null);
                setWordAssessmentError(null);
                Speech.stop();
                setPlaying(null);
              }}
            >
              <Text style={[styles.modeBtnText, speakMode === "shadow" && styles.modeBtnTextActive]}>Shadowing</Text>
            </Pressable>
          </View>

          {speakMode === "free" ? (
            <>
              <TextInput
                value={customText}
                onChangeText={(value) => {
                  setCustomText(value);
                  setAssessment(null);
                  setAssessmentError(null);
                  setSelectedWord(null);
                  setWordAssessment(null);
                  setWordAssessmentError(null);
                }}
                multiline
                textAlignVertical="top"
                placeholder="Write a sentence in English..."
                placeholderTextColor={theme.colors.muted}
                style={styles.textInput}
              />

              <Pressable
                style={[styles.speakBtn, isPlayingCustom && styles.listenBtnActive, !customText.trim() && styles.speakBtnDisabled]}
                onPress={playCustomText}
                disabled={!customText.trim()}
              >
                <Text style={styles.speakBtnText}>{isPlayingCustom ? "⏸ Reproduciendo..." : "▶ Pronunciar en inglés"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.levelRow}>
                {(["básico", "intermedio", "avanzado"] as const).map((lvl) => (
                  <Pressable
                    key={`shadow-${lvl}`}
                    style={[styles.levelBtn, shadowLevel === lvl && styles.levelBtnActive]}
                    onPress={() => {
                      setShadowLevel(lvl);
                      setAssessment(null);
                      setAssessmentError(null);
                      setSelectedWord(null);
                      setWordAssessment(null);
                      setWordAssessmentError(null);
                      Speech.stop();
                      setPlaying(null);
                    }}
                  >
                    <Text style={[styles.levelBtnText, shadowLevel === lvl && styles.levelBtnTextActive]}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.shadowCard}>
                {shadowPhrasesLoading ? (
                  <Text style={styles.phraseLabel}>Generando frases nuevas…</Text>
                ) : (
                  <>
                    <Text style={styles.phraseLabel}>Frase {shadowCursor + 1}/{shadowPhrases.length}</Text>
                    <Text style={styles.phraseText}>"{currentShadowPhrase}"</Text>
                  </>
                )}
                <View style={styles.shadowActions}>
                  <Pressable style={[styles.shadowActionBtn, shadowPhrasesLoading && styles.speakBtnDisabled]} onPress={playShadowPhrase} disabled={shadowPhrasesLoading}>
                    <Text style={styles.shadowActionText}>▶ Escuchar modelo</Text>
                  </Pressable>
                  <Pressable style={[styles.shadowActionBtn, shadowPhrasesLoading && styles.speakBtnDisabled]} onPress={nextShadowPhrase} disabled={shadowPhrasesLoading}>
                    <Text style={styles.shadowActionText}>Siguiente frase</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          <View style={styles.customAccentRow}>
            {ACCENTS.map((accent) => {
              const selected = customAccent === accent;
              return (
                <Pressable
                  key={`custom-${accent}`}
                  style={[styles.customAccentBtn, selected && styles.customAccentBtnActive]}
                  onPress={() => {
                    setCustomAccent(accent);
                    setAssessment(null);
                    setAssessmentError(null);
                    setSelectedWord(null);
                    setWordAssessment(null);
                    setWordAssessmentError(null);
                  }}
                >
                  <Text style={styles.customAccentFlag}>{ACCENT_META[accent].flag}</Text>
                  <Text style={[styles.customAccentText, selected && styles.customAccentTextActive]}>{accent}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[
              styles.recordBtn,
              recording && styles.recordBtnActive,
              (((speakMode === "free" && !customText.trim()) || isAssessing || Boolean(wordRecording) || isWordAssessing)) && styles.speakBtnDisabled,
            ]}
            onPress={onPronunciationPress}
            disabled={((speakMode === "free" && !customText.trim()) || isAssessing || Boolean(wordRecording) || isWordAssessing)}
          >
            <Text style={styles.recordBtnText}>
              {isAssessing ? "Analizando..." : recording ? "Detener y evaluar" : "Grabar mi voz"}
            </Text>
          </Pressable>

          <Text style={styles.speakAccentInfo}>Acento seleccionado: {ACCENT_META[customAccent].name}</Text>

          <Text style={styles.speakFootnote}>
            La evaluación usa transcripción y comparación con la frase objetivo. Sirve como guía práctica, no como diagnóstico fonético exacto.
          </Text>

          {assessmentError && <Text style={styles.assessmentError}>{assessmentError}</Text>}

          {assessment && (
            <View style={styles.assessmentCard}>
              <View style={styles.assessmentHeader}>
                <Text style={styles.assessmentTitle}>Resultado</Text>
                <Text style={[styles.assessmentScore, { color: pronunciationScoreColor }]}>{assessment.accuracyScore}%</Text>
              </View>
              <Text style={styles.assessmentSummary}>{assessment.summary}</Text>

              <View style={styles.assessmentSection}>
                <Text style={styles.assessmentLabel}>El sistema entendió</Text>
                <Text style={styles.assessmentTranscript}>{assessment.transcript || "No se detectó texto claro."}</Text>
              </View>

              <View style={styles.assessmentSection}>
                <Text style={styles.assessmentLabel}>Comparación palabra por palabra</Text>
                <View style={styles.wordGrid}>
                  {assessment.targetWords.map((word, index) => (
                    <View key={`word-${word}-${index}`} style={[styles.wordChip, wordMatches[index] ? styles.wordChipMatch : styles.wordChipMiss]}>
                      <Text style={[styles.wordChipText, wordMatches[index] ? styles.wordChipTextMatch : styles.wordChipTextMiss]}>{word}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.wordLegend}>Verde = coincidió | Rojo = practicar más</Text>
              </View>

              {assessment.missedWords.length > 0 && (
                <View style={styles.assessmentSection}>
                  <Text style={styles.assessmentLabel}>Reintento por palabra fallada</Text>
                  <View style={styles.wordGrid}>
                    {assessment.missedWords.map((word, index) => {
                      const isSelected = selectedWord === word;
                      return (
                        <Pressable
                          key={`retry-${word}-${index}`}
                          style={[styles.wordRetryChip, isSelected && styles.wordRetryChipActive]}
                          onPress={() => {
                            setSelectedWord(word);
                            setWordAssessment(null);
                            setWordAssessmentError(null);
                          }}
                        >
                          <Text style={[styles.wordRetryText, isSelected && styles.wordRetryTextActive]}>{word}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.shadowActions}>
                    <Pressable
                      style={[styles.shadowActionBtn, !selectedWord && styles.speakBtnDisabled]}
                      onPress={playSelectedWord}
                      disabled={!selectedWord}
                    >
                      <Text style={styles.shadowActionText}>Escuchar palabra</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.shadowActionBtn,
                        wordRecording && styles.recordBtnActive,
                        (!selectedWord || isWordAssessing || Boolean(recording) || isAssessing) && styles.speakBtnDisabled,
                      ]}
                      onPress={onWordPracticePress}
                      disabled={!selectedWord || isWordAssessing || Boolean(recording) || isAssessing}
                    >
                      <Text style={styles.shadowActionText}>
                        {isWordAssessing ? "Analizando..." : wordRecording ? "Detener y evaluar" : "Regrabar palabra"}
                      </Text>
                    </Pressable>
                  </View>

                  {wordAssessmentError && <Text style={styles.assessmentError}>{wordAssessmentError}</Text>}

                  {wordAssessment && (
                    <View style={styles.wordResultCard}>
                      <Text style={styles.wordResultTitle}>Resultado de palabra: {selectedWord}</Text>
                      <Text style={styles.wordResultText}>Puntaje: {wordAssessment.accuracyScore}%</Text>
                      <Text style={styles.wordResultText}>Detectado: {wordAssessment.transcript || "sin detección clara"}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.assessmentSection}>
                <Text style={styles.assessmentLabel}>Lo hiciste bien</Text>
                {assessment.strengths.map((item, index) => (
                  <Text key={`strength-${index}`} style={styles.assessmentBullet}>• {item}</Text>
                ))}
              </View>

              <View style={styles.assessmentSection}>
                <Text style={styles.assessmentLabel}>Para mejorar</Text>
                {assessment.improvements.map((item, index) => (
                  <Text key={`improvement-${index}`} style={styles.assessmentBullet}>• {item}</Text>
                ))}
              </View>

              <View style={styles.assessmentSection}>
                <Text style={styles.assessmentLabel}>Próximo intento</Text>
                <Text style={styles.assessmentTip}>{assessment.practiceTip}</Text>
              </View>
            </View>
          )}

          {dailyRoutineWords.length > 0 && (
            <View style={styles.routineCard}>
              <Text style={styles.routineTitle}>Rutina diaria sugerida (5 minutos)</Text>
              <Text style={styles.routineHelper}>Escuchá cada palabra 2 veces y luego grabá 1 intento por palabra.</Text>
              <Text style={styles.routineStepText}>Paso {routineStep} de 3</Text>

              {routineStep === 1 && currentRoutineWord && (
                <View style={styles.routineStepCard}>
                  <Text style={styles.routineStepLabel}>1) Escuchá cada palabra</Text>
                  <Text style={styles.routineCurrentWord}>{currentRoutineWord}</Text>
                  <View style={styles.shadowActions}>
                    <Pressable style={styles.shadowActionBtn} onPress={playCurrentRoutineWord}>
                      <Text style={styles.shadowActionText}>▶ Escuchar</Text>
                    </Pressable>
                    <Pressable style={styles.shadowActionBtn} onPress={onRoutineHeardWord}>
                      <Text style={styles.shadowActionText}>Ya la escuché</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.routineProgress}>Progreso: {routineListened.length}/{routineWords.length}</Text>
                </View>
              )}

              {routineStep === 2 && currentRoutineWord && (
                <View style={styles.routineStepCard}>
                  <Text style={styles.routineStepLabel}>2) Grabá una ronda rápida</Text>
                  <Text style={styles.routineCurrentWord}>{currentRoutineWord}</Text>
                  <Pressable
                    style={[styles.recordBtn, wordRecording && styles.recordBtnActive, isWordAssessing && styles.speakBtnDisabled]}
                    onPress={onRoutineRecordPress}
                    disabled={isWordAssessing}
                  >
                    <Text style={styles.recordBtnText}>
                      {isWordAssessing ? "Analizando..." : wordRecording ? "Detener y evaluar" : "Grabar palabra"}
                    </Text>
                  </Pressable>
                  <Text style={styles.routineProgress}>Progreso: {routineResults.length}/{routineWords.length}</Text>
                </View>
              )}

              {routineStep === 3 && (
                <View style={styles.routineStepCard}>
                  <Text style={styles.routineStepLabel}>3) ¡Rutina completada!</Text>
                  {routineResults.map((item) => {
                    const label =
                      item.score >= 85 ? "Excelente ✓" : item.score >= 65 ? "Bien" : "A seguir practicando";
                    const labelColor =
                      item.score >= 85 ? "#4caf50" : item.score >= 65 ? "#ffc107" : "#f44336";
                    return (
                      <View key={item.word} style={styles.routineResultRow}>
                        <Text style={styles.routineResultWord}>{item.word}</Text>
                        <Text style={[styles.routineResultLabel, { color: labelColor }]}>{label}</Text>
                      </View>
                    );
                  })}
                  <Text style={styles.routineMetric}>🔥 Racha diaria: {practiceStreak} día(s)</Text>
                  <Pressable style={styles.shadowActionBtn} onPress={startRoutine}>
                    <Text style={styles.shadowActionText}>Repetir rutina</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.wordGrid}>
                {dailyRoutineWords.map((item) => (
                  <Pressable
                    key={`routine-${item.word}`}
                    style={styles.routineWordChip}
                    onPress={() => {
                      setSelectedWord(item.word);
                      setWordAssessment(null);
                      setWordAssessmentError(null);
                      if (assessment?.missedWords?.length) {
                        return;
                      }
                      setAssessment((prev) => prev ? prev : {
                        transcript: "",
                        accuracyScore: item.lastScore,
                        targetWords: [item.word],
                        transcriptWords: [],
                        missedWords: [item.word],
                        extraWords: [],
                        summary: "Palabra seleccionada desde rutina diaria.",
                        strengths: [],
                        improvements: [],
                        practiceTip: "Escuchá y repetí la palabra varias veces.",
                        source: "fallback",
                      });
                    }}
                  >
                    <Text style={styles.routineWordText}>{item.word}</Text>
                    <Text style={styles.routineWordMeta}>avg {Math.round(item.avgScore)}%</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginTop: 12 },
  helper: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  voiceHint: { color: "#8a6d3b", fontSize: 12, lineHeight: 17 },
  tabRow: { flexDirection: "row", gap: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    backgroundColor: theme.colors.panel,
  },
  tabBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  tabBtnText: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
  tabBtnTextActive: { color: "#fff" },
  levelRow: { flexDirection: "row", gap: 8 },
  levelBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    backgroundColor: theme.colors.panel,
  },
  levelBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  levelBtnText: { color: theme.colors.muted, fontSize: 13, fontWeight: "600" },
  levelBtnTextActive: { color: "#fff" },
  phraseCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  phraseLabel: { color: theme.colors.muted, fontSize: 12 },
  phraseText: {
    color: theme.colors.text,
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 22,
  },
  nextPhrase: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  accentCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  accentHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  accentFlag: { fontSize: 32 },
  accentInfo: { flex: 1, gap: 2 },
  accentName: { color: theme.colors.text, fontWeight: "700", fontSize: 15 },
  accentDesc: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  accentScore: { fontSize: 18, fontWeight: "700", minWidth: 40, textAlign: "right" },
  progressTrack: { height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  accentActions: { flexDirection: "row", gap: 10 },
  listenBtn: {
    flex: 1,
    backgroundColor: theme.colors.accentAlt,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  listenBtnActive: { opacity: 0.7 },
  listenBtnDisabled: { opacity: 0.45 },
  listenBtnText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  autoStatusPill: {
    flex: 1,
    backgroundColor: "#eceff1",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  autoStatusPillPending: { backgroundColor: "#fff8e1" },
  autoStatusPillDone: { backgroundColor: "#e8f5e9" },
  autoStatusText: { color: theme.colors.text, fontWeight: "700", fontSize: 12 },
  speakCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  speakTitle: { color: theme.colors.text, fontWeight: "700", fontSize: 16 },
  speakHelper: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  shadowHint: { color: "#8a6d3b", fontSize: 12, lineHeight: 17 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    paddingVertical: 9,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  modeBtnText: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
  modeBtnTextActive: { color: "#fff" },
  textInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 15,
    lineHeight: 21,
  },
  customAccentRow: { flexDirection: "row", gap: 8 },
  customAccentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    gap: 2,
    backgroundColor: theme.colors.background,
  },
  customAccentBtnActive: { borderColor: theme.colors.accent, backgroundColor: "rgba(36, 99, 235, 0.12)" },
  customAccentFlag: { fontSize: 20 },
  customAccentText: { color: theme.colors.muted, fontWeight: "700", fontSize: 12 },
  customAccentTextActive: { color: theme.colors.text },
  speakBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  speakBtnDisabled: { opacity: 0.5 },
  speakBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  shadowCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 8,
  },
  shadowActions: { flexDirection: "row", gap: 8 },
  shadowActionBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 9,
    alignItems: "center",
  },
  shadowActionText: { color: theme.colors.text, fontWeight: "700", fontSize: 12 },
  recordBtn: {
    backgroundColor: theme.colors.accentAlt,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  recordBtnActive: { backgroundColor: "#b91c1c" },
  recordBtnText: { color: theme.colors.text, fontWeight: "700", fontSize: 14 },
  speakAccentInfo: { color: theme.colors.muted, fontSize: 12 },
  routineCard: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  routineTitle: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  routineHelper: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  routineStepText: { color: theme.colors.accent, fontSize: 12, fontWeight: "700" },
  routineStepCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.panel,
    padding: 10,
    gap: 8,
  },
  routineStepLabel: { color: theme.colors.text, fontWeight: "700", fontSize: 12 },
  routineCurrentWord: { color: theme.colors.text, fontSize: 18, fontWeight: "800", textTransform: "lowercase" },
  routineProgress: { color: theme.colors.muted, fontSize: 11 },
  routineMetric: { color: theme.colors.text, fontSize: 12, fontWeight: "600" },
  routineResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  routineResultWord: { color: theme.colors.text, fontSize: 13, fontWeight: "700", textTransform: "lowercase" },
  routineResultLabel: { fontSize: 12, fontWeight: "600" },
  routineWordChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 86,
  },
  routineWordText: { color: theme.colors.text, fontWeight: "700", fontSize: 12 },
  routineWordMeta: { color: theme.colors.muted, fontSize: 10 },
  speakFootnote: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  assessmentError: { color: "#b00020", fontSize: 13 },
  assessmentCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 10,
  },
  assessmentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  assessmentTitle: { color: theme.colors.text, fontWeight: "700", fontSize: 15 },
  assessmentScore: { fontWeight: "800", fontSize: 20 },
  assessmentSummary: { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  assessmentSection: { gap: 4 },
  assessmentLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },
  assessmentTranscript: { color: theme.colors.text, fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  wordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  wordChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  wordChipMatch: { backgroundColor: "#e8f5e9", borderColor: "#4caf50" },
  wordChipMiss: { backgroundColor: "#ffebee", borderColor: "#f44336" },
  wordChipText: { fontSize: 12, fontWeight: "700" },
  wordChipTextMatch: { color: "#1b5e20" },
  wordChipTextMiss: { color: "#b71c1c" },
  wordRetryChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
  },
  wordRetryChipActive: { borderColor: theme.colors.accent, backgroundColor: "rgba(36, 99, 235, 0.12)" },
  wordRetryText: { color: theme.colors.text, fontWeight: "700", fontSize: 12 },
  wordRetryTextActive: { color: theme.colors.accent },
  wordResultCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: theme.colors.panel,
    gap: 4,
  },
  wordResultTitle: { color: theme.colors.text, fontSize: 13, fontWeight: "700" },
  wordResultText: { color: theme.colors.muted, fontSize: 12 },
  wordLegend: { color: theme.colors.muted, fontSize: 11 },
  assessmentBullet: { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  assessmentTip: { color: theme.colors.text, fontSize: 13, lineHeight: 19 },
});
