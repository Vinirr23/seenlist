import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * A PEDIDO — "Feed mais vivo", item 4. Porta fiel do efeito CSS do
 * web (`.feed-item-enter` em `globals.css`) usando `Animated`
 * (núcleo do React Native, sem dependência nova). Dispara só na
 * MONTAGEM do componente — como cada post usa `key={post.id}`
 * (estável), o React só desmonta/remonta de verdade um post que
 * NUNCA existiu na lista antes; um post que já estava lá não
 * re-anima só porque uma curtida foi atualizada.
 */
export function FeedItemEnter({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
