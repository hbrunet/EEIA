import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { TopicSuggestion } from "../../types/progress";
import { styles } from "../ChatScreen.styles";

type Props = {
  topics: TopicSuggestion[];
  loading?: boolean;
  selectedTopic: string | null;
  onSelectTopic: (topic: string) => void;
  onStartWithTopic: (topic: string) => void;
  disabled: boolean;
};

export function TopicSuggestCard({ topics, loading, selectedTopic, onSelectTopic, onStartWithTopic, disabled }: Props) {
  return (
    <View style={styles.suggestCard}>
      <Text style={styles.suggestTitle}>Temas sugeridos para hoy</Text>
      <Text style={styles.suggestHelper}>
        Cada tema trabaja una estructura clave para subir de nivel.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 18 }} />
      ) : (
        <View style={styles.suggestGrid}>
          {topics.map((topic) => {
            const selected = selectedTopic === topic.text;
            return (
              <Pressable
                key={topic.text}
                style={[styles.suggestChip, selected && styles.suggestChipActive]}
                onPress={() => onSelectTopic(topic.text)}
              >
                <Text style={[styles.suggestChipText, selected && styles.suggestChipTextActive]}>
                  {topic.text}
                </Text>
                <Text style={[
                  styles.suggestChipSkill,
                  selected && styles.suggestChipSkillActive,
                ]}>
                  🎯 {topic.skillFocus}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Pressable
        style={[styles.suggestStartBtn, (!selectedTopic || disabled || loading) && styles.suggestStartBtnDisabled]}
        disabled={!selectedTopic || disabled || loading}
        onPress={() => {
          const topic = selectedTopic ?? topics[0]?.text;
          if (!topic) return;
          onStartWithTopic(topic);
        }}
      >
        <Text style={styles.suggestStartBtnText}>Usar tema y enviar</Text>
      </Pressable>
    </View>
  );
}
