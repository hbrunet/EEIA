import { Pressable, Text, View } from "react-native";
import { styles } from "../ChatScreen.styles";

type Props = {
  onStart: () => void;
  disabled: boolean;
};

export function WelcomeCard({ onStart, disabled }: Props) {
  return (
    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeTitle}>¡Hola! Soy tu tutor de inglés</Text>
      <Text style={styles.welcomeText}>
        Voy a ayudarte a practicar de forma personalizada. Para empezar, solo saluda o tocá el botón de abajo.
      </Text>
      <Pressable
        style={[styles.welcomeStartBtn, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPress={onStart}
      >
        <Text style={styles.welcomeStartBtnText}>Saludar al tutor →</Text>
      </Pressable>
    </View>
  );
}
