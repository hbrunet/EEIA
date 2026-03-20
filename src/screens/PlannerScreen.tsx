import { StyleSheet, Text, View } from "react-native";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

export function PlannerScreen() {
  const { progress } = useAppState();
  const weeklyPlan = progress?.weeklyPlan || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Planner</Text>
      <View style={styles.card}>
        {weeklyPlan.map((item) => (
          <Text style={styles.day} key={item.day}>
            {item.day}: {item.objective}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  day: {
    color: theme.colors.text,
    lineHeight: 22,
  },
});
