import { StyleSheet } from "react-native";
import { theme } from "../ui/theme";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  headerText: { gap: 2 },
  greeting: { color: theme.colors.muted, fontSize: 14 },
  name: { color: theme.colors.text, fontSize: 24, fontWeight: "700" },
  levelBadge: { backgroundColor: theme.colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  levelText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  sectionLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  sectionTitle: { fontWeight: "700", color: theme.colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },

  // Tarjeta foco
  focusCard: {
    backgroundColor: "#eef9f0",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#b8e5bf",
    padding: 16,
    gap: 10,
  },
  focusCardDone: {
    backgroundColor: "#eaf6ff",
    borderColor: "#b7d8f4",
  },
  focusHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  focusLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  focusStatus: { color: "#7c5a00", fontSize: 12, fontWeight: "700", backgroundColor: "#fff3cd", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  focusStatusDone: { color: "#1e5a2a", backgroundColor: "#c8f0d0" },
  focusTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700", lineHeight: 22 },
  focusDesc: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },

  chatBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 2,
  },
  chatBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#d9ecdf",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#236b35", fontWeight: "700", fontSize: 13 },

  // Racha e insignias
  streakSection: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#c8e6ce",
    gap: 10,
  },
  streakMainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  streakNumber: { fontSize: 32, fontWeight: "700", color: "#e65100" },
  streakInfo: { gap: 2, flex: 1 },
  streakLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  streakHint: { color: theme.colors.muted, fontSize: 12 },
  badgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeChipUnlocked: { backgroundColor: "#fff3cd", borderWidth: 1, borderColor: "#f0c040" },
  badgeIcon: { fontSize: 16 },
  badgeLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
  badgeLabelUnlocked: { color: "#7c5a00", fontWeight: "700" },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statCard: {
    width: "47%",
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 4,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { color: theme.colors.muted, fontSize: 11 },
  statTrack: { width: "100%", height: 4, backgroundColor: theme.colors.border, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  statFill: { height: 4, borderRadius: 2 },

  activityCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 4,
  },
  activityLine: { color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  activityBold: { fontWeight: "700" },
  activityHint: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },

  trendCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6 },
  chartColumn: { alignItems: "center", gap: 4, flex: 1 },
  chartBars: { height: 34, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  chartBar: { width: 5, borderRadius: 2 },
  chartBarGrammar: { backgroundColor: "#1e88e5" },
  chartBarFluency: { backgroundColor: "#f9a825" },
  chartBarPronunciation: { backgroundColor: "#43a047" },
  chartDay: { color: theme.colors.muted, fontSize: 10 },
  chartLegend: { color: theme.colors.muted, fontSize: 11 },

  diagnosticCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0d070",
    padding: 16,
    gap: 6,
  },
  diagnosticTitle: { fontWeight: "700", color: "#7c5a00", fontSize: 15 },
  diagnosticDesc: { color: "#7c5a00", fontSize: 13, lineHeight: 19 },
  diagnosticCta: { color: theme.colors.accent, fontWeight: "700", fontSize: 13, marginTop: 4 },

  footerSpace: { height: 8 },
});
