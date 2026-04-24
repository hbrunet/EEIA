import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { HomeScreen } from "../screens/HomeScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { ProgressScreen } from "../screens/ProgressScreen";
import { AccentsScreen } from "../screens/AccentsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { useAppState } from "../state/AppContext";
import { theme } from "../ui/theme";

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:     { active: "home",           inactive: "home-outline" },
  Chat:     { active: "chatbubble",     inactive: "chatbubble-outline" },
  Progress: { active: "bar-chart",      inactive: "bar-chart-outline" },
  Accents:  { active: "mic",            inactive: "mic-outline" },
  Profile:  { active: "person",         inactive: "person-outline" },
};

const TAB_LABELS: Record<string, string> = {
  Home:     "Inicio",
  Chat:     "Chat",
  Progress: "Progreso",
  Accents:  "Pronunciación",
  Profile:  "Perfil",
};

const BADGE_MILESTONES = [3, 7, 14, 30];

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToLocalKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeCurrentStreak(history: string[]): number {
  const keys = new Set(history || []);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = dateToLocalKey(cursor);
    if (!keys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function MainTabs() {
  const { progress } = useAppState();
  const previousHistoryCountRef = useRef(progress?.dailyGoalHistory?.length || 0);

  useEffect(() => {
    if (!progress) return;

    const currentCount = progress.dailyGoalHistory?.length || 0;
    const previousCount = previousHistoryCountRef.current;
    previousHistoryCountRef.current = currentCount;

    if (currentCount <= previousCount) return;

    const streak = computeCurrentStreak(progress.dailyGoalHistory || []);
    if (!BADGE_MILESTONES.includes(streak)) return;

    Alert.alert(
      "Nueva insignia desbloqueada",
      `Excelente constancia. Alcanzaste la insignia de ${streak} días seguidos.`,
      [{ text: "Genial" }],
    );
  }, [progress]);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: theme.colors.panel },
          headerTintColor: theme.colors.text,
          tabBarStyle: {
            backgroundColor: theme.colors.panel,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarLabel: TAB_LABELS[route.name] ?? route.name,
          tabBarIcon: ({ focused, color, size }) => {
            const icons = TAB_ICONS[route.name];
            const iconName = focused ? icons.active : icons.inactive;
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Inicio" }} />
        <Tab.Screen name="Chat" component={ChatScreen} options={{ title: "Chat con tutor" }} />
        <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: "Mi progreso" }} />
        <Tab.Screen name="Accents" component={AccentsScreen} options={{ title: "Entrenamiento" }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Tu perfil" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
