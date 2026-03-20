const fallbackApiUrl = "http://localhost:3000";

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || fallbackApiUrl,
};
