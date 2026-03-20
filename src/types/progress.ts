export type Accent = "US" | "UK" | "AU" | "CA";
export type SkillArea = "grammar" | "listening" | "fluency" | "pronunciation" | "vocabulary";

export type LessonMetric = {
  grammarAccuracy: number;
  listeningByAccent: Record<Accent, number>;
  fluencyScore: number;
  pronunciationScore: number;
};

export type LearnerProfile = {
  name: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1";
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

export type AppProgress = {
  profile: LearnerProfile;
  metrics: LessonMetric;
  weaknesses: Weakness[];
  currentLesson: LessonPlan;
  weeklyPlan: WeeklyPlanItem[];
  sessionHistory: SessionEntry[];
  nextClassGoal: string;
  diagnosticCompleted: boolean;
  lastUpdatedAt: string;
};
