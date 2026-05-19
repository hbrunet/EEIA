const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "EEIA (Dev)" : "EEIA",
    slug: "eeia",
    version: "1.0.0",
    orientation: "portrait",
    updates: {
      url: "https://u.expo.dev/4c3f84d7-27a0-439f-84a4-7b00cd4f54aa",
      enabled: true,
      checkAutomatically: "ON_LOAD",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    icon: IS_DEV ? "./assets/icon.png" : "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: IS_DEV ? "#FF6B00" : "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: IS_DEV ? "com.hbrunet.eeia.dev" : "com.hbrunet.eeia",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "4c3f84d7-27a0-439f-84a4-7b00cd4f54aa",
      },
    },
    owner: "hbrunet",
  },
};
