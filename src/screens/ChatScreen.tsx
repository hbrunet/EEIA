import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { postTutorMessage } from "../services/api/client";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const CONTEXT_WINDOW = 8;

export function ChatScreen() {
  const { updateGoal } = useAppState();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
      const response = await postTutorMessage(trimmed, historyWindow);

      setMessages((current) => [
        ...current.slice(-CONTEXT_WINDOW),
        { id: `${Date.now()}-a`, role: "assistant", text: response.reply },
      ]);

      await updateGoal(response.suggestedGoal);
    } catch {
      setError("Could not reach tutor API. Check backend and API URL.");
    } finally {
      setLoading(false);
    }

    setMessage("");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tutor Chat</Text>
      <Text style={styles.helper}>
        Send your need and the tutor replies with practice guidance. Suggested goal updates your plan.
      </Text>

      <ScrollView style={styles.chatBox} contentContainerStyle={styles.chatContent}>
        {messages.length === 0 && (
          <Text style={styles.empty}>No messages yet. Start with a real difficulty you want to fix.</Text>
        )}
        {messages.map((item) => (
          <View
            key={item.id}
            style={[styles.bubble, item.role === "assistant" ? styles.assistantBubble : styles.userBubble]}
          >
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        ))}
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Example: I struggle with present perfect questions"
        placeholderTextColor={theme.colors.muted}
        style={styles.input}
        multiline
      />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={onSend} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Sending..." : "Send to tutor"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
  },
  helper: {
    fontSize: 14,
    color: theme.colors.muted,
  },
  chatBox: {
    maxHeight: 250,
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
  },
  chatContent: {
    padding: 10,
    gap: 8,
  },
  empty: {
    color: theme.colors.muted,
  },
  bubble: {
    borderRadius: 10,
    padding: 10,
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
  },
  error: {
    color: "#b00020",
  },
  input: {
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 120,
    padding: 12,
    color: theme.colors.text,
    textAlignVertical: "top",
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
});
