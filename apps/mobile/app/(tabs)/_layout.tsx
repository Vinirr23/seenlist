import { useEffect, useRef, useState } from "react";
import { View, Pressable, Text as RNText, Animated, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, motion } from "@/lib/theme";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const UNREAD_POLL_INTERVAL_MS = 30_000;

const ROUTE_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  series: "tv",
  movies: "film",
  explore: "compass",
  profile: "user",
};

const ROUTE_LABEL_KEY: Record<string, string> = {
  series: "nav.series",
  movies: "nav.movies",
  explore: "nav.explore",
  profile: "nav.profile",
};

/**
 * A PEDIDO — "sem mexer em tamanho nem proporção, adiciona a
 * animação de deslize". A pílula (contorno dourado) continua com
 * exatamente as mesmas medidas de antes — só passou a DESLIZAR de
 * uma aba pra outra em vez de aparecer/sumir na hora.
 *
 * Diferença deliberada da tentativa anterior (que causou vários
 * bugs de aparelho): largura FIXA (`PILL_WIDTH`), não mais medida a
 * partir do texto de cada rótulo. Só a POSIÇÃO anima (`translateX`,
 * em pixel de verdade via `onLayout` — a forma que já funcionava
 * antes de qualquer complicação) — nunca a largura. Como só
 * `transform` está animando (não `width`), a animação roda na
 * thread nativa (`useNativeDriver: true`), sem o custo/risco extra
 * de rodar em JS.
 *
 * Pra a cápsula deslizar de forma coerente, todas as 4 abas agora
 * mostram ícone+rótulo sempre (antes, só a ativa tinha rótulo) — a
 * cápsula precisa de algo estável pra deslizar por trás, e o rótulo
 * aparecendo/sumindo ao mesmo tempo que ela se move ficaria confuso.
 */
const PILL_WIDTH = 88;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetchUnreadRecommendationsCount().then((count) => {
        if (!cancelled) setUnreadCount(count);
      });
    }
    refresh();
    const interval = setInterval(refresh, UNREAD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const visibleRoutes = state.routes.filter((route) => ROUTE_ICON[route.name] && ROUTE_LABEL_KEY[route.name]);
  const activeVisibleIndex = visibleRoutes.findIndex((route) => route.key === state.routes[state.index]?.key);

  const pillAnim = useRef(new Animated.Value(Math.max(activeVisibleIndex, 0))).current;
  useEffect(() => {
    if (activeVisibleIndex < 0) return;
    Animated.timing(pillAnim, { toValue: activeVisibleIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeVisibleIndex, pillAnim]);

  const itemWidth = barWidth / (visibleRoutes.length || 1);
  const pillTranslate = pillAnim.interpolate({
    inputRange: visibleRoutes.map((_, i) => i),
    outputRange: visibleRoutes.map((_, i) => i * itemWidth + itemWidth / 2 - PILL_WIDTH / 2),
  });

  return (
    <View
      style={[styles.tabBar, { height: 56 + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {activeVisibleIndex >= 0 && barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.activePill, { width: PILL_WIDTH, transform: [{ translateX: pillTranslate }] }]}
        />
      )}
      {visibleRoutes.map((route) => {
        const icon = ROUTE_ICON[route.name]!;
        const labelKey = ROUTE_LABEL_KEY[route.name]!;
        const focused = route.key === state.routes[state.index]?.key;

        function handlePress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable key={route.key} onPress={handlePress} style={styles.tabItem}>
            <View style={styles.tabContent}>
              <Feather name={icon} color={focused ? colors.primary : colors.muted} size={20} />
              {route.name === "profile" && unreadCount > 0 && (
                <View style={styles.badge}>
                  <RNText style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</RNText>
                </View>
              )}
              <RNText style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {t(labelKey)}
              </RNText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="series" options={{ title: "Séries" }} />
      <Tabs.Screen name="movies" options={{ title: "Filmes" }} />
      {/*
       * DECISÃO DE PRODUTO (a pedido, com base em dado real do painel
       * de observabilidade) — aba Feed descontinuada. Os números: 20
       * follows entre 383 usuários, 3 posts em 7 dias,
       * posts/comentários por usuário ativo em 0,0. Sem grafo social,
       * o Feed é estruturalmente uma tela vazia — e era a maior fonte
       * de bug do app (crash em produção, Realtime quebrado).
       *
       * REVERSÍVEL: a rota (`app/(tabs)/feed.tsx`) e todo o código
       * continuam existindo — `href: null` só tira da barra. Voltar é
       * trocar por `options={{ title: "Feed" }}` e devolver as duas
       * entradas em ROUTE_ICON/ROUTE_LABEL_KEY acima.
       *
       * O social que FUNCIONA continua: avaliações com texto (1.324,
       * nota média 4,27), comentários de episódio, recomendar, seguir.
       */}
      <Tabs.Screen name="feed" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ title: "Explorar" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabContent: {
    alignItems: "center",
    gap: 2,
  },
  /**
   * Mesmas medidas exatas da opção "C" (contorno) já aprovada — só
   * deixou de ser renderizada condicionalmente por item e passou a
   * ser UM elemento flutuante só, atrás de todos, que se move.
   */
  activePill: {
    position: "absolute",
    top: 4,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 10,
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});
