import { useEffect, useRef } from "react";
import { Animated, type DimensionValue } from "react-native";
import { colors, radius as themeRadius } from "@/lib/theme";

/**
 * TASK-150 (a pedido — trocar "Carregando..." + spinner por skeleton
 * "phantom") — bloco base, sem dependência nova (usa a própria
 * `Animated` do React Native, já disponível). Pulsa a opacidade entre
 * um tom e outro de cinza, num laço infinito, enquanto está montado.
 */
export function Skeleton({
  width,
  height,
  borderRadius = themeRadius.md,
  style,
}: {
  width: DimensionValue;
  height: DimensionValue;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.surface, opacity }, style]} />;
}
