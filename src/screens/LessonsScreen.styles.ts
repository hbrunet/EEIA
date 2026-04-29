import { StyleSheet } from "react-native";
import { theme } from "../ui/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: theme.colors.muted, fontSize: 16 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  objective: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#ddeef2",
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeAccent: {
    backgroundColor: "#fde8c2",
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: { color: theme.colors.muted, fontSize: 13 },
  progressPct: { color: theme.colors.accent, fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: -8,
  },
  progressFill: {
    height: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accent,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  checkText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  checkTextDone: {
    color: theme.colors.muted,
    textDecorationLine: "line-through",
  },
  weaknessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e05a00",
    flexShrink: 0,
  },
  weaknessText: {
    color: theme.colors.text,
    fontSize: 13,
    flex: 1,
  },
  successCard: {
    backgroundColor: "#e8f5e9",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  successText: {
    color: "#2e7d32",
    fontWeight: "700",
    fontSize: 16,
  },
  resetLink: {
    color: theme.colors.accent,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
