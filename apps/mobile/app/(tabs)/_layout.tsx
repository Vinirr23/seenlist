import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A BARRA DE NAVEGAÇÃO SAIU DAQUI (2026-09-09, decisão do usuário —
 * "a barra de navegação não está aparecendo em várias telas").
 *
 * Ela morava neste arquivo, então só existia dentro de `(tabs)`. Mas
 * `series/[id]`, `movies/[id]`, `episodes/...`, `profile/...`,
 * `settings`, `lists`, `posts` e `u/...` são rotas de PRIMEIRO NÍVEL
 * da Stack raiz (ver `app/_layout.tsx`) — fora de `(tabs)` — e por
 * isso ficavam sem barra nenhuma.
 *
 * No web não é assim: `app/(main)/layout.tsx` renderiza a
 * `<BottomNavigation />` e esse layout envolve TODAS as telas de
 * produto, inclusive detalhe de série/filme, episódio, comentários e
 * perfil. Pra igualar, a barra subiu pro layout RAIZ
 * (`app/_layout.tsx`), junto com a `BlurTargetView` que ela desfoca —
 * as duas precisam andar juntas, porque o `BlurView` da barra tem que
 * ficar FORA do alvo que ele desfoca (o SIGSEGV documentado em
 * `components/ui/Glass.tsx`).
 *
 * O que sobrou aqui é só o navegador de abas em si. `tabBar={() =>
 * null}` continua porque quem desenha a barra é o dock lá de cima.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <View style={styles.raiz}>
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
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
         * entradas em ROUTE_ICON/ROUTE_LABEL_KEY do
         * `components/layout/DockNavegacao.tsx`.
         *
         * O social que FUNCIONA continua: avaliações com texto (1.324,
         * nota média 4,27), comentários de episódio, recomendar, seguir.
         */}
        <Tabs.Screen name="feed" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ title: t("nav.explore") }} />
        <Tabs.Screen name="profile" options={{ title: t("nav.profile") }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
  },
});
