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
  cardHero: {
    backgroundColor: "#ecf8f2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c3e6d2",
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accent,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiCard: {
    width: "31%",
    minWidth: 92,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 4,
  },
  kpiLabel: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  kpiValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  kpiHint: {
    color: theme.colors.muted,
    fontSize: 10,
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  focusBullet: {
    color: theme.colors.accent,
    fontSize: 14,
    lineHeight: 18,
  },
  focusText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: theme.colors.border,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  actionBtnTextSecondary: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  trendLine: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 6,
  },
  chartColumn: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  chartBars: {
    height: 36,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  chartBar: {
    width: 6,
    borderRadius: 2,
  },
  chartBarGrammar: {
    backgroundColor: "#ef6c00",
  },
  chartBarFluency: {
    backgroundColor: "#fdd835",
  },
  chartBarPron: {
    backgroundColor: "#43a047",
  },
  chartDay: {
    color: theme.colors.muted,
    fontSize: 10,
  },
  chartLegend: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  chatRow: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chatRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatDate: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  chatTurns: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  chatTopic: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  contextSubtext: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  empty: {
    color: theme.colors.muted,
    fontSize: 13,
  },
});
