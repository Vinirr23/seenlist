import { useEffect, useState } from "react";
import { View, Pressable, Text as RNText, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/theme";
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
 * REVERTIDO POR COMPLETO, DE VEZ (a pedido — "o deslize bugou,
 * reverta") — bug real, reportado com 3 prints: o contorno aparecia
 * deslocado da aba realmente ativa (ex.: "Séries" em destaque, mas o
 * contorno desenhado em volta de "Explorar"). Depois de duas
 * tentativas de cápsula deslizante (uma com largura medida do
 * conteúdo, outra com largura fixa) apresentando bugs de
 * posicionamento diferentes no mesmo aparelho, a decisão foi
 * abandonar animação de deslize NESTE componente em definitivo — não
 * tentar de novo sem pedido explícito.
 *
 * Este é o padrão SIMPLES e estável: contorno dourado desenhado
 * DIRETO em cada item (não um elemento flutuante separado tentando
 * se posicionar por cima) — sem `onLayout`, sem `Animated`, sem
 * cálculo de posição nenhum. Cada aba sabe pintar a si mesma; não
 * tem como isso ficar "na aba errada".
 */
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
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

  return (
    <View style={[styles.tabBar, { height: 56 + insets.bottom, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const icon = ROUTE_ICON[route.name];
        const labelKey = ROUTE_LABEL_KEY[route.name];
        if (!icon || !labelKey) return null;
        const focused = state.index === index;

        function handlePress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable key={route.key} onPress={handlePress} style={styles.tabItem}>
            {focused ? (
              <View style={styles.activePill}>
                <Feather name={icon} color={colors.primary} size={20} />
                <RNText style={styles.activePillLabel} numberOfLines={1}>
                  {t(labelKey)}
                </RNText>
              </View>
            ) : (
              <View style={styles.iconWrapper}>
                <Feather name={icon} color={colors.muted} size={20} />
                {route.name === "profile" && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <RNText style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</RNText>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="series" options={{ title: t("nav.series") }} />
      <Tabs.Screen name="movies" options={{ title: t("nav.movies") }} />
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
      <Tabs.Screen name="explore" options={{ title: t("nav.explore") }} />
      <Tabs.Screen name="profile" options={{ title: t("nav.profile") }} />
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
  iconWrapper: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  activePillLabel: {
    color: colors.primary,
    fontSize: 10,
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
