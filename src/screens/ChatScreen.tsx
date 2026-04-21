import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { buildSmartTopicSuggestions } from "../domain/chatTopicEngine";
import { lookupTutorTerm, postTutorMessage, transcribeAudio, TranscriptionLanguage, TranscriptionResult, TutorLookupResponse } from "../services/api/client";
import { env } from "../config/env";
import { useAppState } from "../state/AppContext";
import { Accent } from "../types/progress";
import { theme } from "../ui/theme";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  correctionHint?: string;
  correctionExpanded?: boolean;
};

const CONTEXT_WINDOW = 8;
const SESSION_CHECKPOINT_TURNS = 3;
const ACCENT_SPEECH_META: Record<Accent, { locale: string; label: string }> = {
  US: { locale: "en-US", label: "Inglés americano" },
  UK: { locale: "en-GB", label: "Inglés británico" },
  AU: { locale: "en-AU", label: "Inglés australiano" },
  CA: { locale: "en-CA", label: "Inglés canadiense" },
};
const TRANSCRIPTION_LANGUAGE_META: Record<TranscriptionLanguage, string> = {
  auto: "Auto",
  en: "Inglés",
  es: "Español",
};

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

const SPANISH_STOPWORDS = new Set([
  "a","al","algo","alguien","algún","alguno","algunos","alguna","algunas",
  "ante","antes","aunque","bien","bueno","cada","como","con","cual",
  "cuando","de","del","donde","durante","él","ella","ellos","ellas",
  "en","entre","eres","es","eso","esos","esta","está","estás","están",
  "este","estos","fue","hay","hacia","hasta","le","les","lo","los",
  "la","las","me","mi","muy","más","ni","no","nos","nosotros",
  "nuestro","nuestra","o","os","para","pero","por","porque","que",
  "quién","se","ser","si","sin","sobre","son","su","sus","también",
  "te","tengo","tiene","tienen","todo","todos","tu","tú","un","una",
  "unas","unos","vos","y","ya","yo",
]);

function isLikelySpanish(token: string): boolean {
  if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(token)) return true;
  return SPANISH_STOPWORDS.has(token.toLowerCase());
}

function getFriendlyTranscriptionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("empty") ||
    normalized.includes("no speech") ||
    normalized.includes("silence") ||
    normalized.includes("failed: 400")
  ) {
    return "No detectamos voz en la grabación. Probá de nuevo hablando unos segundos cerca del micrófono.";
  }

  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("timeout")) {
    return "No pudimos transcribir por un problema de conexión. Revisá internet e intentá nuevamente.";
  }

  return "No pudimos transcribir tu audio. Intentá nuevamente con una frase corta y clara.";
}

