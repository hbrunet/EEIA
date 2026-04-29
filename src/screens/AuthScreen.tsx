import { Text, View } from "react-native";
import { styles } from "./AuthScreen.styles";

export function AuthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Placeholder</Text>
      <Text style={styles.text}>Connect your preferred sign-in provider in the next iteration.</Text>
    </View>
  );
}
