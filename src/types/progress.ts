export type SkillArea = "grammar" | "listening" | "fluency" | "pronunciation" | "vocabulary";
export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type MultipleChoiceExercise = {
  type: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic?: string;
};

export type FillBlankExercise = {
  type: "fill_blank";
  sentence: string;
  correctAnswer: string;
  hint?: string;
  explanation: string;
  topic?: string;
};

export type Exercise = MultipleChoiceExercise | FillBlankExercise;

export type ExerciseSessionEntry = {
  completedAt: string;
  level: string;
  focusArea: string;
  score: number;
  total: number;
  topics: string[];
  wrongTopics: string[];
};

/** A pedagogically-oriented topic suggestion with a concrete grammar/skill focus. */
export type TopicSuggestion = {
  text: string;
  skillFocus: string;
};

export type LessonMetric = {
  grammarAccuracy: number;
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
  accentFocus?: string;
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
  listeningDelta?: number;
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
};

export type ShadowingPractice = {
  dateKey: string;
  seenPhraseKeys: string[];
};

export type AppProgress = {
  profile: LearnerProfile;
  metrics: LessonMetric;
  pronunciationWordStats: PronunciationWordStat[];
  lookupHistory: string[];
  chatSessionHistory: ChatSessionEntry[];
  metricHistory: MetricSnapshot[];
  shadowingPractice: ShadowingPractice;
  dailyGoal: DailyGoal;
  dailyGoalHistory: string[];
  weaknesses: Weakness[];
  currentLesson: LessonPlan;
  weeklyPlan: WeeklyPlanItem[];
  sessionHistory: SessionEntry[];
  nextClassGoal: string;
  diagnosticCompleted: boolean;
  lastUpdatedAt: string;
  exerciseWeaknesses?: Weakness[];
  exerciseSessionHistory?: ExerciseSessionEntry[];
};
