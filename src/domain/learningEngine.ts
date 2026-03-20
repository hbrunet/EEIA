import {
  Accent,
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
  const listeningEntries = Object.entries(progress.metrics.listeningByAccent);
  const weakestAccent = listeningEntries.reduce((worst, current) =>
    current[1] < worst[1] ? current : worst,
  );

  const computed: Weakness[] = [
    weaknessFromMetric("grammar", "Sentence accuracy under pressure", progress.metrics.grammarAccuracy),
    weaknessFromMetric("fluency", "Long answers without pauses", progress.metrics.fluencyScore * 10),
    weaknessFromMetric("pronunciation", "Natural rhythm and stress", progress.metrics.pronunciationScore * 10),
    weaknessFromMetric(
      "listening",
      `Understanding ${weakestAccent[0]} accent in fast speech`,
      weakestAccent[1],
    ),
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

function chooseAccent(progress: AppProgress): Accent {
  const entries = Object.entries(progress.metrics.listeningByAccent) as Array<[Accent, number]>;
  return entries.reduce((worst, current) => (current[1] < worst[1] ? current : worst))[0];
}

function chooseFocusArea(weaknesses: Weakness[]): SkillArea {
  return weaknesses[0]?.area || "grammar";
}

export function buildDailyLesson(progress: AppProgress): LessonPlan {
  const weaknesses = inferWeaknesses(progress);
  const focusArea = chooseFocusArea(weaknesses);
  const accentFocus = chooseAccent(progress);
  const topWeakness = weaknesses[0]?.detail || progress.nextClassGoal;

  return {
    objective: progress.nextClassGoal || `Reinforce ${topWeakness}`,
    focusArea,
    accentFocus,
    warmupQuestions: [
      "What situation this week made English difficult for you?",
      "Can you describe yesterday using full sentences?",
      "What would you like to say more naturally at work?",
    ],
    activities: [
      `Guided dialogue focused on ${topWeakness}`,
      "Correction cycle: error, fix, rule, one new example",
      `${accentFocus} listening drill with comprehension check`,
      "Free speaking wrap-up with feedback",
    ],
  };
}

export function buildWeeklyPlan(progress: AppProgress): WeeklyPlanItem[] {
  const weaknesses = inferWeaknesses(progress);
  const main = weaknesses[0]?.detail || "core communication";
  const accent = chooseAccent(progress);

  return [
    { day: "Mon", objective: `Grammar repair: ${main}` },
    { day: "Tue", objective: "Guided conversation in real-life context" },
    { day: "Wed", objective: `${accent} accent listening and shadowing` },
    { day: "Thu", objective: "Pronunciation and fluency under time pressure" },
    { day: "Fri", objective: "Mixed simulation and weekly review" },
  ];
}

export function applySessionResult(progress: AppProgress, result: SessionResult): AppProgress {
  const nextGrammar = clamp(progress.metrics.grammarAccuracy + result.grammarDelta, 0, 100);
  const nextFluency = clamp(progress.metrics.fluencyScore + result.fluencyDelta, 1, 10);
  const nextPron = clamp(progress.metrics.pronunciationScore + result.pronunciationDelta, 1, 10);
  const nextListening = clamp(
    progress.metrics.listeningByAccent[result.accent] + result.listeningDelta,
    0,
    100,
  );

  const updated: AppProgress = {
    ...progress,
    metrics: {
      grammarAccuracy: nextGrammar,
      fluencyScore: nextFluency,
      pronunciationScore: nextPron,
      listeningByAccent: {
        ...progress.metrics.listeningByAccent,
        [result.accent]: nextListening,
      },
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
