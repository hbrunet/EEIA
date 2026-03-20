import { StyleSheet, Text, View } from "react-native";
import { theme } from "../ui/theme";

export function AuthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Placeholder</Text>
      <Text style={styles.text}>Connect your preferred sign-in provider in the next iteration.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 10,
    textAlign: "center",
  },
  text: {
    color: theme.colors.muted,
    textAlign: "center",
  },
});
