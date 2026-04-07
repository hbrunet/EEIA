import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import { buildSmartTopicSuggestions } from "../domain/chatTopicEngine";
import { lookupTutorTerm, postTutorMessage, transcribeAudio, TutorLookupResponse } from "../services/api/client";
import { env } from "../config/env";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const CONTEXT_WINDOW = 8;
const SESSION_CHECKPOINT_TURNS = 3;

function isBeginnerLevel(level?: string): boolean {
  const normalized = String(level || "").trim().toUpperCase();
  return normalized === "A1" || normalized === "A2";
}

function cleanLookupToken(token: string): string {
  return token
    .replace(/^[^a-zA-Z0-9']+/, "")
    .replace(/[^a-zA-Z0-9']+$/, "")
    .trim();
}

export function ChatScreen() {
  const { updateGoal, progress, recordChatSessionSummary, recordLookupTerm, clearLookupHistory, setProfileLevelFromChat, setProfileNameFromChat } = useAppState();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSource, setLastSource] = useState<"openai" | "gemini" | "groq" | "fallback" | null>(null);
  const [lastCorrection, setLastCorrection] = useState<string | null>(null);
  const [lastPronunciationHint, setLastPronunciationHint] = useState<string | null>(null);
  const [phase, setPhase] = useState<"setup" | "practice">("setup");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedSuggestedTopic, setSelectedSuggestedTopic] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<TutorLookupResponse | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isCheckpointSavingRef = useRef(false);
  const sessionRef = useRef<{
    startedAt: string;
    topic: string;
    turns: number;
    correctionCount: number;
    pronunciationHintCount: number;
    source: "openai" | "gemini" | "groq" | "fallback";
  }>({
    startedAt: new Date().toISOString(),
    topic: "",
    turns: 0,
    correctionCount: 0,
    pronunciationHintCount: 0,
    source: "fallback",
  });
  const profileLevelConfigured = Boolean(progress?.profile.level);
  const beginnerMode = isBeginnerLevel(progress?.profile.level);
  const suggestedTopics = useMemo(
    () => (progress ? buildSmartTopicSuggestions(progress) : []),
    [progress],
  );
  const recentLookups = progress?.lookupHistory || [];
  const recentLookupWords = useMemo(
    () => recentLookups.filter((item) => !item.trim().includes(" ")),
    [recentLookups],
  );
  const recentLookupPhrases = useMemo(
    () => recentLookups.filter((item) => item.trim().includes(" ")),
    [recentLookups],
  );

  useEffect(() => {
    return () => {
      void finalizeChatSession();
    };
  }, []);

  async function saveChatSessionCheckpoint(force = false) {
    const current = sessionRef.current;
    if (isCheckpointSavingRef.current) return;
    if (current.turns <= 0) return;
    if (!force && current.turns < SESSION_CHECKPOINT_TURNS) return;

    isCheckpointSavingRef.current = true;

    try {
      await recordChatSessionSummary({
        startedAt: current.startedAt,
        endedAt: new Date().toISOString(),
        topic: current.topic,
        turns: current.turns,
        correctionCount: current.correctionCount,
        pronunciationHintCount: current.pronunciationHintCount,
        source: current.source,
      });
    } finally {
      sessionRef.current = {
        startedAt: new Date().toISOString(),
        topic: current.topic,
        turns: 0,
        correctionCount: 0,
        pronunciationHintCount: 0,
        source: current.source,
      };
      isCheckpointSavingRef.current = false;
    }
  }

  async function finalizeChatSession() {
    await saveChatSessionCheckpoint(true);

    sessionRef.current = {
      startedAt: new Date().toISOString(),
      topic: "",
      turns: 0,
      correctionCount: 0,
      pronunciationHintCount: 0,
      source: "fallback",
    };
  }

  function onClearChat() {
    Alert.alert(
      "Nueva sesión",
      "¿Querés empezar una conversación nueva? El historial actual se borrará.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Nueva sesión",
          style: "destructive",
          onPress: async () => {
            await finalizeChatSession();
            setMessages([]);
            setSelectedSuggestedTopic(null);
            setPhase("setup");
            setLastCorrection(null);
            setLastPronunciationHint(null);
            setLastSource(null);
            setError(null);
          },
        },
      ]
    );
  }

  async function onSend(forcedMessage?: string) {
    const sourceText = typeof forcedMessage === "string" ? forcedMessage : message;
    if (!sourceText.trim()) return;
    const trimmed = sourceText.trim();
    setError(null);
    setLoading(true);

    const historyWindow = messages.slice(-CONTEXT_WINDOW).map((item) => ({
      role: item.role,
      text: item.text,
    }));

    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-u`, role: "user", text: trimmed },
    ]);

    try {
      const response = await postTutorMessage(trimmed, historyWindow, progress ? {
        level: progress.profile.level,
        grammarAccuracy: progress.metrics.grammarAccuracy,
        fluencyScore: progress.metrics.fluencyScore,
        pronunciationScore: progress.metrics.pronunciationScore,
        weaknesses: progress.weaknesses.slice(0, 3).map((w) => ({ area: w.area, detail: w.detail, severity: w.severity })),
        goals: progress.profile.goals,
      } : undefined);
      setLastSource(response.source || null);
      setLastCorrection(response.correction && response.correction.toLowerCase() !== "null" ? response.correction : null);
      setLastPronunciationHint(response.pronunciationHint && response.pronunciationHint.toLowerCase() !== "null" ? response.pronunciationHint : null);
      const hasCorrection = Boolean(response.correction && response.correction.toLowerCase() !== "null");
      const hasPronunciationHint = Boolean(response.pronunciationHint && response.pronunciationHint.toLowerCase() !== "null");
      if (!progress?.profile.level && response.capturedLevel) {
        await setProfileLevelFromChat(response.capturedLevel);
      }
      if (!progress?.profile.name?.trim() && response.capturedName) {
        await setProfileNameFromChat(response.capturedName);
      }
      const suggestedTopic = (response.suggestedGoal || "").trim();
      if (suggestedTopic) {
        sessionRef.current.topic = suggestedTopic.slice(0, 100);
      } else if (!sessionRef.current.topic) {
        sessionRef.current.topic = trimmed.slice(0, 80);
      }
      sessionRef.current.turns += 1;
      sessionRef.current.correctionCount += hasCorrection ? 1 : 0;
      sessionRef.current.pronunciationHintCount += hasPronunciationHint ? 1 : 0;
      sessionRef.current.source = response.source || "fallback";

      if (sessionRef.current.turns >= SESSION_CHECKPOINT_TURNS) {
        await saveChatSessionCheckpoint();
      }

      // Phase can advance but never revert to setup
      if (response.phase === "practice") setPhase("practice");

      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-a`, role: "assistant", text: response.reply },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      await updateGoal(response.suggestedGoal);
    } catch {
      setError("No se pudo conectar con el tutor. Verificá que el backend esté activo e intentá de nuevo.");
    } finally {
      setLoading(false);
    }

    if (!forcedMessage) {
      setMessage("");
    } else {
      setMessage("");
      setSelectedSuggestedTopic(null);
    }
  }

  async function onMicPress() {
    if (recording) {
      // Stop recording and transcribe
      setIsTranscribing(true);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
          const text = await transcribeAudio(uri);
          setMessage(text);
        }
      } catch (e) {
        console.error("[Mic] transcription error:", e);
        setError(`No se pudo transcribir el audio. Backend esperado en ${env.apiBaseUrl}. ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert("Permiso requerido", "Necesitamos acceso al micrófono para grabar tu voz.");
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(newRecording);
      } catch (e) {
        setError("No se pudo iniciar la grabación.");
      }
    }
  }

  async function onLookupPress() {
    const term = lookupQuery.trim();
    if (!term) return;

    setLookupLoading(true);
    setLookupError(null);

    try {
      const result = await lookupTutorTerm(term, progress?.profile.level);
      setLookupResult(result);
      await recordLookupTerm(term);
    } catch (lookupIssue) {
      setLookupError(lookupIssue instanceof Error ? lookupIssue.message : "No se pudo consultar el significado.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function onAssistantWordPress(token: string) {
    const cleaned = cleanLookupToken(token);
    if (!cleaned) return;

    setLookupOpen(true);
    setLookupQuery(cleaned);
    setLookupResult(null);
    setLookupError(null);

    setLookupLoading(true);
    try {
      const result = await lookupTutorTerm(cleaned, progress?.profile.level);
      setLookupResult(result);
    } catch (lookupIssue) {
      setLookupError(lookupIssue instanceof Error ? lookupIssue.message : "No se pudo consultar el significado.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Tutor Chat</Text>
          {messages.length > 0 && (
            <Pressable style={styles.newSessionBtn} onPress={onClearChat}>
              <Text style={styles.newSessionText}>Nueva sesión</Text>
            </Pressable>
          )}
        </View>
        {phase === "setup" ? (
          <Text style={styles.helper}>
            {profileLevelConfigured
              ? "Tu nivel ya está configurado en Perfil. Empezá diciendo qué tema querés practicar hoy."
              : "El tutor te va a preguntar tu nivel y la temática que querés practicar antes de empezar."}
          </Text>
        ) : (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceBadgeText}>Modo práctica activo</Text>
          </View>
        )}
      </View>

      {/* Scrollable area: chat + corrección + ejercicio */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <>
            {phase === "setup" && profileLevelConfigured && suggestedTopics.length > 0 && (
              <View style={styles.suggestCard}>
                <Text style={styles.suggestTitle}>Temas sugeridos para hoy</Text>
                <Text style={styles.suggestHelper}>Elegí uno para arrancar más rápido según tu nivel y progreso.</Text>
                <View style={styles.suggestGrid}>
                  {suggestedTopics.map((topic) => {
                    const selected = selectedSuggestedTopic === topic;
                    return (
                      <Pressable
                        key={topic}
                        style={[styles.suggestChip, selected && styles.suggestChipActive]}
                        onPress={() => {
                          setSelectedSuggestedTopic(topic);
                          setMessage(`Quiero practicar: ${topic}`);
                        }}
                      >
                        <Text style={[styles.suggestChipText, selected && styles.suggestChipTextActive]}>{topic}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  style={[styles.suggestStartBtn, !selectedSuggestedTopic && styles.suggestStartBtnDisabled]}
                  disabled={!selectedSuggestedTopic || loading || isTranscribing}
                  onPress={() => {
                    const topic = selectedSuggestedTopic || suggestedTopics[0];
                    if (!topic) return;
                    void onSend(`Quiero practicar: ${topic}`);
                  }}
                >
                  <Text style={styles.suggestStartBtnText}>Usar tema y enviar</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.empty}>Empezá saludando al tutor para configurar tu sesión.</Text>
          </>
        )}
        {messages.map((item) => (
          <View
            key={item.id}
            style={[styles.bubble, item.role === "assistant" ? styles.assistantBubble : styles.userBubble]}
          >
            {item.role === "assistant" ? (
              <Text style={styles.bubbleText}>
                {item.text.split(/(\s+)/).map((part, index) => {
                  const cleaned = cleanLookupToken(part);
                  if (!cleaned) {
                    return <Text key={`${item.id}-${index}`}>{part}</Text>;
                  }

                  return (
                    <Text
                      key={`${item.id}-${index}`}
                      style={styles.lookupInlineWord}
                      onPress={() => {
                        void onAssistantWordPress(part);
                      }}
                    >
                      {part}
                    </Text>
                  );
                })}
              </Text>
            ) : (
              <Text style={styles.bubbleText}>{item.text}</Text>
            )}
          </View>
        ))}

        {lastCorrection && (
          <View style={styles.correctionBox}>
            <Text style={styles.correctionLabel}>Corrección</Text>
            <Text style={styles.correctionText}>{lastCorrection}</Text>
          </View>
        )}
        {lastPronunciationHint && (
          <View style={styles.pronunciationBox}>
            <Text style={styles.pronunciationLabel}>🗣 Pronunciación</Text>
            <Text style={styles.pronunciationText}>{lastPronunciationHint}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        {lastSource && (
          <Text style={styles.sourceTag}>
            {lastSource === "groq" ? "Groq (Llama)" : lastSource === "gemini" ? "Gemini" : lastSource === "openai" ? "OpenAI" : "Demo"}
          </Text>
        )}
        <Pressable
          style={[styles.lookupToggle, lookupOpen && styles.lookupToggleActive]}
          onPress={() => {
            setLookupOpen((current) => !current);
            setLookupError(null);
          }}
        >
          <Text style={[styles.lookupToggleText, lookupOpen && styles.lookupToggleTextActive]}>Diccionario rápido</Text>
        </Pressable>
        {lookupOpen && (
          <View style={styles.lookupCard}>
            <Text style={styles.lookupTitle}>Buscar palabra o frase</Text>
            {recentLookups.length > 0 && (
              <View style={styles.lookupHistoryBlock}>
                <View style={styles.lookupHistoryHeader}>
                  <Text style={styles.lookupHint}>Recientes</Text>
                  <Pressable
                    onPress={() => {
                      void clearLookupHistory();
                      setLookupResult(null);
                      setLookupError(null);
                    }}
                  >
                    <Text style={styles.lookupClearText}>Limpiar</Text>
                  </Pressable>
                </View>

                {recentLookupWords.length > 0 && (
                  <View style={styles.lookupHistoryGroup}>
                    <Text style={styles.lookupGroupTitle}>Palabras</Text>
                    <View style={styles.lookupHistoryRow}>
                      {recentLookupWords.map((term) => (
                        <Pressable
                          key={`recent-word-${term}`}
                          style={styles.lookupHistoryChip}
                          onPress={() => {
                            setLookupQuery(term);
                            setLookupResult(null);
                            setLookupError(null);
                            void (async () => {
                              setLookupLoading(true);
                              try {
                                const result = await lookupTutorTerm(term, progress?.profile.level);
                                setLookupResult(result);
                                await recordLookupTerm(term);
                              } catch (lookupIssue) {
                                setLookupError(lookupIssue instanceof Error ? lookupIssue.message : "No se pudo consultar el significado.");
                              } finally {
                                setLookupLoading(false);
                              }
                            })();
                          }}
                        >
                          <Text style={styles.lookupHistoryChipText}>{term}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {recentLookupPhrases.length > 0 && (
                  <View style={styles.lookupHistoryGroup}>
                    <Text style={styles.lookupGroupTitle}>Frases</Text>
                    <View style={styles.lookupHistoryRow}>
                      {recentLookupPhrases.map((term) => (
                        <Pressable
                          key={`recent-phrase-${term}`}
                          style={styles.lookupHistoryChip}
                          onPress={() => {
                            setLookupQuery(term);
                            setLookupResult(null);
                            setLookupError(null);
                            void (async () => {
                              setLookupLoading(true);
                              try {
                                const result = await lookupTutorTerm(term, progress?.profile.level);
                                setLookupResult(result);
                                await recordLookupTerm(term);
                              } catch (lookupIssue) {
                                setLookupError(lookupIssue instanceof Error ? lookupIssue.message : "No se pudo consultar el significado.");
                              } finally {
                                setLookupLoading(false);
                              }
                            })();
                          }}
                        >
                          <Text style={styles.lookupHistoryChipText}>{term}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
            <TextInput
              value={lookupQuery}
              onChangeText={setLookupQuery}
              placeholder="Ej: though, take off, meeting"
              placeholderTextColor={theme.colors.muted}
              style={styles.lookupInput}
            />
            <Pressable
              style={[styles.lookupButton, (!lookupQuery.trim() || lookupLoading) && styles.buttonDisabled]}
              disabled={!lookupQuery.trim() || lookupLoading}
              onPress={() => {
                void onLookupPress();
              }}
            >
              <Text style={styles.lookupButtonText}>{lookupLoading ? "Buscando..." : "Consultar"}</Text>
            </Pressable>
            {lookupError && <Text style={styles.error}>{lookupError}</Text>}
            {lookupResult && (
              <View style={styles.lookupResult}>
                <Text style={styles.lookupWord}>{lookupResult.term}</Text>
                <Text style={styles.lookupTranslation}>{lookupResult.translation}</Text>
                <Text style={styles.lookupExplanation}>{lookupResult.explanation}</Text>
                {lookupResult.pronunciation ? (
                  <Text style={styles.lookupPronunciation}>Pronunciación: {lookupResult.pronunciation}</Text>
                ) : null}
                <Text style={styles.lookupExample}>Ejemplo: {lookupResult.example}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={phase === "setup"
              ? "Respondé en español..."
              : beginnerMode
                ? "Podés responder en español o con frases cortas en inglés..."
                : "Write in English..."}
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            style={[styles.micBtn, recording && styles.micBtnActive]}
            onPress={onMicPress}
            disabled={loading || isTranscribing}
          >
            <Text style={styles.micBtnText}>
              {isTranscribing ? "⏳" : recording ? "⏹" : "🎤"}
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.button, (loading || isTranscribing) && styles.buttonDisabled]}
          onPress={() => {
            void onSend();
          }}
          disabled={loading || isTranscribing}
        >
          <Text style={styles.buttonText}>{loading ? "Enviando..." : "Enviar"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
  },
  newSessionBtn: {
    backgroundColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  newSessionText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  helper: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  suggestCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  suggestTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  suggestHelper: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  suggestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: "100%",
  },
  suggestChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  suggestChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  suggestChipTextActive: {
    color: theme.colors.accent,
  },
  suggestStartBtn: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    paddingVertical: 9,
  },
  suggestStartBtnDisabled: {
    opacity: 0.5,
  },
  suggestStartBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 10,
    gap: 10,
    flexGrow: 1,
  },
  empty: {
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 40,
  },
  bubble: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "82%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#d6ecf2",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fbe8c7",
  },
  bubbleText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  lookupInlineWord: {
    textDecorationLine: "underline",
    textDecorationColor: theme.colors.accent,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  error: {
    color: "#b00020",
    fontSize: 13,
  },
  sourceTag: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  lookupToggle: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.panel,
  },
  lookupToggleActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  lookupToggleText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  lookupToggleTextActive: {
    color: theme.colors.accent,
  },
  lookupCard: {
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  lookupTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  lookupHint: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  lookupHistoryBlock: {
    gap: 6,
  },
  lookupHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lookupClearText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  lookupHistoryGroup: {
    gap: 6,
  },
  lookupGroupTitle: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  lookupHistoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lookupHistoryChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lookupHistoryChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  lookupInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
  lookupButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  lookupButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  lookupResult: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lookupWord: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  lookupTranslation: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  lookupExplanation: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  lookupPronunciation: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  lookupExample: {
    color: theme.colors.text,
    fontSize: 12,
    fontStyle: "italic",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 72,
    maxHeight: 120,
    padding: 12,
    color: theme.colors.text,
    textAlignVertical: "top",
    fontSize: 14,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "#e53935",
  },
  micBtnText: {
    fontSize: 20,
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  practiceBadge: {
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start" as const,
    borderLeftWidth: 3,
    borderLeftColor: "#1976d2",
  },
  practiceBadgeText: {
    color: "#1565c0",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  correctionBox: {
    backgroundColor: "#fff3cd",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#f0a500",
  },
  correctionLabel: {
    fontWeight: "700" as const,
    fontSize: 12,
    color: "#7d5200",
    marginBottom: 2,
  },
  correctionText: {
    color: "#5c3d00",
    fontSize: 13,
  },
  pronunciationBox: {
    backgroundColor: "#ede7f6",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#7c4dff",
  },
  pronunciationLabel: {
    fontWeight: "700" as const,
    fontSize: 12,
    color: "#4a148c",
    marginBottom: 2,
  },
  pronunciationText: {
    color: "#311b92",
    fontSize: 13,
  },
});
