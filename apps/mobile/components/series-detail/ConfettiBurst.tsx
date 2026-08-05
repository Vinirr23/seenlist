import { useEffect, useMemo, useRef, useState } from "react";
import { View, Animated, Dimensions, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

/**
 * CORREÇÃO (a pedido — auditoria visual, "não parece produto de
 * nível premium") — achado real: a lista de cores do confete usava
 * 3 tons genéricos do Tailwind (`#22c55e`, `#a855f7`, `#3b82f6` —
 * verde/roxo/azul aleatórios, nunca usados em NENHUM outro lugar do
 * app) misturados com as 3 cores de verdade da marca. Um dos
 * momentos mais especiais do app (terminar uma série) usava cor que
 * não é do SeenList — trocado por uma paleta só com tons que já
 * existem no `theme.ts` (inclui `success`, que já existe e nunca
 * tinha sido usado aqui).
 */
const COLORS = [colors.primary, colors.secondary, colors.success, colors.text, colors.warning, "#7EE0D6"];
const PARTICLE_COUNT = 30;
const DURATION_MS = 2600;

interface ParticleConfig {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
}

/**
 * TASK-170 — porta de `ConfettiBurst.tsx` do web, sem lib nova (a
 * pedido) — `Animated` já vem com o React Native, nenhuma
 * dependência nativa adicional, então isto NÃO exige build novo. Se
 * desmonta sozinho depois da duração.
 */
export function ConfettiBurst({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  const { height: screenHeight } = Dimensions.get("window");

  const particles = useMemo<ParticleConfig[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length] as string,
        delay: Math.random() * 300,
        duration: 1800 + Math.random() * 800,
        size: 6 + Math.random() * 6,
      })),
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} config={p} screenHeight={screenHeight} />
      ))}
    </View>
  );
}

function ConfettiParticle({ config, screenHeight }: { config: ParticleConfig; screenHeight: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: config.duration,
      delay: config.delay,
      useNativeDriver: true,
    }).start();
  }, [progress, config.duration, config.delay]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, screenHeight + 40],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "720deg"],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.9, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${config.left}%`,
          width: config.size,
          height: config.size * 0.4,
          backgroundColor: config.color,
          opacity,
          transform: [{ translateY }, { rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
  },
  particle: {
    position: "absolute",
    top: 0,
    borderRadius: 2,
  },
});
