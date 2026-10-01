import { useEffect, useMemo, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

const PARTICLE_COUNT = 6;
const DURATION_MS = 420;
const RADIUS = 20;

interface ParticleConfig {
  id: number;
  angle: number;
  size: number;
}

/**
 * A PEDIDO (2026-10-01, documento de UX — "ao curtir: ❤️ faz scale 1 →
 * 1.25 → 1 + partículas mínimas") — a parte do "scale" já existia
 * (`LikeButton.tsx`, "coração de curtir com pop"); isto é só a parte
 * das partículas que faltava. BEM menor que `ConfettiBurst.tsx` (tela
 * cheia, 30 partículas, ~2.6s, usado ao TERMINAR uma série) — aqui são
 * só 6 pontinhos saindo do centro do coração num raio pequeno (20px),
 * ~420ms, próprios pra um like, não pra uma celebração grande. Mesmo
 * padrão `Animated` sem dependência nova; se desmonta sozinho via
 * `onDone`, mesmo princípio do `ConfettiBurst`.
 */
export function LikeBurst({ onDone }: { onDone: () => void }) {
  const particles = useMemo<ParticleConfig[]>(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({ id: i, angle: (360 / PARTICLE_COUNT) * i, size: 3 + Math.random() * 2 })),
    []
  );

  useEffect(() => {
    const timer = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} config={p} />
      ))}
    </View>
  );
}

function Particle({ config }: { config: ParticleConfig }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: true }).start();
  }, [progress]);

  const rad = (config.angle * Math.PI) / 180;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * RADIUS] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * RADIUS] });
  const opacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: config.size, height: config.size, opacity, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
  },
  particle: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: colors.like,
  },
});
