import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { styles } from "../ChatScreen.styles";

export function TypingIndicator() {
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function makePulse(dot: Animated.Value, offset: number): Animated.CompositeAnimation {
      const startDelay = offset > 0 ? [Animated.delay(offset)] : [];
      const endDelay = 600 - offset > 0 ? [Animated.delay(600 - offset)] : [];
      return Animated.loop(
        Animated.sequence([
          ...startDelay,
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ...endDelay,
        ]),
      );
    }

    const anims = [makePulse(dot0, 0), makePulse(dot1, 200), makePulse(dot2, 400)];
    anims.forEach((a) => a.start());
    return () => {
      anims.forEach((a) => a.stop());
      dot0.setValue(0.3);
      dot1.setValue(0.3);
      dot2.setValue(0.3);
    };
  }, [dot0, dot1, dot2]);

  return (
    <View
      style={[
        styles.bubble,
        styles.assistantBubble,
        styles.typingBubble,
        { flexDirection: "row", gap: 6, alignItems: "center" },
      ]}
    >
      {[dot0, dot1, dot2].map((dot, i) => (
        <Animated.Text key={i} style={[styles.typingDots, { opacity: dot }]}>
          ●
        </Animated.Text>
      ))}
    </View>
  );
}
