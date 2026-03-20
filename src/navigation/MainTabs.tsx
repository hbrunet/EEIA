import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { LessonsScreen } from "../screens/LessonsScreen";
import { ProgressScreen } from "../screens/ProgressScreen";
import { AccentsScreen } from "../screens/AccentsScreen";
import { PlannerScreen } from "../screens/PlannerScreen";
import { theme } from "../ui/theme";

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.panel },
          headerTintColor: theme.colors.text,
          tabBarStyle: {
            backgroundColor: theme.colors.panel,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.muted,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Chat" component={ChatScreen} />
        <Tab.Screen name="Lessons" component={LessonsScreen} />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Accents" component={AccentsScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