export function ChatScreen() {
  const { updateGoal, progress, progressRef, recordChatSessionSummary, recordLookupTerm, clearLookupHistory, setProfileLevelFromChat, setProfileNameFromChat, setPracticeAccentPreference } = useAppState();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSource, setLastSource] = useState<"openai" | "gemini" | "groq" | "fallback" | null>(null);
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
  const [lookupSheetExpanded, setLookupSheetExpanded] = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<TranscriptionLanguage>("auto");
  const [voiceClarity, setVoiceClarity] = useState<number | null>(null);
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [accentSelectorOpen, setAccentSelectorOpen] = useState(false);
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
  const hasTypedMessage = message.trim().length > 0;
  const actionDisabled = loading || isTranscribing;
  const userSelectedAccent = progress?.practiceAccentPreference?.userSelectedAccent;
  const practiceAccent: Accent = userSelectedAccent || progress?.currentLesson?.accentFocus || "US";
  const practiceAccentMeta = ACCENT_SPEECH_META[practiceAccent];

  function getSpeechOptions(accent: Accent, rate = 0.95): Speech.SpeechOptions {
    const locale = ACCENT_SPEECH_META[accent].locale;
    const normalizedLocale = locale.toLowerCase();
    const voice = availableVoices.find((item) => item.language?.toLowerCase() === normalizedLocale)
      || availableVoices.find((item) => item.language?.toLowerCase().startsWith(normalizedLocale));

    return {
      language: locale,
      ...(voice ? { voice: voice.identifier } : {}),
      rate,
      pitch: 1,
    };
  }

  function onSpeakAssistantMessage(messageId: string, text: string) {
    const content = text.trim();
    if (!content) return;

    if (speakingMessageId === messageId) {
      Speech.stop();
      setSpeakingMessageId(null);
      return;
    }

    Speech.stop();
    setSpeakingMessageId(messageId);

    Speech.speak(content, {
      ...getSpeechOptions(practiceAccent, 0.95),
      onDone: () => setSpeakingMessageId(null),
      onStopped: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    });
  }

  function scrollToLatest(animated = true) {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }

  useEffect(() => {
    return () => {
      Speech.stop();
      void finalizeChatSession();
    };
  }, []);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => setAvailableVoices(Array.isArray(voices) ? voices : []))
      .catch(() => setAvailableVoices([]));
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      scrollToLatest(false);
      setTimeout(() => scrollToLatest(true), 80);
    });

    return () => {
      showSub.remove();
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
    setVoiceClarity(null);
    setLoading(true);

    const historyWindow = messages.slice(-CONTEXT_WINDOW).map((item) => ({
      role: item.role,
      text: item.text,
    }));

    const userMessageId = `${Date.now()}-u`;

    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", text: trimmed, correctionExpanded: false },
    ]);

    try {
      const latestProgress = progressRef.current;
      const response = await postTutorMessage(trimmed, historyWindow, latestProgress ? {
          name: latestProgress.profile.name,
          level: latestProgress.profile.level,
          grammarAccuracy: latestProgress.metrics.grammarAccuracy,
          fluencyScore: latestProgress.metrics.fluencyScore,
          pronunciationScore: latestProgress.metrics.pronunciationScore,
          weaknesses: latestProgress.weaknesses.slice(0, 3).map((w) => ({ area: w.area, detail: w.detail, severity: w.severity })),
          goals: latestProgress.profile.goals,
      } : undefined);
      setLastSource(response.source || null);
          const correctionText = response.correction && response.correction.toLowerCase() !== "null" ? response.correction : null;
      setLastPronunciationHint(response.pronunciationHint && response.pronunciationHint.toLowerCase() !== "null" ? response.pronunciationHint : null);
          const hasCorrection = Boolean(correctionText);
      const hasPronunciationHint = Boolean(response.pronunciationHint && response.pronunciationHint.toLowerCase() !== "null");
      if (!latestProgress?.profile.level && response.capturedLevel) {
        await setProfileLevelFromChat(response.capturedLevel);
      }
        if (!latestProgress?.profile.name?.trim() && response.capturedName) {
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

      setMessages((current) => {
        const withCorrection = correctionText
          ? current.map((item) => item.id === userMessageId ? { ...item, correctionHint: correctionText } : item)
          : current;

        return [
          ...withCorrection,
          { id: `${Date.now()}-a`, role: "assistant", text: response.reply },
        ];
      });
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
          const result: TranscriptionResult = await transcribeAudio(uri, transcriptionLanguage);
          setMessage(result.text);
          if (transcriptionLanguage !== "es") {
            setVoiceClarity(result.avgLogprob);
          }
        }
      } catch (e) {
        console.error("[Mic] transcription error:", e);
        setError(getFriendlyTranscriptionError(e));
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
    setLookupSheetExpanded(true);
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

  function onToggleCorrection(messageId: string) {
    setMessages((current) => current.map((item) => {
      if (item.id !== messageId || !item.correctionHint) return item;
      return { ...item, correctionExpanded: !item.correctionExpanded };
    }));
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
        <Pressable
          style={[styles.accentHelperBtn, userSelectedAccent && styles.accentHelperBtnActive]}
          onPress={() => setAccentSelectorOpen(true)}
        >
          <Text style={styles.accentHelper}>
            Acento: {practiceAccentMeta.label} {userSelectedAccent ? "(manual)" : "(automático)"}
          </Text>
        </Pressable>
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
              <>
                <Text style={styles.bubbleText}>
                  {item.text.split(/(\s+)/).map((part, index) => {
                    const cleaned = cleanLookupToken(part);
                    if (!cleaned || isLikelySpanish(cleaned)) {
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
                <Pressable
                  style={[styles.listenMessageBtn, speakingMessageId === item.id && styles.listenMessageBtnActive]}
                  onPress={() => onSpeakAssistantMessage(item.id, item.text)}
                >
                  <Text style={styles.listenMessageBtnText}>
                    {speakingMessageId === item.id ? "Detener audio" : "Escuchar mensaje"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.bubbleText}>{item.text}</Text>
                {item.correctionHint && (
                  <View style={styles.correctionHintWrap}>
                    <Pressable
                      style={[styles.correctionHintChip, item.correctionExpanded && styles.correctionHintChipActive]}
                      onPress={() => onToggleCorrection(item.id)}
                    >
                      <Text style={styles.correctionHintChipText}>
                        {item.correctionExpanded ? "Ocultar corrección" : "Ver corrección"}
                      </Text>
                    </Pressable>
                    {item.correctionExpanded && (
                      <View style={styles.correctionHintPanel}>
                        <Text style={styles.correctionHintTitle}>Sugerencia del tutor</Text>
                        <Text style={styles.correctionHintText}>{item.correctionHint}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        ))}
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
        {voiceClarity !== null && (() => {
          const lp = voiceClarity;
          const level = lp > -0.3 ? "alta" : lp > -0.55 ? "media" : "baja";
          const color = lp > -0.3 ? "#2e7d32" : lp > -0.55 ? "#e65100" : "#b00020";
          const bg = lp > -0.3 ? "#e8f5e9" : lp > -0.55 ? "#fff3e0" : "#fce4ec";
          const hint = lp > -0.3 ? "excelente claridad" : lp > -0.55 ? "intentá hablar más despacio" : "difícil de entender, grabá de nuevo";
          return (
            <View style={[styles.clarityChip, { backgroundColor: bg, borderColor: color }]}>
              <Text style={[styles.clarityChipText, { color }]}>
                🗣 Claridad: {level} — {hint}
              </Text>
            </View>
          );
        })()}
        <View style={styles.transcriptionLangRow}>
          <Text style={styles.transcriptionLangLabel}>Idioma de voz:</Text>
          <View style={styles.transcriptionLangOptions}>
            {(["auto", "en", "es"] as const).map((language) => {
              const selected = transcriptionLanguage === language;
              return (
                <Pressable
                  key={`transcript-lang-${language}`}
                  style={[styles.transcriptionLangChip, selected && styles.transcriptionLangChipActive]}
                  onPress={() => setTranscriptionLanguage(language)}
                  disabled={isTranscribing || Boolean(recording)}
                >
                  <Text style={[styles.transcriptionLangChipText, selected && styles.transcriptionLangChipTextActive]}>
                    {TRANSCRIPTION_LANGUAGE_META[language]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={message}
            onChangeText={(v) => { setMessage(v); setVoiceClarity(null); }}
            onFocus={() => {
              scrollToLatest(false);
              setTimeout(() => scrollToLatest(true), 80);
            }}
            placeholder=""
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            style={[
              styles.actionBtn,
              hasTypedMessage && styles.actionBtnSend,
              recording && styles.actionBtnRecording,
              actionDisabled && styles.buttonDisabled,
            ]}
            onPress={() => {
              if (hasTypedMessage) {
                void onSend();
                return;
              }
              void onMicPress();
            }}
            disabled={actionDisabled}
          >
            <Text style={styles.actionBtnText}>
              {isTranscribing ? "⏳" : hasTypedMessage ? "➤" : recording ? "⏹" : "🎤"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Dictionary FAB */}
      <Pressable
        style={[styles.lookupFab, lookupOpen && styles.lookupFabActive]}
        onPress={() => {
          setLookupOpen((v) => !v);
          setLookupSheetExpanded(false);
          setLookupError(null);
        }}
      >
        <Text style={styles.lookupFabText}>📖</Text>
      </Pressable>

      {/* Dictionary floating panel */}
      <Modal
        visible={lookupOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setLookupOpen(false);
          setLookupSheetExpanded(false);
        }}
      >
        <Pressable
          style={styles.lookupBackdrop}
          onPress={() => {
            setLookupOpen(false);
            setLookupSheetExpanded(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.lookupSheetWrap}
          >
            <View
              style={[
                styles.lookupFloatingCard,
                lookupSheetExpanded ? styles.lookupFloatingCardExpanded : styles.lookupFloatingCardCompact,
              ]}
              onStartShouldSetResponder={() => true}
            >
              <Pressable
                style={styles.lookupSheetToggle}
                onPress={() => setLookupSheetExpanded((value) => !value)}
              >
                <View style={styles.lookupDragHandle} />
                <Text style={styles.lookupSheetToggleText}>
                  {lookupSheetExpanded ? "Modo compacto" : "Expandir"}
                </Text>
              </Pressable>
              <Text style={styles.lookupTitle}>Diccionario rápido</Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.lookupScrollContent}
              >
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
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Accent selector modal */}
      <Modal
        visible={accentSelectorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAccentSelectorOpen(false)}
      >
        <Pressable style={styles.accentSelectorBackdrop} onPress={() => setAccentSelectorOpen(false)}>
          <View style={styles.accentSelectorCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.accentSelectorTitle}>Seleccionar acento de práctica</Text>
            <Text style={styles.accentSelectorHelper}>
              Elegí un acento o volvé a automático. Automático elige el más débil según tu progreso.
            </Text>
            <View style={styles.accentSelectorOptions}>
              {(["US", "UK", "AU", "CA"] as const).map((accent) => {
                const selected = practiceAccent === accent;
                return (
                  <Pressable
                    key={accent}
                    style={[styles.accentSelectorOption, selected && styles.accentSelectorOptionActive]}
                    onPress={async () => {
                      if (userSelectedAccent === accent) {
                        await setPracticeAccentPreference(null);
                      } else {
                        await setPracticeAccentPreference(accent);
                      }
                      setAccentSelectorOpen(false);
                    }}
                  >
                    <Text style={[styles.accentSelectorOptionText, selected && styles.accentSelectorOptionTextActive]}>
                      {ACCENT_SPEECH_META[accent].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {userSelectedAccent && (
              <Pressable
                style={styles.accentSelectorResetBtn}
                onPress={async () => {
                  await setPracticeAccentPreference(null);
                  setAccentSelectorOpen(false);
                }}
              >
                <Text style={styles.accentSelectorResetBtnText}>Volver a automático</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
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
  accentHelper: {
    fontSize: 12,
    color: "#8a6d3b",
  },
  accentHelperBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accentHelperBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  accentSelectorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  accentSelectorCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    maxWidth: "86%",
  },
  accentSelectorTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  accentSelectorHelper: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  accentSelectorOptions: {
    gap: 8,
  },
  accentSelectorOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    paddingVertical: 12,
    alignItems: "center",
  },
  accentSelectorOptionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  accentSelectorOptionText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  accentSelectorOptionTextActive: {
    color: "#fff",
  },
  accentSelectorResetBtn: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingVertical: 10,
    alignItems: "center",
  },
  accentSelectorResetBtnText: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 12,
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
  listenMessageBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  listenMessageBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  listenMessageBtnText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  correctionHintWrap: {
    marginTop: 8,
    gap: 6,
  },
  correctionHintChip: {
    alignSelf: "flex-start",
    backgroundColor: "#ffeb3b",
    borderColor: "#fbc02d",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  correctionHintChipActive: {
    backgroundColor: "#ffd54f",
  },
  correctionHintChipText: {
    color: "#5d4037",
    fontSize: 11,
    fontWeight: "700",
  },
  correctionHintPanel: {
    backgroundColor: "#fff8e1",
    borderColor: "#fbc02d",
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 4,
  },
  correctionHintTitle: {
    color: "#8d6e63",
    fontSize: 11,
    fontWeight: "700",
  },
  correctionHintText: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 16,
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
  clarityChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  clarityChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  transcriptionLangRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  transcriptionLangLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  transcriptionLangOptions: {
    flexDirection: "row",
    gap: 6,
  },
  transcriptionLangChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  transcriptionLangChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  transcriptionLangChipText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  transcriptionLangChipTextActive: {
    color: theme.colors.accent,
  },
  lookupFab: {
    position: "absolute",
    right: 16,
    bottom: 186,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    zIndex: 10,
  },
  lookupFabActive: {
    backgroundColor: "#005c6e",
  },
  lookupFabText: {
    fontSize: 22,
  },
  lookupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "flex-end",
  },
  lookupSheetWrap: {
    width: "100%",
    justifyContent: "flex-end",
  },
  lookupFloatingCard: {
    width: "100%",
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  lookupFloatingCardCompact: {
    minHeight: "56%",
    maxHeight: "62%",
  },
  lookupFloatingCardExpanded: {
    minHeight: "82%",
    maxHeight: "90%",
  },
  lookupSheetToggle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    gap: 4,
  },
  lookupDragHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 0,
  },
  lookupSheetToggleText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  lookupScrollContent: {
    gap: 10,
    paddingBottom: 4,
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
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnSend: {
    backgroundColor: theme.colors.accent,
  },
  actionBtnRecording: {
    backgroundColor: "#e53935",
  },
  actionBtnText: {
    fontSize: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
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
