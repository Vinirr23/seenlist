import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, motion } from "@/lib/theme";

export type HomeTab = "minha-lista" | "em-breve";

const ORDER: HomeTab[] = ["minha-lista", "em-breve"];
const TRACK_PADDING = 4;

/**
 * A PEDIDO — trilha única com cápsula deslizante, mesmo padrão da
 * barra de navegação principal (`app/(tabs)/_layout.tsx`) — escolhido
 * de propósito pela consistência: quem aprende o gesto "cápsula que
 * desliza" ali reconhece na hora aqui também, em vez de dois
 * comportamentos diferentes convivendo no mesmo app.
 *
 * Antes eram dois botões SEPARADOS (com `gap` entre eles) — cada um
 * ganhando/perdendo o preenchimento dourado na hora, sem nenhum
 * movimento entre os dois. Agora é uma trilha só, com UMA cápsula
 * que desliza da posição antiga pra nova.
 *
 * Medição em PIXEL de verdade (`onLayout` + `translateX` numérico),
 * não porcentagem — lição direta do bug real da barra de navegação
 * (o `transform` do React Native não é confiável com string de
 * porcentagem, só com número).
 */
export function HomeTabs({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = ORDER.indexOf(active);

  const capsuleAnim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.timing(capsuleAnim, { toValue: activeIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeIndex, capsuleAnim]);

  const itemWidth = (trackWidth - TRACK_PADDING * 2) / ORDER.length;
  const capsuleTranslate = capsuleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, itemWidth],
  });

  const labels: Record<HomeTab, string> = {
    "minha-lista": t("seriesHome.tab.myList"),
    "em-breve": t("seriesHome.tab.upcoming"),
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        {trackWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.capsule, { width: itemWidth, transform: [{ translateX: capsuleTranslate }] }]}
          />
        )}
        {ORDER.map((tab) => (
          <Pressable key={tab} onPress={() => onChange(tab)} style={styles.tabItem}>
            <Text variant="label" style={active === tab ? styles.labelActive : styles.label}>
              {labels[tab]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
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
