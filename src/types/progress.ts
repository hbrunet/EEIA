export type Accent = "US" | "UK" | "AU" | "CA";
export type SkillArea = "grammar" | "listening" | "fluency" | "pronunciation" | "vocabulary";
export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type LessonMetric = {
  grammarAccuracy: number;
  listeningByAccent: Record<Accent, number>;
  fluencyScore: number;
  pronunciationScore: number;
};

export type LearnerProfile = {
  name: string;
  level?: EnglishLevel;
  goals: string[];
  weakAreas: string[];
};

export type Weakness = {
  area: SkillArea;
  detail: string;
  severity: 1 | 2 | 3 | 4 | 5;
};

export type LessonPlan = {
  objective: string;
  focusArea: SkillArea;
  accentFocus: Accent;
  warmupQuestions: string[];
  activities: string[];
};

export type WeeklyPlanItem = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  objective: string;
};

export type SessionResult = {
  grammarDelta: number;
  fluencyDelta: number;
  pronunciationDelta: number;
  listeningDelta: number;
  accent: Accent;
  notes: string;
};

export type SessionEntry = {
  completedAt: string;
  objective: string;
  result: SessionResult;
};

export type PronunciationWordStat = {
  word: string;
  attempts: number;
  lowScoreCount: number;
  avgScore: number;
  lastScore: number;
  lastPracticedAt: string;
  accent: Accent;
};

export type DailyGoal = {
  dateKey: string;
  title: string;
  checklist: string[];
  targetRoutines: number;
  completedRoutines: number;
  completed: boolean;
};

export type ChatSessionEntry = {
  startedAt: string;
  endedAt: string;
  topic: string;
  turns: number;
  correctionCount: number;
  pronunciationHintCount: number;
  source: "openai" | "gemini" | "groq" | "fallback";
};

export type MetricSnapshot = {
  dateKey: string;
  grammarAccuracy: number;
  fluencyScore: number;
  pronunciationScore: number;
  listeningByAccent: Record<Accent, number>;
};

export type AppProgress = {
  profile: LearnerProfile;
  metrics: LessonMetric;
  pronunciationWordStats: PronunciationWordStat[];
  lookupHistory: string[];
  chatSessionHistory: ChatSessionEntry[];
  metricHistory: MetricSnapshot[];
  dailyGoal: DailyGoal;
  dailyGoalHistory: string[];
  weaknesses: Weakness[];
  currentLesson: LessonPlan;
  weeklyPlan: WeeklyPlanItem[];
  sessionHistory: SessionEntry[];
  nextClassGoal: string;
  diagnosticCompleted: boolean;
  lastUpdatedAt: string;
};
