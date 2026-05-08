import { AppProgress, SkillArea, TopicSuggestion } from "../types/progress";

type TopicCandidate = {
  text: string;
  focus: SkillArea;
  skillFocus: string;
};

type LearnerStage = "beginner" | "basic" | "intermediate" | "advanced";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectStage(level?: string): LearnerStage {
  const normalized = String(level || "").trim().toUpperCase();
  if (normalized === "A1") return "beginner";
  if (normalized === "A2") return "basic";
  if (normalized === "B1") return "intermediate";
  return "advanced";
}

function getWeakestArea(progress: AppProgress): SkillArea {
  const grammar = progress.metrics.grammarAccuracy;
  const fluency = progress.metrics.fluencyScore * 10;
  const pronunciation = progress.metrics.pronunciationScore * 10;
  const listeningByAccent = (progress.metrics as any).listeningByAccent ?? {};
  const listeningValues = Object.values(listeningByAccent) as number[];
  const listening = listeningValues.length
    ? Math.round(listeningValues.reduce((sum, value) => sum + value, 0) / listeningValues.length)
    : 0;

  const areaScores: Array<{ area: SkillArea; score: number }> = [
    { area: "grammar", score: grammar },
    { area: "fluency", score: fluency },
    { area: "pronunciation", score: pronunciation },
    { area: "listening", score: listening },
  ];

  areaScores.sort((a, b) => a.score - b.score);
  return areaScores[0]?.area || "fluency";
}

function getStageTopics(stage: LearnerStage): TopicCandidate[] {
  if (stage === "beginner") {
    return [
      { text: "Saludos y presentarte con frases cortas", focus: "fluency",      skillFocus: "Verb to be / Greetings" },
      { text: "Colores, numeros y objetos del aula",      focus: "vocabulary",  skillFocus: "Basic vocabulary" },
      { text: "Hablar de tu familia con vocabulario simple", focus: "vocabulary", skillFocus: "Possessives / Family" },
      { text: "Rutina diaria en presente simple",          focus: "grammar",     skillFocus: "Present simple" },
      { text: "Comprender instrucciones basicas",          focus: "listening",   skillFocus: "Listening / Instructions" },
    ];
  }

  if (stage === "basic") {
    return [
      { text: "Pedir comida en un restaurante",      focus: "fluency",       skillFocus: "Can / Could" },
      { text: "Reservar hotel y hacer check-in",     focus: "listening",     skillFocus: "Will / Future" },
      { text: "Contar planes del fin de semana",     focus: "grammar",       skillFocus: "Going to" },
      { text: "Ir de compras y preguntar precios",   focus: "vocabulary",    skillFocus: "How much / Numbers" },
      { text: "Pronunciar frases utiles para viajar", focus: "pronunciation", skillFocus: "Pronunciation" },
    ];
  }

  if (stage === "intermediate") {
    return [
      { text: "Reunion de trabajo y seguimiento de tareas",      focus: "fluency",       skillFocus: "Present perfect" },
      { text: "Entrevista laboral con preguntas frecuentes",      focus: "grammar",       skillFocus: "Past simple / Experience" },
      { text: "Resolver un problema con soporte tecnico",         focus: "listening",     skillFocus: "1st Conditional" },
      { text: "Debatir ventajas y desventajas de una decision",   focus: "fluency",       skillFocus: "Expressing opinions" },
      { text: "Refinar pronunciacion en presentaciones cortas",   focus: "pronunciation", skillFocus: "Pronunciation" },
    ];
  }

  return [
    { text: "Negociacion profesional y manejo de objeciones",   focus: "fluency",       skillFocus: "2nd & 3rd Conditional" },
    { text: "Presentacion ejecutiva con lenguaje persuasivo",   focus: "pronunciation", skillFocus: "Advanced vocabulary" },
    { text: "Discusion sobre tendencias de industria",          focus: "vocabulary",    skillFocus: "Passive voice" },
    { text: "Feedback complejo en contexto laboral",            focus: "grammar",       skillFocus: "Reported speech" },
    { text: "Listening de acentos mixtos en reuniones remotas", focus: "listening",     skillFocus: "Listening / Accents" },
  ];
}

export function buildSmartTopicSuggestions(progress: AppProgress): TopicSuggestion[] {
  const stage = detectStage(progress.profile.level);
  const weakestArea = getWeakestArea(progress);
  const recentTopics = (progress.chatSessionHistory || [])
    .slice(0, 8)
    .map((item) => normalizeText(item.topic))
    .filter(Boolean);
  const nextGoal = String(progress.nextClassGoal || "").trim();

  const weakestAccent = Object.entries((progress.metrics as any).listeningByAccent ?? {})
    .sort((a: any, b: any) => a[1] - b[1])[0]?.[0] as string | undefined;

  const candidates: TopicCandidate[] = [
    ...getStageTopics(stage),
    ...(weakestAccent
      ? [{ text: `Comprension auditiva acento ${weakestAccent}`, focus: "listening" as SkillArea, skillFocus: "Listening / Accents" }]
      : []),
    ...(nextGoal
      ? [{ text: nextGoal, focus: weakestArea, skillFocus: "Class goal" }]
      : []),
  ];

  const scored = candidates.map((candidate) => {
    const normalized = normalizeText(candidate.text);
    const isExactRecent = recentTopics.includes(normalized);
    const hasRecentTokenOverlap = recentTopics.some((topic) => {
      const tokenSet = new Set(topic.split(" "));
      return normalized.split(" ").some((token) => token.length > 3 && tokenSet.has(token));
    });

    let score = 50;
    if (candidate.focus === weakestArea) score += 25;
    if (candidate.focus === "listening" && weakestAccent && normalized.includes(normalizeText(weakestAccent))) {
      score += 8;
    }
    if (nextGoal && normalizeText(nextGoal) === normalized) score += 12;
    if (isExactRecent) score -= 22;
    if (hasRecentTokenOverlap) score -= 10;

    return { text: candidate.text, skillFocus: candidate.skillFocus, score };
  });

  const uniqueByText = new Map<string, { skillFocus: string; score: number }>();
  for (const item of scored) {
    const key = item.text.trim();
    if (!key) continue;
    const existing = uniqueByText.get(key);
    if (!existing || existing.score < item.score) {
      uniqueByText.set(key, { skillFocus: item.skillFocus, score: item.score });
    }
  }

  return Array.from(uniqueByText.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3)
    .map(([text, { skillFocus }]) => ({ text, skillFocus }));
}
