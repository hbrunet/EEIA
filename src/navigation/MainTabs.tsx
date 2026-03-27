import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { HomeScreen } from "../screens/HomeScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { LessonsScreen } from "../screens/LessonsScreen";
import { ProgressScreen } from "../screens/ProgressScreen";
import { AccentsScreen } from "../screens/AccentsScreen";
import { PlannerScreen } from "../screens/PlannerScreen";
import { theme } from "../ui/theme";

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:     { active: "home",           inactive: "home-outline" },
  Chat:     { active: "chatbubble",     inactive: "chatbubble-outline" },
  Lessons:  { active: "book",           inactive: "book-outline" },
  Progress: { active: "bar-chart",      inactive: "bar-chart-outline" },
  Accents:  { active: "mic",            inactive: "mic-outline" },
  Planner:  { active: "calendar",       inactive: "calendar-outline" },
};

const TAB_LABELS: Record<string, string> = {
  Home:     "Inicio",
  Chat:     "Chat",
  Lessons:  "Lecciones",
  Progress: "Progreso",
  Accents:  "Acentos",
  Planner:  "Planner",
};

export function MainTabs() {
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
        <Tab.Screen name="Lessons" component={LessonsScreen} options={{ title: "Lecciones" }} />
        <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: "Mi progreso" }} />
        <Tab.Screen name="Accents" component={AccentsScreen} options={{ title: "Laboratorio de acentos" }} />
        <Tab.Screen name="Planner" component={PlannerScreen} options={{ title: "Planificador" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
