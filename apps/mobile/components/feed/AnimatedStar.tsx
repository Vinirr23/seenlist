import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const STAR_STAGGER_MS = 70;

/**
 * A PEDIDO (2026-10-01, documento de UX — "ao dar 5 estrelas: estrelas
 * entram rapidamente em sequência ★ ★ ★ ★ ★") — usado nas estrelas de
 * avaliação do Feed (`PostCard.tsx`, post tipo "review") e do Activity
 * Card (`ActivityCard.tsx`, atividade "avaliou"). Cada estrela é um
 * `Animated.View` próprio, com `index` controlando o atraso — a
 * sequência de 5 (`index` 0 a 4) entra em ~350ms no total (70ms × 4).
 * Mesma biblioteca `Animated` já usada em `FeedItemEnter`/`LikeButton`
 * (sem dependência nova).
 */
export function AnimatedStar({
  filled,
  size,
  color,
  emptyColor,
  index,
}: {
  filled: boolean;
  size: number;
  color: string;
  emptyColor: string;
  index: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      delay: index * STAR_STAGGER_MS,
      speed: 26,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara só na montagem, de propósito (mesmo padrão de `FeedItemEnter`).
  }, []);

  return (
    <Animated.View style={{ opacity: progress, transform: [{ scale: progress }] }}>
      <MaterialCommunityIcons name={filled ? "star" : "star-outline"} size={size} color={filled ? color : emptyColor} />
    </Animated.View>
  );
}
