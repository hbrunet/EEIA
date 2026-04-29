import { StyleSheet } from "react-native";
import { theme } from "../ui/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    fontSize: 10,
    lineHeight: 22,
  },
  newSessionBtn: {
    backgroundColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  newSessionText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  helper: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  practiceBadge: {
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start" as const,
    borderLeftWidth: 3,
    borderLeftColor: "#1976d2",
  },
  practiceBadgeText: {
    color: "#1565c0",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 10,
    gap: 10,
    flexGrow: 1,
  },
  empty: {
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: 40,
  },
  // Suggest card
  suggestCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  suggestTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  suggestHelper: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  suggestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: "100%",
  },
  suggestChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  suggestChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  suggestChipTextActive: {
    color: theme.colors.accent,
  },
  suggestStartBtn: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    paddingVertical: 9,
  },
  suggestStartBtnDisabled: {
    opacity: 0.5,
  },
  suggestStartBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  // Welcome card
  welcomeCard: {
    backgroundColor: theme.colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 12,
    marginTop: 24,
    alignItems: "center",
  },
  welcomeTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  welcomeText: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  welcomeStartBtn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  welcomeStartBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  // Chat bubbles
  bubble: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "82%",
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
    fontSize: 14,
    lineHeight: 20,
  },
  typingBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  typingDots: {
    color: theme.colors.muted,
    fontSize: 12,
    letterSpacing: 3,
  },
  // Listen / TTS controls
  listenMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  listenMessageBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  listenMessageBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  listenMessageBtnText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  speechRateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speechRateChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  speechRateChipText: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  speechRateChipTextActive: {
    color: theme.colors.accent,
  },
  // Correction hint
  correctionHintWrap: {
    marginTop: 8,
    gap: 6,
  },
  correctionHintChip: {
    alignSelf: "flex-start",
    backgroundColor: "#ffeb3b",
    borderColor: "#fbc02d",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  correctionHintChipActive: {
    backgroundColor: "#ffd54f",
  },
  correctionHintChipText: {
    color: "#5d4037",
    fontSize: 11,
    fontWeight: "700",
  },
  correctionHintPanel: {
    backgroundColor: "#fff8e1",
    borderColor: "#fbc02d",
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 4,
  },
  correctionHintTitle: {
    color: "#8d6e63",
    fontSize: 11,
    fontWeight: "700",
  },
  correctionHintText: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  // Pronunciation box
  pronunciationBox: {
    backgroundColor: "#ede7f6",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#7c4dff",
  },
  pronunciationLabel: {
    fontWeight: "700" as const,
    fontSize: 12,
    color: "#4a148c",
    marginBottom: 2,
  },
  pronunciationText: {
    color: "#311b92",
    fontSize: 13,
  },
  // Inline word lookup
  lookupInlineWord: {
    textDecorationLine: "underline",
    textDecorationColor: theme.colors.accent,
  },
  // Dictionary panel
  lookupPanel: {
    backgroundColor: theme.colors.panel,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  lookupPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lookupHistoryScroll: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingRight: 4,
  },
  lookupHistoryChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  lookupHistoryChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  lookupClearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lookupClearChipText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  lookupCloseBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  lookupCloseBtnText: {
    color: theme.colors.muted,
    fontSize: 16,
    fontWeight: "600",
  },
  lookupInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  lookupInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 13,
  },
  lookupButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  lookupButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  lookupErrorText: {
    color: "#b00020",
    fontSize: 12,
  },
  lookupResult: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lookupResultRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  lookupWord: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  lookupTranslation: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  lookupExample: {
    color: theme.colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  error: {
    color: "#b00020",
    fontSize: 13,
  },
  clarityChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  clarityChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  transcriptionLangRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  transcriptionLangLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  transcriptionLangOptions: {
    flexDirection: "row",
    gap: 6,
  },
  transcriptionLangChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  transcriptionLangChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "#dff3f8",
  },
  transcriptionLangChipText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  transcriptionLangChipTextActive: {
    color: theme.colors.accent,
  },
  // Input row
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    maxHeight: 120,
    padding: 12,
    color: theme.colors.text,
    textAlignVertical: "top",
    fontSize: 14,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnSend: {
    backgroundColor: theme.colors.accent,
  },
  actionBtnRecording: {
    backgroundColor: "#e53935",
  },
  actionBtnText: {
    fontSize: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
