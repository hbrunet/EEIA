import { NativeModules, Platform } from "react-native";

function getDevServerHost(): string | null {
  const scriptUrl = NativeModules.SourceCode?.scriptURL;
  if (typeof scriptUrl !== "string") return null;

  const match = scriptUrl.match(/^https?:\/\/([^/:]+)/i);
  return match?.[1] ?? null;
}

function getFallbackApiUrl(): string {
  const devServerHost = getDevServerHost();
  if (devServerHost) {
    return `http://${devServerHost}:3000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
}

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || getFallbackApiUrl(),
};
