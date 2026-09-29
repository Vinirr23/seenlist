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
         * REVERTIDO (a pedido, 2026-09-29) — Feed tinha sido
         * descontinuado da barra em 2026-08-22 (dado real do painel de
         * observabilidade: 20 follows entre 383 usuários, 3 posts em 7
         * dias, 0,0 posts/comentários por usuário ativo — era também a
         * maior fonte de bug do app) e depois religado como SUB-ABA
         * dentro de Explorar (2026-09-28, `explore.tsx`). Agora volta a
         * ser aba própria de novo, com ícone e posição dedicados no dock
         * (ver `ROUTE_ICON`/`ROUTE_LABEL_KEY`/`ABAS` em
         * `components/layout/DockNavegacao.tsx`) — a sub-aba dentro de
         * Explorar foi removida junto, pra não duplicar o mesmo destino
         * em dois lugares da navegação.
         */}
        <Tabs.Screen name="feed" options={{ title: t("nav.feed") }} />
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
