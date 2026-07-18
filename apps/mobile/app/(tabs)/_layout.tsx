import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/theme";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";

const UNREAD_POLL_INTERVAL_MS = 30_000;

/**
 * TASK-090 — mesmas 5 abas e mesma ordem do web
 * (`apps/web/lib/navigation.ts`): Séries, Filmes, Feed, Explorar,
 * Perfil. Ícones via `@expo/vector-icons` (Feather) em vez de
 * `lucide-react-native` — evita adicionar mais uma dependência
 * nativa nova; `@expo/vector-icons` já vem dentro do pacote `expo`
 * (histórico da EAS: cota de build já estourou uma vez, então cada
 * dependência nova evitada é um risco a menos).
 *
 * Cada aba abre uma tela "Em construção" por enquanto — só a
 * fundação (navegação + design system + login) foi construída nesta
 * sessão. Telas de conteúdo entram uma por vez, nas próximas.
 *
 * TASK-169 — `tabBarBadge` (suporte nativo do Expo Router/React
 * Navigation, sem lib nova) mostra a contagem de recomendações não
 * lidas na aba Perfil, mesma ideia da bolinha do web
 * (`BottomNavigation.tsx`), só que aqui usa o número em vez de um
 * ponto (limitação/comportamento padrão do `tabBarBadge`). Busca de
 * novo a cada 30s enquanto o app está aberto — não é tempo real
 * (evita gastar conexão do Supabase Realtime só por isso, ver
 * discussão de custo antes de construir a feature), atualiza rápido
 * o bastante pra não parecer travado.
 */
export default function TabsLayout() {
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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="series"
        options={{ title: "Séries", tabBarIcon: ({ color, size }) => <Feather name="tv" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="movies"
        options={{ title: "Filmes", tabBarIcon: ({ color, size }) => <Feather name="film" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: "Feed", tabBarIcon: ({ color, size }) => <Feather name="rss" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explorar", tabBarIcon: ({ color, size }) => <Feather name="compass" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tabs>
  );
}
