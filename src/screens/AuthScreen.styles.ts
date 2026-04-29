import { StyleSheet } from "react-native";
import { theme } from "../ui/theme";

export const styles = StyleSheet.create({
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
