import { useEffect, useState } from "react";
import { View, Pressable, Text as RNText, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/theme";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";

const UNREAD_POLL_INTERVAL_MS = 30_000;

const ROUTE_META: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; title: string }> = {
  series: { icon: "tv", label: "Séries", title: "Séries" },
  movies: { icon: "film", label: "Filmes", title: "Filmes" },
  feed: { icon: "rss", label: "Feed", title: "Feed" },
  explore: { icon: "compass", label: "Explorar", title: "Explorar" },
  profile: { icon: "user", label: "Perfil", title: "Perfil" },
};

/**
 * TASK-090 — mesmas 5 abas e mesma ordem do web
 * (`apps/web/lib/navigation.ts`): Séries, Filmes, Feed, Explorar,
 * Perfil. Ícones via `@expo/vector-icons` (Feather) em vez de
 * `lucide-react-native` — evita adicionar mais uma dependência
 * nativa nova; `@expo/vector-icons` já vem dentro do pacote `expo`
 * (histórico da EAS: cota de build já estourou uma vez, então cada
 * dependência nova evitada é um risco a menos).
 *
 * TASK-169 — badge de recomendações não lidas, redesenhado à mão
 * (ver abaixo) — busca de novo a cada 30s enquanto o app está
 * aberto — não é tempo real (evita gastar conexão do Supabase
 * Realtime só por isso), atualiza rápido o bastante pra não parecer
 * travado.
 *
 * Redesign (a pedido, 3ª rodada — achado real: mesmo desenhando o
 * conteúdo dentro de `tabBarIcon`, o React Navigation reserva um
 * ESPAÇO FIXO pro slot de ícone, pensado pra conteúdo de largura
 * constante — a pílula (mais larga que um ícone sozinho, só quando
 * ativa) ficava cortada por esse limite, em vez de simplesmente
 * ocupar mais espaço) — a solução de verdade é parar de usar
 * `tabBarIcon`/`tabBarLabel` (o sistema padrão) e desenhar a barra
 * inteira à mão, via prop `tabBar` — controle total, sem nenhum
 * limite escondido de tamanho.
 *
 * Ajuste (a pedido) — a barra deixou de ser flutuante (cantos
 * arredondados, margem de 16 dos dois lados, sombra) e virou FIXA:
 * borda a borda, encostada no fundo de verdade (`left/right/bottom:
 * 0`), fundo sólido (não mais semi-transparente) e uma borda
 * superior fina em vez de sombra. `useTabBarClearance()` (o cálculo
 * de espaço reservado que TODA tela com lista usa, pra não ficar
 * escondendo o último item atrás da barra) foi atualizado junto —
 * não tinha mais os 12px de margem que existiam antes.
 */
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

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
        const meta = ROUTE_META[route.name];
        if (!meta) return null;
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
                <Feather name={meta.icon} color={colors.background} size={15} />
                <RNText style={styles.activePillLabel} numberOfLines={1}>
                  {meta.label}
                </RNText>
              </View>
            ) : (
              <View style={styles.iconWrapper}>
                <Feather name={meta.icon} color={colors.muted} size={20} />
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
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="series" options={{ title: "Séries" }} />
      <Tabs.Screen name="movies" options={{ title: "Filmes" }} />
      <Tabs.Screen name="feed" options={{ title: "Feed" }} />
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
    gap: 1,
    height: 44,
    minWidth: 52,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  activePillLabel: {
    color: colors.background,
    fontSize: 10,
    fontWeight: "700",
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
