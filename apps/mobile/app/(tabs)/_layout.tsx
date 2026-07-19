import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, radius } from "@/lib/theme";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";

const UNREAD_POLL_INTERVAL_MS = 30_000;
const TAB_BAR_MARGIN = 12;

/**
 * TASK-090 — mesmas 5 abas e mesma ordem do web
 * (`apps/web/lib/navigation.ts`): Séries, Filmes, Feed, Explorar,
 * Perfil. Ícones via `@expo/vector-icons` (Feather) em vez de
 * `lucide-react-native` — evita adicionar mais uma dependência
 * nativa nova; `@expo/vector-icons` já vem dentro do pacote `expo`
 * (histórico da EAS: cota de build já estourou uma vez, então cada
 * dependência nova evitada é um risco a menos).
 *
 * TASK-169 — `tabBarBadge` (suporte nativo do Expo Router/React
 * Navigation, sem lib nova) mostra a contagem de recomendações não
 * lidas na aba Perfil. Busca de novo a cada 30s enquanto o app está
 * aberto — não é tempo real (evita gastar conexão do Supabase
 * Realtime só por isso, ver discussão de custo antes de construir a
 * feature), atualiza rápido o bastante pra não parecer travado.
 *
 * Redesign (a pedido, mesmo visual do web) — barra flutuante
 * (`position: absolute`, margem das bordas, cantos arredondados,
 * sombra) em vez de colada na tela inteira; ícone ativo ganha um
 * selo circular dourado atrás dele (`renderTabIcon`), em vez de só
 * trocar de cor.
 */
function renderTabIcon(name: keyof typeof Feather.glyphMap) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Feather name={name} color={color} size={20} />
    </View>
  );
}

export default function TabsLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowLabel: true,
        // TASK-176 (achado real, a pedido — "a barra ficou por trás
        // da barra do celular") — a margem de baixo era um valor
        // fixo (12px), sem levar em conta a área reservada pela
        // navegação do próprio sistema (gestos ou botões, que varia
        // de aparelho pra aparelho). Soma `insets.bottom` (a mesma
        // área seguraque o resto do app já usa, via `Screen.tsx`) —
        // em celular sem barra de sistema visível, `insets.bottom`
        // já vem 0, então não muda nada; onde tem, agora sobe o
        // suficiente pra nunca ficar por trás.
        tabBarStyle: [styles.tabBar, { bottom: TAB_BAR_MARGIN + insets.bottom }],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen name="series" options={{ title: "Séries", tabBarIcon: renderTabIcon("tv") }} />
      <Tabs.Screen name="movies" options={{ title: "Filmes", tabBarIcon: renderTabIcon("film") }} />
      <Tabs.Screen name="feed" options={{ title: "Feed", tabBarIcon: renderTabIcon("rss") }} />
      <Tabs.Screen name="explore" options={{ title: "Explorar", tabBarIcon: renderTabIcon("compass") }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: renderTabIcon("user"),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 64,
    borderRadius: radius.lg,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  tabBarItem: {
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 10,
  },
  iconWrapper: {
    height: 34,
    width: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperActive: {
    backgroundColor: "rgba(232,163,61,0.15)",
  },
});
