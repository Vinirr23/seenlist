import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

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
 */
export default function TabsLayout() {
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
        options={{ title: "Perfil", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
