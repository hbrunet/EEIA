import {
  AppProgress,
  LessonPlan,
  SessionResult,
  SkillArea,
  Weakness,
  WeeklyPlanItem,
} from "../types/progress";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function weaknessFromMetric(area: SkillArea, detail: string, score: number): Weakness {
  const severity = (5 - Math.floor(score / 20)) as Weakness["severity"];
  return {
    area,
    detail,
    severity: clamp(severity, 1, 5) as Weakness["severity"],
  };
}

export function inferWeaknesses(progress: AppProgress): Weakness[] {
  const computed: Weakness[] = [
    weaknessFromMetric("grammar", "Precisión gramatical bajo presión", progress.metrics.grammarAccuracy),
    weaknessFromMetric("fluency", "Respuestas largas sin pausas excesivas", progress.metrics.fluencyScore * 10),
    weaknessFromMetric("pronunciation", "Ritmo natural y énfasis correcto", progress.metrics.pronunciationScore * 10),
  ];

  const custom = progress.profile.weakAreas.map((item) => ({
    area: "vocabulary" as SkillArea,
    detail: item,
    severity: 3 as Weakness["severity"],
  }));

  return [...computed, ...custom]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 6);
}

function chooseFocusArea(weaknesses: Weakness[]): SkillArea {
  return weaknesses[0]?.area || "grammar";
}

export function buildDailyLesson(progress: AppProgress): LessonPlan {
  const weaknesses = inferWeaknesses(progress);
  const focusArea = chooseFocusArea(weaknesses);
  const topWeakness = weaknesses[0]?.detail || progress.nextClassGoal;

  return {
    objective: progress.nextClassGoal || `Reforzar: ${topWeakness}`,
    focusArea,
    warmupQuestions: [
      "¿Qué situación esta semana te resultó difícil en inglés?",
      "Describí lo que hiciste ayer usando oraciones completas en inglés.",
      "¿Qué frase o expresión te gustaría decir con más naturalidad?",
    ],
    activities: [
      `Diálogo guiado enfocado en: ${topWeakness}`,
      "Ciclo de corrección: error → forma correcta → regla → ejemplo nuevo",
      "Práctica de pronunciación y ritmo natural",
      "Conversación libre de cierre con devolución del tutor",
    ],
  };
}

export function buildWeeklyPlan(progress: AppProgress): WeeklyPlanItem[] {
  const weaknesses = inferWeaknesses(progress);
  const main = weaknesses[0]?.detail || "core communication";

  return [
    { day: "Mon", objective: `Corrección gramatical: ${main}` },
    { day: "Tue", objective: "Conversación guiada en contexto real" },
    { day: "Wed", objective: "Shadowing y práctica de pronunciación" },
    { day: "Thu", objective: "Pronunciación y fluidez bajo presión de tiempo" },
    { day: "Fri", objective: "Simulación mixta y repaso semanal" },
  ];
}

export function applySessionResult(progress: AppProgress, result: SessionResult): AppProgress {
  const nextGrammar = clamp(progress.metrics.grammarAccuracy + result.grammarDelta, 0, 100);
  const nextFluency = clamp(progress.metrics.fluencyScore + result.fluencyDelta, 1, 10);
  const nextPron = clamp(progress.metrics.pronunciationScore + result.pronunciationDelta, 1, 10);

  const updated: AppProgress = {
    ...progress,
    metrics: {
      grammarAccuracy: nextGrammar,
      fluencyScore: nextFluency,
      pronunciationScore: nextPron,
    },
    sessionHistory: [
      {
        completedAt: new Date().toISOString(),
        objective: progress.currentLesson.objective,
        result,
      },
      ...progress.sessionHistory,
    ].slice(0, 30),
    lastUpdatedAt: new Date().toISOString(),
  };

  const refreshed: AppProgress = {
    ...updated,
    weaknesses: inferWeaknesses(updated),
    currentLesson: buildDailyLesson(updated),
    weeklyPlan: buildWeeklyPlan(updated),
  };

  return {
    ...refreshed,
    nextClassGoal: refreshed.currentLesson.objective,
  };
}

export function applyGoalUpdate(progress: AppProgress, goal: string): AppProgress {
  const withGoal: AppProgress = {
    ...progress,
    nextClassGoal: goal,
    lastUpdatedAt: new Date().toISOString(),
  };

  const daily = buildDailyLesson(withGoal);

  return {
    ...withGoal,
    currentLesson: { ...daily, objective: goal },
    weeklyPlan: buildWeeklyPlan(withGoal),
  };
}

export function runDiagnostic(progress: AppProgress): AppProgress {
  const diagnosed: AppProgress = {
    ...progress,
    diagnosticCompleted: true,
    weaknesses: inferWeaknesses(progress),
    lastUpdatedAt: new Date().toISOString(),
  };

  return {
    ...diagnosed,
    currentLesson: buildDailyLesson(diagnosed),
    weeklyPlan: buildWeeklyPlan(diagnosed),
  };
}
