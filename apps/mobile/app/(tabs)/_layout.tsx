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
/**
 * A PEDIDO — cápsula deslizante por trás da aba ativa, espelhando a
 * mesma ideia da web (`BottomNavigation.tsx`). Antes, o destaque era
 * uma pílula que só existia (ou não) na aba ativa — trocar de aba
 * fazia o rótulo "pipocar", sem nenhum movimento entre as posições.
 * Agora existe UMA cápsula só, que desliza da posição antiga pra
 * nova — e por isso o rótulo passou a ficar SEMPRE visível nas 4
 * abas (antes só aparecia na ativa): a cápsula precisa de algo fixo
 * pra deslizar por trás, senão o "salto" de layout (ícone sozinho →
 * ícone+texto) atrapalharia a animação.
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

  /*
   * `state.routes` inclui a aba "feed" escondida (ela continua
   * registrada em `<Tabs.Screen>`, só não aparece — `href: null` tira
   * da navegação visível, não da lista). Se a cápsula usasse o índice
   * CRU de `state`, ela deslizaria pra posição errada sempre que a
   * aba ativa estivesse depois do Feed na lista (Explorar/Perfil) —
   * por isso filtra ANTES de calcular qualquer posição.
   */
  const visibleRoutes = state.routes.filter((route) => ROUTE_ICON[route.name] && ROUTE_LABEL_KEY[route.name]);
  const activeVisibleIndex = visibleRoutes.findIndex((route) => route.key === state.routes[state.index]?.key);

  const capsuleAnim = useRef(new Animated.Value(activeVisibleIndex)).current;
  useEffect(() => {
    if (activeVisibleIndex < 0) return;
    Animated.timing(capsuleAnim, { toValue: activeVisibleIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeVisibleIndex, capsuleAnim]);

  const capsuleTranslate = capsuleAnim.interpolate({
    inputRange: visibleRoutes.map((_, i) => i),
    outputRange: visibleRoutes.map((_, i) => `${i * 100}%`),
  });

  return (
    <View style={[styles.tabBar, { height: 56 + insets.bottom, paddingBottom: insets.bottom }]}>
      {activeVisibleIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.capsule,
            {
              width: `${100 / visibleRoutes.length}%`,
              transform: [{ translateX: capsuleTranslate }],
            },
          ]}
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
            <View style={styles.iconWrapper}>
              <Feather name={icon} color={focused ? colors.primary : colors.muted} size={22} />
              {route.name === "profile" && unreadCount > 0 && (
                <View style={styles.badge}>
                  <RNText style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</RNText>
                </View>
              )}
            </View>
            <RNText style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {t(labelKey)}
            </RNText>
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
  capsule: {
    position: "absolute",
    top: 6,
    left: 0,
    bottom: 6,
    borderRadius: 14,
    backgroundColor: colors.primary + "26",
    borderWidth: 1,
    borderColor: colors.primary + "66",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
  },
  iconWrapper: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
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
