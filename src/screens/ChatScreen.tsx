import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { buildSmartTopicSuggestions } from "../domain/chatTopicEngine";
import { lookupTutorTerm, postTutorMessage, transcribeAudio, transcribeAndTranslate, TranscriptionLanguage, TranscriptionResult, TutorLookupResponse } from "../services/api/client";
import { env } from "../config/env";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";
import { styles } from "./ChatScreen.styles";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  correctionHint?: string;
  correctionExpanded?: boolean;
};

const CONTEXT_WINDOW = 8;
const SESSION_CHECKPOINT_TURNS = 3;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const CHAT_DRAFT_KEY = "eeia.chat.draft.v1";
type SpeechRate = "normal" | "slow";
const SPEECH_RATE_VALUE: Record<SpeechRate, number> = { normal: 0.95, slow: 0.65 };
const SPEECH_RATE_LABEL: Record<SpeechRate, string> = { normal: "Normal", slow: "Lento" };

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
  const { updateGoal, progress, progressRef, recordChatTurnFeedback, recordChatSessionSummary, recordLookupTerm, clearLookupHistory, setProfileLevelFromChat, setProfileNameFromChat } = useAppState();
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

  const [transcriptionLanguage, setTranscriptionLanguage] = useState<TranscriptionLanguage>("en");
  const [translateMode, setTranslateMode] = useState(false); // ES→EN
  const [lastTranslationOriginal, setLastTranslationOriginal] = useState<string | null>(null);
  const [voiceClarity, setVoiceClarity] = useState<number | null>(null);
  const [speechRate, setSpeechRate] = useState<SpeechRate>("normal");
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now());
  const [isInactive, setIsInactive] = useState(false);
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

  function getSpeechOptions(rate = 0.95): Speech.SpeechOptions {
    const locale = "en-US";
    const voice = availableVoices.find((item) => item.language?.toLowerCase() === "en-us")
      || availableVoices.find((item) => item.language?.toLowerCase().startsWith("en"));

    return {
      language: locale,
      ...(voice ? { voice: voice.identifier } : {}),
      rate,
      pitch: 1,
    };
  }

  function onChangeSpeechRate(r: SpeechRate) {
    if (r === speechRate) return;
    setSpeechRate(r);
    if (speakingMessageId) {
      const msg = messages.find((m) => m.id === speakingMessageId);
      if (msg) {
        Speech.stop();
        Speech.speak(msg.text.trim(), {
          ...getSpeechOptions(SPEECH_RATE_VALUE[r]),
          onDone: () => setSpeakingMessageId(null),
          onStopped: () => setSpeakingMessageId(null),
          onError: () => setSpeakingMessageId(null),
        });
      }
    }
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
      ...getSpeechOptions(SPEECH_RATE_VALUE[speechRate]),
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

  // Restore chat draft on mount
  useEffect(() => {
    AsyncStorage.getItem(CHAT_DRAFT_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const draft = JSON.parse(raw) as {
            messages: ChatMessage[];
            phase: "setup" | "practice";
            selectedSuggestedTopic: string | null;
            session: typeof sessionRef.current;
          };
          if (Array.isArray(draft.messages) && draft.messages.length > 0) {
            setMessages(draft.messages);
            setPhase(draft.phase ?? "setup");
            setSelectedSuggestedTopic(draft.selectedSuggestedTopic ?? null);
            if (draft.session) sessionRef.current = draft.session;
            setTimeout(() => scrollToLatest(false), 150);
          }
        } catch {
          // corrupt draft — ignore
        }
      })
      .catch(() => {});
  }, []);

  // Persist chat draft whenever messages or phase change
  useEffect(() => {
    if (messages.length === 0 && phase === "setup") {
      AsyncStorage.removeItem(CHAT_DRAFT_KEY).catch(() => {});
      return;
    }
    const draft = {
      messages,
      phase,
      selectedSuggestedTopic,
      session: sessionRef.current,
    };
    AsyncStorage.setItem(CHAT_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [messages, phase, selectedSuggestedTopic]);

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
    const interval = setInterval(() => {
      setIsInactive(Date.now() - lastActivityAt > INACTIVITY_TIMEOUT_MS);
    }, 30_000);
    return () => clearInterval(interval);
  }, [lastActivityAt]);

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
    AsyncStorage.removeItem(CHAT_DRAFT_KEY).catch(() => {});

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
    const turnCount = sessionRef.current.turns;
    const detail = turnCount > 0
      ? `Tenés ${turnCount} ${turnCount === 1 ? "turno" : "turnos"} en esta sesión. El historial se borrará y no podrás recuperarlo.`
      : "El historial actual se borrará.";
    Alert.alert("¿Empezar sesión nueva?", detail, [
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
          currentPhase: phase,
          currentTopic: sessionRef.current.topic || undefined,
      } : undefined);
      setLastSource(response.source || null);
      setLastActivityAt(Date.now());
      setIsInactive(false);
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

      await recordChatTurnFeedback({
        hadCorrection: hasCorrection,
        hadPronunciationHint: hasPronunciationHint,
      });

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
    // Reset per-message state after send
    setLastTranslationOriginal(null);
    setTranscriptionLanguage("en");
  }

  async function onMicPress() {
    if (recording) {
      // Stop recording and transcribe (or translate)
      setIsTranscribing(true);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
          if (translateMode) {
            const result = await transcribeAndTranslate(uri);
            setMessage(result.translated);
            setLastTranslationOriginal(result.original || null);
          } else {
            const result: TranscriptionResult = await transcribeAudio(uri, transcriptionLanguage);
            setMessage(result.text);
            setLastTranslationOriginal(null);
            if (result.avgLogprob !== null) {
              setVoiceClarity(result.avgLogprob);
            }
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
          <View style={styles.titleRow}>
            <Text style={styles.title}>Tutor Chat</Text>
            <Text style={[styles.statusDot, { color: !isInactive && lastSource && lastSource !== "fallback" ? theme.colors.accent : theme.colors.accentAlt }]}>●</Text>
          </View>
          {messages.length > 0 && (
            <Pressable style={styles.newSessionBtn} onPress={onClearChat}>
              <Text style={styles.newSessionText}>Nueva sesión</Text>
            </Pressable>
          )}
        </View>
        {phase === "setup" ? (
          <Text style={styles.helper}>
            {profileLevelConfigured
              ? "¿Qué tema practicamos hoy?"
              : "El tutor te guiará antes de empezar."}
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
            {!profileLevelConfigured && (
              <View style={styles.welcomeCard}>
                <Text style={styles.welcomeTitle}>¡Hola! Soy tu tutor de inglés</Text>
                <Text style={styles.welcomeText}>
                  Voy a ayudarte a practicar de forma personalizada. Para empezar, solo saluda o tocá el botón de abajo.
                </Text>
                <Pressable
                  style={[styles.welcomeStartBtn, actionDisabled && styles.buttonDisabled]}
                  disabled={actionDisabled}
                  onPress={() => void onSend("Hello! I want to start practicing English.")}
                >
                  <Text style={styles.welcomeStartBtnText}>Saludar al tutor →</Text>
                </Pressable>
              </View>
            )}
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
                <View style={styles.listenMessageRow}>
                  <Pressable
                    style={[styles.listenMessageBtn, speakingMessageId === item.id && styles.listenMessageBtnActive]}
                    onPress={() => onSpeakAssistantMessage(item.id, item.text)}
                  >
                    <Text style={styles.listenMessageBtnText}>
                      {speakingMessageId === item.id ? "Detener audio" : "Escuchar mensaje"}
                    </Text>
                  </Pressable>
                  {(["normal", "slow"] as const).map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.speechRateChip, speechRate === r && styles.speechRateChipActive]}
                      onPress={() => onChangeSpeechRate(r)}
                    >
                      <Text style={[styles.speechRateChipText, speechRate === r && styles.speechRateChipTextActive]}>
                        {SPEECH_RATE_LABEL[r]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
        {loading && (
          <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
            <Text style={styles.typingDots}>● ● ●</Text>
          </View>
        )}
        {lastPronunciationHint && (
          <View style={styles.pronunciationBox}>
            <Text style={styles.pronunciationLabel}>🗣 Pronunciación</Text>
            <Text style={styles.pronunciationText}>{lastPronunciationHint}</Text>
          </View>
        )}
      </ScrollView>

      {/* Dictionary inline panel */}
      {lookupOpen && (
        <View style={styles.lookupPanel}>
          <View style={styles.lookupPanelHeader}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.lookupHistoryScroll}
              keyboardShouldPersistTaps="handled"
            >
              {recentLookups.map((term) => (
                <Pressable
                  key={`rh-${term}`}
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
                      } catch (e) {
                        setLookupError(e instanceof Error ? e.message : "Error al consultar.");
                      } finally {
                        setLookupLoading(false);
                      }
                    })();
                  }}
                >
                  <Text style={styles.lookupHistoryChipText}>{term}</Text>
                </Pressable>
              ))}
              {recentLookups.length > 0 && (
                <Pressable
                  style={styles.lookupClearChip}
                  onPress={() => { void clearLookupHistory(); setLookupResult(null); setLookupError(null); }}
                >
                  <Text style={styles.lookupClearChipText}>Limpiar</Text>
                </Pressable>
              )}
            </ScrollView>
            <Pressable
              style={styles.lookupCloseBtn}
              onPress={() => { setLookupOpen(false); setLookupError(null); }}
            >
              <Text style={styles.lookupCloseBtnText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.lookupInputRow}>
            <TextInput
              value={lookupQuery}
              onChangeText={setLookupQuery}
              placeholder="Palabra o frase..."
              placeholderTextColor={theme.colors.muted}
              style={styles.lookupInput}
              returnKeyType="search"
              onSubmitEditing={() => { if (lookupQuery.trim()) void onLookupPress(); }}
            />
            <Pressable
              style={[styles.lookupButton, (!lookupQuery.trim() || lookupLoading) && styles.buttonDisabled]}
              disabled={!lookupQuery.trim() || lookupLoading}
              onPress={() => { void onLookupPress(); }}
            >
              <Text style={styles.lookupButtonText}>{lookupLoading ? "⏳" : "Buscar"}</Text>
            </Pressable>
          </View>

          {lookupError && <Text style={styles.lookupErrorText}>{lookupError}</Text>}
          {lookupResult && (
            <View style={styles.lookupResult}>
              <View style={styles.lookupResultRow}>
                <Text style={styles.lookupWord}>{lookupResult.term}</Text>
                <Text style={styles.lookupTranslation}>{lookupResult.translation}</Text>
              </View>
              <Text style={styles.lookupExample} numberOfLines={2}>Ej: {lookupResult.example}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer fijo */}
      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}

        {voiceClarity !== null && !translateMode && (() => {
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
        {lastTranslationOriginal !== null && (
          <View style={[styles.clarityChip, { backgroundColor: "#eef6ff", borderColor: theme.colors.accent }]}>
            <Text style={[styles.clarityChipText, { color: theme.colors.accent }]}>
              Dijiste: "{lastTranslationOriginal}"
            </Text>
          </View>
        )}

        {!hasTypedMessage && (
        <View style={styles.transcriptionLangRow}>
          <Text style={styles.transcriptionLangLabel}>Idioma:</Text>
          <View style={styles.transcriptionLangOptions}>
            <Pressable
              style={[styles.transcriptionLangChip, transcriptionLanguage === "en" && !translateMode && styles.transcriptionLangChipActive]}
              onPress={() => { setTranslateMode(false); setTranscriptionLanguage("en"); setLastTranslationOriginal(null); }}
              disabled={isTranscribing || loading}
            >
              <Text style={[styles.transcriptionLangChipText, transcriptionLanguage === "en" && !translateMode && styles.transcriptionLangChipTextActive]}>EN</Text>
            </Pressable>
            <Pressable
              style={[styles.transcriptionLangChip, transcriptionLanguage === "es" && !translateMode && styles.transcriptionLangChipActive]}
              onPress={() => { setTranslateMode(false); setTranscriptionLanguage("es"); setLastTranslationOriginal(null); setVoiceClarity(null); }}
              disabled={isTranscribing || loading}
            >
              <Text style={[styles.transcriptionLangChipText, transcriptionLanguage === "es" && !translateMode && styles.transcriptionLangChipTextActive]}>ES</Text>
            </Pressable>
            <Pressable
              style={[styles.transcriptionLangChip, translateMode && styles.transcriptionLangChipActive]}
              onPress={() => { setTranslateMode(true); setVoiceClarity(null); }}
              disabled={isTranscribing || loading}
            >
              <Text style={[styles.transcriptionLangChipText, translateMode && styles.transcriptionLangChipTextActive]}>ES → EN</Text>
            </Pressable>
          </View>
        </View>
        )}
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

    </KeyboardAvoidingView>
  );
}

