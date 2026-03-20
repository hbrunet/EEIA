import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyGoalUpdate, applySessionResult, runDiagnostic } from "../domain/learningEngine";
import { loadProgress, saveProgress } from "../storage/progressStore";
import { AppProgress, SessionResult } from "../types/progress";

type AppContextValue = {
  progress: AppProgress | null;
  loading: boolean;
  updateGoal: (goal: string) => Promise<void>;
  completeSession: (result: SessionResult) => Promise<void>;
  runInitialDiagnostic: () => Promise<void>;
  boostListening: (accent: keyof AppProgress["metrics"]["listeningByAccent"]) => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<AppProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const initial = await loadProgress();
      setProgress(initial);
      setLoading(false);
    }

    bootstrap();
  }, []);

  async function persist(next: AppProgress) {
    setProgress(next);
    await saveProgress(next);
  }

  async function updateGoal(goal: string) {
    if (!progress) return;
    const next = applyGoalUpdate(progress, goal);
    await persist(next);
  }

  async function completeSession(result: SessionResult) {
    if (!progress) return;
    const next = applySessionResult(progress, result);
    await persist(next);
  }

  async function runInitialDiagnostic() {
    if (!progress || progress.diagnosticCompleted) return;
    const next = runDiagnostic(progress);
    await persist(next);
  }

  async function boostListening(accent: keyof AppProgress["metrics"]["listeningByAccent"]) {
    if (!progress) return;
    const current = progress.metrics.listeningByAccent[accent];
    const boosted = Math.min(100, current + 4);

    const next: AppProgress = {
      ...progress,
      metrics: {
        ...progress.metrics,
        listeningByAccent: {
          ...progress.metrics.listeningByAccent,
          [accent]: boosted,
        },
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    await persist(next);
  }

  const value = useMemo(
    () => ({ progress, loading, updateGoal, completeSession, runInitialDiagnostic, boostListening }),
    [progress, loading],
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
