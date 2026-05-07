import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { styles } from "../ChatScreen.styles";

type Props = {
  topics: string[];
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
        Elegí uno para arrancar más rápido según tu nivel y progreso.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 18 }} />
      ) : (
        <View style={styles.suggestGrid}>
          {topics.map((topic) => {
            const selected = selectedTopic === topic;
            return (
              <Pressable
                key={topic}
                style={[styles.suggestChip, selected && styles.suggestChipActive]}
                onPress={() => onSelectTopic(topic)}
              >
                <Text style={[styles.suggestChipText, selected && styles.suggestChipTextActive]}>
                  {topic}
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
          const topic = selectedTopic ?? topics[0];
          if (!topic) return;
          onStartWithTopic(topic);
        }}
      >
        <Text style={styles.suggestStartBtnText}>Usar tema y enviar</Text>
      </Pressable>
    </View>
  );
}
