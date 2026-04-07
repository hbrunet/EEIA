import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const LEVEL_HELP: Record<(typeof LEVELS)[number], string> = {
  A1: "Principiante total",
  A2: "Básico con frases simples",
  B1: "Intermedio funcional",
  B2: "Intermedio alto",
  C1: "Avanzado",
};

export function ProfileScreen() {
  const { progress, updateProfile } = useAppState();
  const [name, setName] = useState(progress?.profile.name || "");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>(progress?.profile.level || "A2");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!progress) return;
    setName(progress.profile.name || "");
    setLevel(progress.profile.level || "A2");
  }, [progress]);

  async function onSave() {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Falta tu nombre", "Escribí tu nombre para personalizar el tutor.");
      return;
    }

    try {
      setSaving(true);
      await updateProfile({ name: cleanName, level });
      Alert.alert("Perfil actualizado", "Tu nombre y nivel ya están guardados.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tu perfil</Text>
      <Text style={styles.helper}>
        Configurá tu nombre y nivel para que el chat no vuelva a preguntarte el nivel en cada sesión.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej: Camila"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Nivel de inglés</Text>
        <View style={styles.levelGrid}>
          {LEVELS.map((item) => {
            const selected = level === item;
            return (
              <Pressable
                key={item}
                style={[styles.levelBtn, selected && styles.levelBtnActive]}
                onPress={() => setLevel(item)}
              >
                <Text style={[styles.levelText, selected && styles.levelTextActive]}>{item}</Text>
                <Text style={[styles.levelHint, selected && styles.levelHintActive]}>{LEVEL_HELP[item]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Guardando..." : "Guardar perfil"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: "700", marginTop: 12 },
  helper: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 14,
  },
  levelGrid: { gap: 8 },
  levelBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: theme.colors.background,
  },
  levelBtnActive: { borderColor: theme.colors.accent, backgroundColor: "rgba(36, 99, 235, 0.12)" },
  levelText: { color: theme.colors.text, fontWeight: "700", fontSize: 14 },
  levelTextActive: { color: theme.colors.accent },
  levelHint: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  levelHintActive: { color: theme.colors.text },
  saveBtn: {
    marginTop: 6,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
