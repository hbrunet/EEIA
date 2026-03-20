import { StatusBar } from "expo-status-bar";
import { AppProvider } from "./src/state/AppContext";
import { MainTabs } from "./src/navigation/MainTabs";

export default function App() {
  return (
    <AppProvider>
      <MainTabs />
      <StatusBar style="dark" />
    </AppProvider>
  );
}
