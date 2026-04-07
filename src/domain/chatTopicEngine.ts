import { AppProgress, SkillArea } from "../types/progress";

type TopicCandidate = {
  text: string;
  focus: SkillArea;
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
  const listeningValues = Object.values(progress.metrics.listeningByAccent);
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
      { text: "Saludos y presentarte con frases cortas", focus: "fluency" },
      { text: "Colores, numeros y objetos del aula", focus: "vocabulary" },
      { text: "Hablar de tu familia con vocabulario simple", focus: "vocabulary" },
      { text: "Rutina diaria en presente simple", focus: "grammar" },
      { text: "Comprender instrucciones basicas del profesor", focus: "listening" },
    ];
  }

  if (stage === "basic") {
    return [
      { text: "Pedir comida en un restaurante", focus: "fluency" },
      { text: "Reservar hotel y hacer check-in", focus: "listening" },
      { text: "Contar planes del fin de semana", focus: "grammar" },
      { text: "Ir de compras y preguntar precios", focus: "vocabulary" },
      { text: "Pronunciar frases utiles para viajar", focus: "pronunciation" },
    ];
  }

  if (stage === "intermediate") {
    return [
      { text: "Reunion de trabajo y seguimiento de tareas", focus: "fluency" },
      { text: "Entrevista laboral con preguntas frecuentes", focus: "grammar" },
      { text: "Resolver un problema con soporte tecnico", focus: "listening" },
      { text: "Debatir ventajas y desventajas de una decision", focus: "fluency" },
      { text: "Refinar pronunciacion en presentaciones cortas", focus: "pronunciation" },
    ];
  }

  return [
    { text: "Negociacion profesional y manejo de objeciones", focus: "fluency" },
    { text: "Presentacion ejecutiva con lenguaje persuasivo", focus: "pronunciation" },
    { text: "Discusion sobre tendencias de industria", focus: "vocabulary" },
    { text: "Feedback complejo en contexto laboral", focus: "grammar" },
    { text: "Listening de acentos mixtos en reuniones remotas", focus: "listening" },
  ];
}

export function buildSmartTopicSuggestions(progress: AppProgress): string[] {
  const stage = detectStage(progress.profile.level);
  const weakestArea = getWeakestArea(progress);
  const recentTopics = (progress.chatSessionHistory || [])
    .slice(0, 8)
    .map((item) => normalizeText(item.topic))
    .filter(Boolean);
  const nextGoal = String(progress.nextClassGoal || "").trim();

  const weakestAccent = Object.entries(progress.metrics.listeningByAccent)
    .sort((a, b) => a[1] - b[1])[0]?.[0];

  const candidates: TopicCandidate[] = [
    ...getStageTopics(stage),
    ...(weakestAccent
      ? [{ text: `Comprension auditiva enfocada en acento ${weakestAccent}`, focus: "listening" as SkillArea }]
      : []),
    ...(nextGoal
      ? [{ text: nextGoal, focus: weakestArea }]
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

    return {
      text: candidate.text,
      score,
    };
  });

  const uniqueByText = new Map<string, number>();
  for (const item of scored) {
    const key = item.text.trim();
    if (!key) continue;
    if (!uniqueByText.has(key) || (uniqueByText.get(key) || 0) < item.score) {
      uniqueByText.set(key, item.score);
    }
  }

  return Array.from(uniqueByText.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([text]) => text);
}
