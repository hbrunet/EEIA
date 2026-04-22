import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyGoalUpdate, applySessionResult, runDiagnostic } from "../domain/learningEngine";
import { loadProgress, resetProgressStorage, saveProgress } from "../storage/progressStore";
import { Accent, AppProgress, EnglishLevel, SessionResult } from "../types/progress";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDailyGoal() {
  return {
    dateKey: getTodayKey(),
    title: "Completar rutina de pronunciación",
    checklist: [
      "Escuchar el circuito diario",
      "Grabar una ronda rápida",
      "Revisar resultado final",
    ],
    targetRoutines: 1,
    completedRoutines: 0,
    completed: false,
  };
}

function buildShadowingPractice() {
  return {
    dateKey: getTodayKey(),
    seenPhraseKeys: [] as string[],
  };
}

function appendGoalHistory(history: string[], dateKey: string): string[] {
  if (!dateKey) return history;
  if (history.includes(dateKey)) return history;
  return [...history, dateKey].slice(-60);
}

function ensureTodayGoal(progress: AppProgress): AppProgress {
  const withShadowing = progress.shadowingPractice?.dateKey === getTodayKey()
    ? progress
    : {
        ...progress,
        shadowingPractice: buildShadowingPractice(),
        lastUpdatedAt: new Date().toISOString(),
      };

  if (withShadowing.dailyGoal?.dateKey === getTodayKey()) return withShadowing;

  const history = withShadowing.dailyGoal?.completed
    ? appendGoalHistory(withShadowing.dailyGoalHistory || [], withShadowing.dailyGoal.dateKey)
    : (withShadowing.dailyGoalHistory || []);

  return {
    ...withShadowing,
    dailyGoal: buildDailyGoal(),
    dailyGoalHistory: history,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function upsertTodayMetricSnapshot(progress: AppProgress): AppProgress {
  const dateKey = getTodayKey();
  const snapshot = {
    dateKey,
    grammarAccuracy: progress.metrics.grammarAccuracy,
    fluencyScore: progress.metrics.fluencyScore,
    pronunciationScore: progress.metrics.pronunciationScore,
    listeningByAccent: { ...progress.metrics.listeningByAccent },
  };

  const metricHistory = Array.isArray(progress.metricHistory) ? [...progress.metricHistory] : [];
  const existingIndex = metricHistory.findIndex((item) => item.dateKey === dateKey);

  if (existingIndex >= 0) {
    metricHistory[existingIndex] = snapshot;
  } else {
    metricHistory.push(snapshot);
  }

  const trimmedHistory = metricHistory
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-60);

  return {
    ...progress,
    metricHistory: trimmedHistory,
  };
}

type AppContextValue = {
  progress: AppProgress | null;
  progressRef: React.MutableRefObject<AppProgress | null>;
  loading: boolean;
  updateProfile: (profile: { name: string; level: EnglishLevel }) => Promise<void>;
  setProfileLevelFromChat: (level: EnglishLevel) => Promise<void>;
  setProfileNameFromChat: (name: string) => Promise<void>;
  updateGoal: (goal: string) => Promise<void>;
  completeSession: (result: SessionResult) => Promise<void>;
  runInitialDiagnostic: () => Promise<void>;
  boostListening: (accent: keyof AppProgress["metrics"]["listeningByAccent"]) => Promise<void>;
  recordPronunciationPractice: (score: number, accent: Accent) => Promise<void>;
  recordPronunciationWordAttempt: (word: string, score: number, accent: Accent) => Promise<void>;
  recordPronunciationWordAttempts: (attempts: Array<{ word: string; score: number; accent: Accent }>) => Promise<void>;
  recordLookupTerm: (term: string) => Promise<void>;
  clearLookupHistory: () => Promise<void>;
  recordChatSessionSummary: (entry: {
    startedAt: string;
    endedAt: string;
    topic: string;
    turns: number;
    correctionCount: number;
    pronunciationHintCount: number;
    source: "openai" | "gemini" | "groq" | "fallback";
  }) => Promise<void>;
  recordShadowingPhraseSeen: (level: "básico" | "intermedio" | "avanzado", phrase: string) => Promise<void>;
  setPracticeAccentPreference: (accent: Accent | null) => Promise<void>;
  recordDailyRoutineCompleted: () => Promise<void>;
  markDailyGoalCompleted: () => Promise<void>;
  resetProgress: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<AppProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const progressRef = useRef<AppProgress | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const initial = upsertTodayMetricSnapshot(ensureTodayGoal(await loadProgress()));
      progressRef.current = initial;
      setProgress(initial);
      await saveProgress(initial);
      setLoading(false);
    }

    bootstrap();
  }, []);

  async function persist(next: AppProgress) {
    const normalized = upsertTodayMetricSnapshot(ensureTodayGoal(next));
    progressRef.current = normalized;
    setProgress(normalized);
    await saveProgress(normalized);
  }

  async function updateGoal(goal: string) {
    const latest = progressRef.current;
    if (!latest) return;
    const next = applyGoalUpdate(ensureTodayGoal(latest), goal);
    await persist(next);
  }

  async function updateProfile(profileInput: { name: string; level: EnglishLevel }) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);
    const cleanName = profileInput.name.trim() || "Estudiante";

    const next: AppProgress = {
      ...safeProgress,
      profile: {
        ...safeProgress.profile,
        name: cleanName,
        level: profileInput.level,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function setProfileLevelFromChat(level: EnglishLevel) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);

    const next: AppProgress = {
      ...safeProgress,
      profile: {
        ...safeProgress.profile,
        level,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function setProfileNameFromChat(name: string) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);
    const cleanName = name.trim();
    if (!cleanName) return;

    const next: AppProgress = {
      ...safeProgress,
      profile: {
        ...safeProgress.profile,
        name: cleanName,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function completeSession(result: SessionResult) {
    const latest = progressRef.current;
    if (!latest) return;
    const next = applySessionResult(ensureTodayGoal(latest), result);
    await persist(next);
  }

  async function runInitialDiagnostic() {
    const latest = progressRef.current;
    if (!latest || latest.diagnosticCompleted) return;
    const next = runDiagnostic(ensureTodayGoal(latest));
    await persist(next);
  }

  async function boostListening(accent: keyof AppProgress["metrics"]["listeningByAccent"]) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);
    const current = safeProgress.metrics.listeningByAccent[accent];
    const boosted = Math.min(100, current + 4);

    const next: AppProgress = {
      ...safeProgress,
      metrics: {
        ...safeProgress.metrics,
        listeningByAccent: {
          ...safeProgress.metrics.listeningByAccent,
          [accent]: boosted,
        },
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function recordPronunciationPractice(score: number, accent: Accent) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);

    const pronunciationDelta = score >= 90 ? 0.6 : score >= 75 ? 0.4 : score >= 60 ? 0.2 : 0.1;
    const listeningDelta = score >= 75 ? 2 : 1;

    const next: AppProgress = {
      ...safeProgress,
      metrics: {
        ...safeProgress.metrics,
        pronunciationScore: clamp(safeProgress.metrics.pronunciationScore + pronunciationDelta, 1, 10),
        listeningByAccent: {
          ...safeProgress.metrics.listeningByAccent,
          [accent]: clamp(safeProgress.metrics.listeningByAccent[accent] + listeningDelta, 0, 100),
        },
      },
      dailyGoalHistory: appendGoalHistory(safeProgress.dailyGoalHistory || [], getTodayKey()),
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function recordPronunciationWordAttempt(word: string, score: number, accent: Accent) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);

    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) return;

    const now = new Date().toISOString();
    const existing = safeProgress.pronunciationWordStats.find((item) => item.word === normalizedWord);

    const updatedEntry = existing
      ? {
          ...existing,
          attempts: existing.attempts + 1,
          lowScoreCount: existing.lowScoreCount + (score < 70 ? 1 : 0),
          avgScore: Math.round(((existing.avgScore * existing.attempts + score) / (existing.attempts + 1)) * 10) / 10,
          lastScore: score,
          lastPracticedAt: now,
          accent,
        }
      : {
          word: normalizedWord,
          attempts: 1,
          lowScoreCount: score < 70 ? 1 : 0,
          avgScore: score,
          lastScore: score,
          lastPracticedAt: now,
          accent,
        };

    const withoutCurrent = safeProgress.pronunciationWordStats.filter((item) => item.word !== normalizedWord);
    const nextStats = [updatedEntry, ...withoutCurrent].slice(0, 80);

    const next: AppProgress = {
      ...safeProgress,
      pronunciationWordStats: nextStats,
      lastUpdatedAt: now,
    };

    await persist(next);
  }

  async function recordPronunciationWordAttempts(attempts: Array<{ word: string; score: number; accent: Accent }>) {
    const latest = progressRef.current;
    if (!latest || attempts.length === 0) return;
    const safeProgress = ensureTodayGoal(latest);

    const now = new Date().toISOString();
    const map = new Map(safeProgress.pronunciationWordStats.map((item) => [item.word, item]));

    for (const attempt of attempts) {
      const normalizedWord = attempt.word.trim().toLowerCase();
      if (!normalizedWord) continue;

      const existing = map.get(normalizedWord);
      if (existing) {
        map.set(normalizedWord, {
          ...existing,
          attempts: existing.attempts + 1,
          lowScoreCount: existing.lowScoreCount + (attempt.score < 70 ? 1 : 0),
          avgScore: Math.round(((existing.avgScore * existing.attempts + attempt.score) / (existing.attempts + 1)) * 10) / 10,
          lastScore: attempt.score,
          lastPracticedAt: now,
          accent: attempt.accent,
        });
      } else {
        map.set(normalizedWord, {
          word: normalizedWord,
          attempts: 1,
          lowScoreCount: attempt.score < 70 ? 1 : 0,
          avgScore: attempt.score,
          lastScore: attempt.score,
          lastPracticedAt: now,
          accent: attempt.accent,
        });
      }
    }

    const nextStats = Array.from(map.values())
      .sort((a, b) => new Date(b.lastPracticedAt).getTime() - new Date(a.lastPracticedAt).getTime())
      .slice(0, 80);

    const next: AppProgress = {
      ...safeProgress,
      pronunciationWordStats: nextStats,
      lastUpdatedAt: now,
    };

    await persist(next);
  }

  async function recordLookupTerm(term: string) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);
    const normalizedTerm = term.trim();
    if (!normalizedTerm) return;

    const next: AppProgress = {
      ...safeProgress,
      lookupHistory: [
        normalizedTerm,
        ...(safeProgress.lookupHistory || []).filter((item) => item.toLowerCase() !== normalizedTerm.toLowerCase()),
      ].slice(0, 10),
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function clearLookupHistory() {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);

    const next: AppProgress = {
      ...safeProgress,
      lookupHistory: [],
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function recordChatSessionSummary(entry: {
    startedAt: string;
    endedAt: string;
    topic: string;
    turns: number;
    correctionCount: number;
    pronunciationHintCount: number;
    source: "openai" | "gemini" | "groq" | "fallback";
  }) {
    const latest = progressRef.current;
    if (!latest || entry.turns <= 0) return;
    const safeProgress = ensureTodayGoal(latest);

    const nextEntry = {
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      topic: entry.topic.trim() || "Práctica libre",
      turns: entry.turns,
      correctionCount: entry.correctionCount,
      pronunciationHintCount: entry.pronunciationHintCount,
      source: entry.source,
    };

    // Chat is the core activity — update metrics based on session quality.
    // Each turn contributes a small fluency gain. Grammar improves when
    // corrections are low relative to turns (student made few errors).
    // Pronunciation score gets a small boost for each hint received
    // (the tutor only hints when it detects something worth improving).
    const turns = Math.min(entry.turns, 20);
    const fluencyDelta = clamp(turns * 0.05, 0, 0.5);

    const correctionRatio = entry.turns > 0 ? entry.correctionCount / entry.turns : 0;
    const grammarDelta = correctionRatio < 0.2 ? 0.6 : correctionRatio < 0.4 ? 0.3 : 0.1;

    const pronunciationDelta = entry.pronunciationHintCount > 0 ? 0.15 : 0;

    const next: AppProgress = {
      ...safeProgress,
      chatSessionHistory: [nextEntry, ...(safeProgress.chatSessionHistory || [])].slice(0, 60),
      dailyGoalHistory: appendGoalHistory(safeProgress.dailyGoalHistory || [], getTodayKey()),
      metrics: {
        ...safeProgress.metrics,
        fluencyScore: clamp(safeProgress.metrics.fluencyScore + fluencyDelta, 0, 10),
        grammarAccuracy: clamp(safeProgress.metrics.grammarAccuracy + grammarDelta, 0, 100),
        pronunciationScore: clamp(safeProgress.metrics.pronunciationScore + pronunciationDelta, 0, 10),
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function recordShadowingPhraseSeen(level: "básico" | "intermedio" | "avanzado", phrase: string) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);

    const normalizedPhrase = phrase.trim().toLowerCase();
    if (!normalizedPhrase) return;

    const phraseKey = `${level}::${normalizedPhrase}`;
    const seenPhraseKeys = safeProgress.shadowingPractice?.seenPhraseKeys || [];
    if (seenPhraseKeys.includes(phraseKey)) return;

    const next: AppProgress = {
      ...safeProgress,
      shadowingPractice: {
        dateKey: getTodayKey(),
        seenPhraseKeys: [...seenPhraseKeys, phraseKey].slice(-300),
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function setPracticeAccentPreference(accent: Accent | null) {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);

    const next: AppProgress = {
      ...safeProgress,
      practiceAccentPreference: {
        dateKey: getTodayKey(),
        userSelectedAccent: accent,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function recordDailyRoutineCompleted() {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);
    const current = safeProgress.dailyGoal;
    const nextCompletedRoutines = Math.min(current.targetRoutines, current.completedRoutines + 1);

    const next: AppProgress = {
      ...safeProgress,
      dailyGoal: {
        ...current,
        completedRoutines: nextCompletedRoutines,
        completed: nextCompletedRoutines >= current.targetRoutines,
      },
      dailyGoalHistory:
        nextCompletedRoutines >= current.targetRoutines
          ? appendGoalHistory(safeProgress.dailyGoalHistory || [], current.dateKey)
          : (safeProgress.dailyGoalHistory || []),
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function markDailyGoalCompleted() {
    const latest = progressRef.current;
    if (!latest) return;
    const safeProgress = ensureTodayGoal(latest);
    const current = safeProgress.dailyGoal;

    const next: AppProgress = {
      ...safeProgress,
      dailyGoal: {
        ...current,
        completedRoutines: current.targetRoutines,
        completed: true,
      },
      dailyGoalHistory: appendGoalHistory(safeProgress.dailyGoalHistory || [], current.dateKey),
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  async function resetProgress() {
    const cleared = await resetProgressStorage();
    await persist(cleared);
  }

  const value = useMemo(
    () => ({
      progress,
      progressRef,
      loading,
      updateProfile,
      setProfileLevelFromChat,
      setProfileNameFromChat,
      updateGoal,
      completeSession,
      runInitialDiagnostic,
      boostListening,
      recordPronunciationPractice,
      recordPronunciationWordAttempt,
      recordPronunciationWordAttempts,
      recordLookupTerm,
      clearLookupHistory,
      recordChatSessionSummary,
      recordShadowingPhraseSeen,
      setPracticeAccentPreference,
      recordDailyRoutineCompleted,
      markDailyGoalCompleted,
      resetProgress,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, loading, progressRef],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }

  return context;
}
