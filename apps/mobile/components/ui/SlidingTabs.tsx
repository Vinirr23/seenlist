import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, StyleSheet } from "react-native";
import { Text } from "./Text";
import { colors, radius, spacing, motion } from "@/lib/theme";

const TRACK_PADDING = 4;

/**
 * A PEDIDO — trilha com cápsula deslizante, generalizada. Achado
 * real: existiam DUAS cópias praticamente idênticas desse padrão de
 * "dois botões soltos, sem animação" — `HomeTabs.tsx` (Minha
 * lista/Em breve) e um `TabButton` local dentro de `explore.tsx`
 * (Descobrir/Atividade). Corrigi a primeira e só depois vi a
 * segunda — extraído aqui pra próxima vez que esse padrão aparecer
 * (e apareceria de novo) ser reaproveitar, não copiar pela terceira
 * vez.
 *
 * Genérico o bastante pra qualquer lista de opções (não só duas),
 * mas o uso real do app hoje é sempre com 2.
 */
export function SlidingTabs<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = options.findIndex((o) => o.value === active);

  const capsuleAnim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    if (activeIndex < 0) return;
    Animated.timing(capsuleAnim, { toValue: activeIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeIndex, capsuleAnim]);

  const itemWidth = (trackWidth - TRACK_PADDING * 2) / (options.length || 1);
  const capsuleTranslate = capsuleAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * itemWidth),
  });

  return (
    <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      {trackWidth > 0 && activeIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.capsule, { width: itemWidth, transform: [{ translateX: capsuleTranslate }] }]}
        />
      )}
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={styles.tabItem}>
          <Text variant="label" style={active === option.value ? styles.labelActive : styles.label}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: TRACK_PADDING,
  },
  capsule: {
    position: "absolute",
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  tabItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: colors.muted,
  },
  labelActive: {
    color: colors.background,
    fontWeight: "700",
  },
});
