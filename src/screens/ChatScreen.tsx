import { useState, useRef } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import { postTutorMessage, transcribeAudio } from "../services/api/client";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const CONTEXT_WINDOW = 8;

export function ChatScreen() {
  const { updateGoal, progress } = useAppState();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSource, setLastSource] = useState<"openai" | "gemini" | "groq" | "fallback" | null>(null);
  const [lastCorrection, setLastCorrection] = useState<string | null>(null);
  const [lastExercise, setLastExercise] = useState<string | null>(null);
  const [lastPronunciationHint, setLastPronunciationHint] = useState<string | null>(null);
  const [phase, setPhase] = useState<"setup" | "practice">("setup");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function onClearChat() {
    Alert.alert(
      "Nueva sesión",
      "¿Querés empezar una conversación nueva? El historial actual se borrará.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Nueva sesión",
          style: "destructive",
          onPress: () => {
            setMessages([]);
            setPhase("setup");
            setLastCorrection(null);
            setLastExercise(null);
            setLastPronunciationHint(null);
            setLastSource(null);
            setError(null);
          },
        },
      ]
    );
  }

  async function onSend() {
    if (!message.trim()) return;
    const trimmed = message.trim();
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
      setLastExercise(response.exercise && response.exercise.toLowerCase() !== "null" ? response.exercise : null);
      setLastPronunciationHint(response.pronunciationHint && response.pronunciationHint.toLowerCase() !== "null" ? response.pronunciationHint : null);
      // Phase can advance but never revert to setup
      if (response.phase === "practice") setPhase("practice");

      setMessages((current) => [
        ...current.slice(-CONTEXT_WINDOW),
        { id: `${Date.now()}-a`, role: "assistant", text: response.reply },
      ]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      await updateGoal(response.suggestedGoal);
    } catch {
      setError("Could not reach tutor API. Check backend and API URL.");
    } finally {
      setLoading(false);
    }

    setMessage("");
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
        setError(`No se pudo transcribir el audio: ${e instanceof Error ? e.message : String(e)}`);
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
          <Text style={styles.helper}>El tutor te va a preguntar tu nivel y la temática que querés practicar antes de empezar.</Text>
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
          <Text style={styles.empty}>Empezá saludando al tutor para configurar tu sesión.</Text>
        )}
        {messages.map((item) => (
          <View
            key={item.id}
            style={[styles.bubble, item.role === "assistant" ? styles.assistantBubble : styles.userBubble]}
          >
            <Text style={styles.bubbleText}>{item.text}</Text>
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
        {lastExercise && (
          <View style={styles.exerciseBox}>
            <Text style={styles.exerciseLabel}>Ejercicio propuesto</Text>
            <Text style={styles.exerciseText}>{lastExercise}</Text>
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
        <View style={styles.inputRow}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={phase === "setup" ? "Respondé en español..." : "Write in English..."}
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
        <Pressable style={[styles.button, (loading || isTranscribing) && styles.buttonDisabled]} onPress={onSend} disabled={loading || isTranscribing}>
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
  exerciseBox: {
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#4caf50",
  },
  exerciseLabel: {
    fontWeight: "700" as const,
    fontSize: 12,
    color: "#2e7d32",
    marginBottom: 2,
  },
  exerciseText: {
    color: "#1b5e20",
    fontSize: 13,
  },
});
