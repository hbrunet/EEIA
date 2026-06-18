import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { buildSmartTopicSuggestions } from "../domain/chatTopicEngine";
import { fetchTopicSuggestions, streamTutorMessage, transcribeAudio, transcribeAndTranslate, TranscriptionLanguage, TranscriptionResult } from "../services/api/client";
import { useAppState } from "../state/AppContext";
import { TopicSuggestion } from "../types/progress";
import { theme } from "../ui/theme";
import { styles } from "./ChatScreen.styles";
import { ChatMessage, SpeechRate, SPEECH_RATE_VALUE } from "./chat/types";
import { ChatBubble } from "./chat/ChatBubble";
import { TypingIndicator } from "./chat/TypingIndicator";
import { TopicSuggestCard } from "./chat/TopicSuggestCard";
import { WelcomeCard } from "./chat/WelcomeCard";

const CONTEXT_WINDOW = 20;
const SESSION_CHECKPOINT_TURNS = 3;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const CHAT_DRAFT_KEY = "eeia.chat.draft.v1";

function isBeginnerLevel(level?: string): boolean {
  const normalized = String(level || "").trim().toUpperCase();
  return normalized === "A1" || normalized === "A2";
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
  const { updateGoal, progress, progressRef, recordChatTurnFeedback, recordChatSessionSummary, recordLookupTerm, setProfileLevelFromChat, setProfileNameFromChat } = useAppState();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSource, setLastSource] = useState<"openai" | "gemini" | "groq" | "fallback" | null>(null);
  const [lastPronunciationHint, setLastPronunciationHint] = useState<string | null>(null);
  const [phase, setPhase] = useState<"setup" | "practice">("setup");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedSuggestedTopic, setSelectedSuggestedTopic] = useState<string | null>(null);
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
  const [suggestedTopics, setSuggestedTopics] = useState<TopicSuggestion[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [pendingTopicSelection, setPendingTopicSelection] = useState(false);

  useEffect(() => {
    if (!progress || !profileLevelConfigured) return;
    let cancelled = false;
    setTopicsLoading(true);
    const localFallback = buildSmartTopicSuggestions(progress);
    const listeningByAccent = (progress.metrics as any).listeningByAccent ?? {};
    fetchTopicSuggestions({
      level: progress.profile.level,
      name: progress.profile.name,
      nextClassGoal: progress.nextClassGoal,
      grammarAccuracy: progress.metrics.grammarAccuracy,
      fluencyScore: progress.metrics.fluencyScore,
      pronunciationScore: progress.metrics.pronunciationScore,
      weaknesses: progress.weaknesses?.map((w) => w.detail) ?? [],
      recentTopics: (progress.chatSessionHistory || []).slice(0, 8).map((s) => s.topic).filter(Boolean),
      listeningByAccent,
    })
      .then((res) => {
        if (!cancelled) setSuggestedTopics(res.topics.length > 0 ? res.topics : localFallback);
      })
      .catch(() => {
        if (!cancelled) setSuggestedTopics(localFallback);
      })
      .finally(() => {
        if (!cancelled) setTopicsLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLevelConfigured]);
  const hasTypedMessage = message.trim().length > 0;
  const actionDisabled = loading || isTranscribing;
  const inputControlsDisabled = actionDisabled || recording !== null;

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
            if (draft.session) {
              const sameDay = draft.session.startedAt
                ? new Date(draft.session.startedAt).toDateString() === new Date().toDateString()
                : false;
              sessionRef.current = sameDay
                ? draft.session
                : {
                    ...sessionRef.current,
                    topic: draft.session.topic,
                    source: draft.session.source,
                    turns: 0,
                    correctionCount: 0,
                    pronunciationHintCount: 0,
                    startedAt: new Date().toISOString(),
                  };
            }
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
            setPendingTopicSelection(false);
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
    setIsStreaming(false);

    const historyWindow = messages.slice(-CONTEXT_WINDOW).map((item) => ({
      role: item.role,
      text: item.text,
    }));

    const userMessageId = `${Date.now()}-u`;
    const assistantMessageId = `${Date.now()}-a`;
    streamingMessageIdRef.current = assistantMessageId;

    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", text: trimmed, correctionExpanded: false },
    ]);

    setMessage("");
    if (forcedMessage) setSelectedSuggestedTopic(null);
    setLastTranslationOriginal(null);
    setTranscriptionLanguage("en");

    const latestProgress = progressRef.current;
    const learnerProfile = latestProgress ? {
      name: latestProgress.profile.name,
      level: latestProgress.profile.level,
      grammarAccuracy: latestProgress.metrics.grammarAccuracy,
      fluencyScore: latestProgress.metrics.fluencyScore,
      pronunciationScore: latestProgress.metrics.pronunciationScore,
      weaknesses: latestProgress.weaknesses.slice(0, 3).map((w) => ({ area: w.area, detail: w.detail, severity: w.severity })),
      goals: latestProgress.profile.goals,
      currentPhase: phase,
      currentTopic: sessionRef.current.topic || undefined,
    } : undefined;

    try {
      await streamTutorMessage(
        trimmed,
        historyWindow,
        learnerProfile,
        {
          onChunk: (text) => {
            setIsStreaming(true);
            setMessages((current) => {
              const existing = current.find((m) => m.id === assistantMessageId);
              if (existing) {
                return current.map((m) =>
                  m.id === assistantMessageId ? { ...m, text: m.text + text } : m
                );
              }
              return [...current, { id: assistantMessageId, role: "assistant", text }];
            });
            scrollToLatest(false);
          },
          onDone: async (meta) => {
            setLastSource(meta.source || null);
            setLastActivityAt(Date.now());
            setIsInactive(false);
            streamingMessageIdRef.current = null;

            const correctionText = meta.correction && meta.correction.toLowerCase() !== "null" ? meta.correction : null;
            setLastPronunciationHint(meta.pronunciationHint && meta.pronunciationHint.toLowerCase() !== "null" ? meta.pronunciationHint : null);
            const hasCorrection = Boolean(correctionText);
            const hasPronunciationHint = Boolean(meta.pronunciationHint && meta.pronunciationHint.toLowerCase() !== "null");

            if (!latestProgress?.profile.level && meta.capturedLevel) {
              await setProfileLevelFromChat(meta.capturedLevel);
              setPendingTopicSelection(true);
            }
            if (!latestProgress?.profile.name?.trim() && meta.capturedName) {
              await setProfileNameFromChat(meta.capturedName);
            }

            const suggestedTopic = (meta.suggestedGoal || "").trim();
            if (!sessionRef.current.topic) {
              sessionRef.current.topic = (suggestedTopic || trimmed).slice(0, 100);
            }
            sessionRef.current.turns += 1;
            sessionRef.current.correctionCount += hasCorrection ? 1 : 0;
            sessionRef.current.pronunciationHintCount += hasPronunciationHint ? 1 : 0;
            sessionRef.current.source = meta.source || "fallback";

            if (correctionText) {
              setMessages((current) =>
                current.map((m) =>
                  m.id === userMessageId ? { ...m, correctionHint: correctionText } : m
                )
              );
            }

            await recordChatTurnFeedback({ hadCorrection: hasCorrection, hadPronunciationHint: hasPronunciationHint });
            if (sessionRef.current.turns >= SESSION_CHECKPOINT_TURNS) await saveChatSessionCheckpoint();
            if (meta.phase === "practice") setPhase("practice");
            await updateGoal(meta.suggestedGoal);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          },
          onError: (err) => {
            console.error("[Stream] error", err);
            setError("No se pudo conectar con el tutor. Verificá que el backend esté activo e intentá de nuevo.");
            streamingMessageIdRef.current = null;
          },
        },
      );
    } catch {
      setError("No se pudo conectar con el tutor. Verificá que el backend esté activo e intentá de nuevo.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
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
            <Text style={[styles.statusDot, { color: lastSource && lastSource !== "fallback" ? theme.colors.accent : theme.colors.accentAlt }]}>●</Text>
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
        {messages.length === 0 && !pendingTopicSelection && (
          <>
            {phase === "setup" && profileLevelConfigured && (topicsLoading || suggestedTopics.length > 0) && (
              <TopicSuggestCard
                topics={suggestedTopics}
                loading={topicsLoading}
                selectedTopic={selectedSuggestedTopic}
                onSelectTopic={(topic) => {
                  setSelectedSuggestedTopic(topic);
                  setMessage(`Quiero practicar: ${topic}`);
                }}
                onStartWithTopic={(topic) => void onSend(`Quiero practicar: ${topic}`)}
                disabled={actionDisabled}
              />
            )}
            {!profileLevelConfigured && (
              <WelcomeCard
                onStart={() => void onSend("Hello! I want to start practicing English.")}
                disabled={actionDisabled}
              />
            )}
          </>
        )}
        {messages.map((item) => (
          <ChatBubble
            key={item.id}
            item={item}
            speakingMessageId={speakingMessageId}
            speechRate={speechRate}
            level={progress?.profile.level}
            onSpeak={onSpeakAssistantMessage}
            onChangeSpeechRate={onChangeSpeechRate}
            onToggleCorrection={onToggleCorrection}
            onLookup={(term) => void recordLookupTerm(term)}
          />
        ))}
        {pendingTopicSelection && phase === "setup" && (topicsLoading || suggestedTopics.length > 0) && (
          <TopicSuggestCard
            topics={suggestedTopics}
            loading={topicsLoading}
            selectedTopic={selectedSuggestedTopic}
            onSelectTopic={(topic) => {
              setSelectedSuggestedTopic(topic);
              setMessage(`Quiero practicar: ${topic}`);
            }}
            onStartWithTopic={(topic) => {
              setPendingTopicSelection(false);
              void onSend(`Quiero practicar: ${topic}`);
            }}
            disabled={actionDisabled}
          />
        )}
        {loading && !isStreaming && <TypingIndicator />}
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

        <View style={[styles.transcriptionLangRow, inputControlsDisabled && styles.buttonDisabled]}>
          <Text style={styles.transcriptionLangLabel}>Idioma:</Text>
          <View style={styles.transcriptionLangOptions}>
            <Pressable
              style={[styles.transcriptionLangChip, transcriptionLanguage === "en" && !translateMode && styles.transcriptionLangChipActive]}
              onPress={() => { setTranslateMode(false); setTranscriptionLanguage("en"); setLastTranslationOriginal(null); }}
              disabled={inputControlsDisabled}
            >
              <Text style={[styles.transcriptionLangChipText, transcriptionLanguage === "en" && !translateMode && styles.transcriptionLangChipTextActive]}>EN</Text>
            </Pressable>
            <Pressable
              style={[styles.transcriptionLangChip, transcriptionLanguage === "es" && !translateMode && styles.transcriptionLangChipActive]}
              onPress={() => { setTranslateMode(false); setTranscriptionLanguage("es"); setLastTranslationOriginal(null); setVoiceClarity(null); }}
              disabled={inputControlsDisabled}
            >
              <Text style={[styles.transcriptionLangChipText, transcriptionLanguage === "es" && !translateMode && styles.transcriptionLangChipTextActive]}>ES</Text>
            </Pressable>
            <Pressable
              style={[styles.transcriptionLangChip, translateMode && styles.transcriptionLangChipActive]}
              onPress={() => { setTranslateMode(true); setVoiceClarity(null); }}
              disabled={inputControlsDisabled}
            >
              <Text style={[styles.transcriptionLangChipText, translateMode && styles.transcriptionLangChipTextActive]}>ES → EN</Text>
            </Pressable>
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
            placeholder="Escribí tu mensaje..."
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, actionDisabled && styles.buttonDisabled]}
            multiline
            editable={!actionDisabled}
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

