import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDailyLesson, buildWeeklyPlan, inferWeaknesses } from "../domain/learningEngine";
import { AppProgress } from "../types/progress";

const STORAGE_KEY = "eeia.progress.v1";
const LEGACY_DEMO_METRICS = {
  grammarAccuracy: 68,
  listeningByAccent: {
    US: 78,
    UK: 61,
    AU: 66,
    CA: 72,
  },
  fluencyScore: 5,
  pronunciationScore: 6,
};
const LEGACY_PROFILE_DEFAULTS = {
  name: "learner",
  level: "A2",
};

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultDailyGoal() {
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

function buildDefaultShadowingPractice() {
  return {
    dateKey: getTodayKey(),
    seenPhraseKeys: [],
  };
}

function buildDefaultPracticeAccentPreference() {
  return {
    dateKey: getTodayKey(),
    userSelectedAccent: null,
  };
}

export const defaultProgress: AppProgress = {
  profile: {
    name: "",
    goals: ["Improve speaking confidence", "Understand multiple accents"],
    weakAreas: [],
  },
  metrics: {
    grammarAccuracy: 0,
    listeningByAccent: {
      US: 0,
      UK: 0,
      AU: 0,
      CA: 0,
    },
    fluencyScore: 0,
    pronunciationScore: 0,
  },
  pronunciationWordStats: [],
  lookupHistory: [],
  chatSessionHistory: [],
  metricHistory: [],
  shadowingPractice: buildDefaultShadowingPractice(),
  practiceAccentPreference: buildDefaultPracticeAccentPreference(),
  dailyGoal: buildDefaultDailyGoal(),
  dailyGoalHistory: [],
  weaknesses: [],
  currentLesson: {
    objective: "",
    focusArea: "grammar",
    accentFocus: "UK",
    warmupQuestions: [],
    activities: [],
  },
  weeklyPlan: [],
  sessionHistory: [],
  nextClassGoal: "Practice present perfect questions in work situations",
  diagnosticCompleted: false,
  lastUpdatedAt: new Date().toISOString(),
};

function buildBaseProgress(): AppProgress {
  return {
    ...defaultProgress,
    dailyGoal: buildDefaultDailyGoal(),
    shadowingPractice: buildDefaultShadowingPractice(),
    practiceAccentPreference: buildDefaultPracticeAccentPreference(),
    metricHistory: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function buildSeededProgress(): AppProgress {
  const base = buildBaseProgress();
  return {
    ...base,
    weaknesses: inferWeaknesses(base),
    currentLesson: buildDailyLesson(base),
    weeklyPlan: buildWeeklyPlan(base),
  };
}

function looksLikeLegacyDemoSeed(data: Partial<AppProgress>): boolean {
  const metrics = data.metrics;
  const hasNoActivity =
    (!Array.isArray(data.sessionHistory) || data.sessionHistory.length === 0) &&
    (!Array.isArray(data.chatSessionHistory) || data.chatSessionHistory.length === 0) &&
    (!Array.isArray(data.pronunciationWordStats) || data.pronunciationWordStats.length === 0) &&
    (!Array.isArray(data.lookupHistory) || data.lookupHistory.length === 0);

  const matchesLegacyMetrics =
    metrics?.grammarAccuracy === LEGACY_DEMO_METRICS.grammarAccuracy &&
    metrics?.fluencyScore === LEGACY_DEMO_METRICS.fluencyScore &&
    metrics?.pronunciationScore === LEGACY_DEMO_METRICS.pronunciationScore &&
    metrics?.listeningByAccent?.US === LEGACY_DEMO_METRICS.listeningByAccent.US &&
    metrics?.listeningByAccent?.UK === LEGACY_DEMO_METRICS.listeningByAccent.UK &&
    metrics?.listeningByAccent?.AU === LEGACY_DEMO_METRICS.listeningByAccent.AU &&
    metrics?.listeningByAccent?.CA === LEGACY_DEMO_METRICS.listeningByAccent.CA;

  const normalizedName = String(data.profile?.name || "").trim().toLowerCase();
  const normalizedLevel = String(data.profile?.level || "").trim().toUpperCase();
  const matchesLegacyProfileDefaults =
    normalizedName === LEGACY_PROFILE_DEFAULTS.name &&
    normalizedLevel === LEGACY_PROFILE_DEFAULTS.level;

  const hasLegacyWeakAreas = Array.isArray(data.profile?.weakAreas)
    ? data.profile.weakAreas.includes("Present perfect questions") && data.profile.weakAreas.includes("UK listening")
    : false;

  return hasNoActivity && (matchesLegacyMetrics || matchesLegacyProfileDefaults || hasLegacyWeakAreas);
}

function normalizeProgress(data: Partial<AppProgress>): AppProgress {
  const seededProgress = buildSeededProgress();
  const merged: AppProgress = {
    ...seededProgress,
    ...data,
    profile: {
      ...seededProgress.profile,
      ...(data.profile || {}),
    },
    metrics: {
      ...seededProgress.metrics,
      ...(data.metrics || {}),
      listeningByAccent: {
        ...seededProgress.metrics.listeningByAccent,
        ...(data.metrics?.listeningByAccent || {}),
      },
    },
    pronunciationWordStats: Array.isArray(data.pronunciationWordStats)
      ? data.pronunciationWordStats
      : seededProgress.pronunciationWordStats,
    lookupHistory: Array.isArray(data.lookupHistory)
      ? data.lookupHistory
      : seededProgress.lookupHistory,
    chatSessionHistory: Array.isArray(data.chatSessionHistory)
      ? data.chatSessionHistory
      : seededProgress.chatSessionHistory,
    metricHistory: Array.isArray(data.metricHistory)
      ? data.metricHistory.map((item) => ({
          ...item,
          listeningByAccent: {
            ...seededProgress.metrics.listeningByAccent,
            ...(item?.listeningByAccent || {}),
          },
        }))
      : seededProgress.metricHistory,
    shadowingPractice: data.shadowingPractice && typeof data.shadowingPractice === "object"
      ? {
          dateKey: typeof data.shadowingPractice.dateKey === "string" ? data.shadowingPractice.dateKey : getTodayKey(),
          seenPhraseKeys: Array.isArray(data.shadowingPractice.seenPhraseKeys)
            ? data.shadowingPractice.seenPhraseKeys.filter((item) => typeof item === "string").slice(0, 300)
            : [],
        }
      : seededProgress.shadowingPractice,
    practiceAccentPreference: data.practiceAccentPreference && typeof data.practiceAccentPreference === "object"
      ? {
          dateKey: typeof data.practiceAccentPreference.dateKey === "string" ? data.practiceAccentPreference.dateKey : getTodayKey(),
          userSelectedAccent: typeof data.practiceAccentPreference.userSelectedAccent === "string" && ["US", "UK", "AU", "CA"].includes(data.practiceAccentPreference.userSelectedAccent) ? data.practiceAccentPreference.userSelectedAccent : null,
        }
      : seededProgress.practiceAccentPreference,
    dailyGoalHistory: Array.isArray(data.dailyGoalHistory)
      ? data.dailyGoalHistory
      : seededProgress.dailyGoalHistory,
  };

  return {
    ...merged,
    shadowingPractice: merged.shadowingPractice?.dateKey === getTodayKey()
      ? merged.shadowingPractice
      : buildDefaultShadowingPractice(),
    practiceAccentPreference: merged.practiceAccentPreference?.dateKey === getTodayKey()
      ? merged.practiceAccentPreference
      : buildDefaultPracticeAccentPreference(),
    dailyGoal: merged.dailyGoal?.dateKey === getTodayKey() ? merged.dailyGoal : buildDefaultDailyGoal(),
    weaknesses: merged.weaknesses?.length ? merged.weaknesses : inferWeaknesses(merged),
    currentLesson: merged.currentLesson?.objective ? merged.currentLesson : buildDailyLesson(merged),
    weeklyPlan: merged.weeklyPlan?.length ? merged.weeklyPlan : buildWeeklyPlan(merged),
  };
}

export async function loadProgress(): Promise<AppProgress> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return buildSeededProgress();

  try {
    const parsed = JSON.parse(raw) as Partial<AppProgress>;
    if (looksLikeLegacyDemoSeed(parsed)) {
      return buildSeededProgress();
    }
    return normalizeProgress(parsed);
  } catch {
    return buildSeededProgress();
  }
}

export async function saveProgress(progress: AppProgress): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export async function resetProgressStorage(): Promise<AppProgress> {
  const seeded = buildSeededProgress();
  await saveProgress(seeded);
  return seeded;
}
