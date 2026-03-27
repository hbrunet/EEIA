import * as Speech from "expo-speech";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { Accent } from "../types/progress";
import { theme } from "../ui/theme";

const ACCENT_META: Record<Accent, { flag: string; name: string; locale: string; description: string }> = {
  US: { flag: "🇺🇸", name: "Inglés americano", locale: "en-US", description: "El más común en cine, series y negocios globales." },
  UK: { flag: "🇬🇧", name: "Inglés británico", locale: "en-GB", description: "Estándar en educación formal y medios internacionales." },
  AU: { flag: "🇦🇺", name: "Inglés australiano", locale: "en-AU", description: "Vocales abiertas y entonación ascendente característica." },
  CA: { flag: "🇨🇦", name: "Inglés canadiense", locale: "en-CA", description: "Mezcla de rasgos americanos y británicos, muy claro." },
};

const PHRASES: Record<string, string[]> = {
  básico: [
    "Hello, my name is Alex. Nice to meet you.",
    "Can you say that again, please? I didn't understand.",
    "What time is it? I need to be somewhere soon.",
  ],
  intermedio: [
    "Could you tell me how to improve my speaking confidence in meetings?",
    "I've been working on this project for three weeks and I'm almost done.",
    "The weather here is quite different from what I'm used to back home.",
  ],
  avanzado: [
    "The implications of this policy shift are far more nuanced than they initially appear.",
    "She articulated her concerns with remarkable clarity despite the pressure she was under.",
    "We ought to reconsider our approach given the feedback we've received from stakeholders.",
  ],
};

const ACCENTS: Accent[] = ["US", "UK", "AU", "CA"];

export function AccentsScreen() {
  const { progress, boostListening } = useAppState();
  const [playing, setPlaying] = useState<Accent | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<"básico" | "intermedio" | "avanzado">("intermedio");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [boosted, setBoosted] = useState<Record<Accent, boolean>>({ US: false, UK: false, AU: false, CA: false });

  const phrases = PHRASES[selectedLevel];
  const currentPhrase = phrases[phraseIndex];

  function playAccent(accent: Accent) {
    Speech.stop();
    setPlaying(accent);
    Speech.speak(currentPhrase, {
      language: ACCENT_META[accent].locale,
      rate: 0.9,
      pitch: 1,
      onDone: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  }

  async function onPracticed(accent: Accent) {
    await boostListening(accent);
    setBoosted((prev) => ({ ...prev, [accent]: true }));
    setTimeout(() => setBoosted((prev) => ({ ...prev, [accent]: false })), 2000);
  }

  function nextPhrase() {
    Speech.stop();
    setPlaying(null);
    setPhraseIndex((i) => (i + 1) % phrases.length);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Laboratorio de acentos</Text>
      <Text style={styles.helper}>
        Escuchá la misma frase en distintos acentos y entrenás tu oído. Tocá "Practiqué" después de cada escucha para registrar tu progreso.
      </Text>

      {/* Selector de nivel */}
      <View style={styles.levelRow}>
        {(["básico", "intermedio", "avanzado"] as const).map((lvl) => (
          <Pressable
            key={lvl}
            style={[styles.levelBtn, selectedLevel === lvl && styles.levelBtnActive]}
            onPress={() => { setSelectedLevel(lvl); setPhraseIndex(0); Speech.stop(); setPlaying(null); }}
          >
            <Text style={[styles.levelBtnText, selectedLevel === lvl && styles.levelBtnTextActive]}>
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Frase actual */}
      <View style={styles.phraseCard}>
        <Text style={styles.phraseLabel}>Frase {phraseIndex + 1}/{phrases.length}</Text>
        <Text style={styles.phraseText}>"{currentPhrase}"</Text>
        <Pressable onPress={nextPhrase}>
          <Text style={styles.nextPhrase}>Siguiente frase →</Text>
        </Pressable>
      </View>

      {/* Cards de acentos */}
      {ACCENTS.map((accent) => {
        const meta = ACCENT_META[accent];
        const score = progress?.metrics.listeningByAccent[accent] ?? 0;
        const pct = score;
        const barColor = pct >= 70 ? "#4caf50" : pct >= 40 ? "#ffc107" : "#f44336";
        const isPlaying = playing === accent;
        const justBoosted = boosted[accent];

        return (
          <View key={accent} style={styles.accentCard}>
            <View style={styles.accentHeader}>
              <Text style={styles.accentFlag}>{meta.flag}</Text>
              <View style={styles.accentInfo}>
                <Text style={styles.accentName}>{meta.name}</Text>
                <Text style={styles.accentDesc}>{meta.description}</Text>
              </View>
              <Text style={[styles.accentScore, { color: barColor }]}>{score}%</Text>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
            </View>

            <View style={styles.accentActions}>
              <Pressable
                style={[styles.listenBtn, isPlaying && styles.listenBtnActive]}
                onPress={() => playAccent(accent)}
              >
                <Text style={styles.listenBtnText}>{isPlaying ? "⏸ Reproduciendo..." : "▶ Escuchar"}</Text>
              </Pressable>
              <Pressable
                style={[styles.practicedBtn, justBoosted && styles.practicedBtnDone]}
                onPress={() => onPracticed(accent)}
                disabled={justBoosted}
              >
                <Text style={styles.practicedBtnText}>{justBoosted ? "✓ Registrado" : "Practiqué"}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginTop: 12 },
  helper: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  levelRow: { flexDirection: "row", gap: 8 },
  levelBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    backgroundColor: theme.colors.panel,
  },
  levelBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  levelBtnText: { color: theme.colors.muted, fontSize: 13, fontWeight: "600" },
  levelBtnTextActive: { color: "#fff" },
  phraseCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  phraseLabel: { color: theme.colors.muted, fontSize: 12 },
  phraseText: {
    color: theme.colors.text,
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 22,
  },
  nextPhrase: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  accentCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  accentHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  accentFlag: { fontSize: 32 },
  accentInfo: { flex: 1, gap: 2 },
  accentName: { color: theme.colors.text, fontWeight: "700", fontSize: 15 },
  accentDesc: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  accentScore: { fontSize: 18, fontWeight: "700", minWidth: 40, textAlign: "right" },
  progressTrack: { height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  accentActions: { flexDirection: "row", gap: 10 },
  listenBtn: {
    flex: 1,
    backgroundColor: theme.colors.accentAlt,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  listenBtnActive: { opacity: 0.7 },
  listenBtnText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  practicedBtn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  practicedBtnDone: { backgroundColor: "#4caf50" },
  practicedBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
