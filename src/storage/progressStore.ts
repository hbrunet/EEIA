import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDailyLesson, buildWeeklyPlan, inferWeaknesses } from "../domain/learningEngine";
import { AppProgress } from "../types/progress";

const STORAGE_KEY = "eeia.progress.v1";

export const defaultProgress: AppProgress = {
  profile: {
    name: "Learner",
    level: "A2",
    goals: ["Improve speaking confidence", "Understand multiple accents"],
    weakAreas: ["Present perfect questions", "UK listening"],
  },
  metrics: {
    grammarAccuracy: 68,
    listeningByAccent: {
      US: 78,
      UK: 61,
      AU: 66,
      CA: 72,
    },
    fluencyScore: 5,
    pronunciationScore: 6,
  },
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

const seededProgress: AppProgress = {
  ...defaultProgress,
  weaknesses: inferWeaknesses(defaultProgress),
  currentLesson: buildDailyLesson(defaultProgress),
  weeklyPlan: buildWeeklyPlan(defaultProgress),
};

function normalizeProgress(data: Partial<AppProgress>): AppProgress {
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
  };

  return {
    ...merged,
    weaknesses: merged.weaknesses?.length ? merged.weaknesses : inferWeaknesses(merged),
    currentLesson: merged.currentLesson?.objective ? merged.currentLesson : buildDailyLesson(merged),
    weeklyPlan: merged.weeklyPlan?.length ? merged.weeklyPlan : buildWeeklyPlan(merged),
  };
}

export async function loadProgress(): Promise<AppProgress> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return seededProgress;

  try {
    const parsed = JSON.parse(raw) as Partial<AppProgress>;
    return normalizeProgress(parsed);
  } catch {
    return seededProgress;
  }
}

export async function saveProgress(progress: AppProgress): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
