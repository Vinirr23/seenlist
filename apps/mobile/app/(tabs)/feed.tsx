import { Screen } from "@/components/ui";
import { FeedTabContent } from "@/components/explore/FeedTabContent";

/**
 * A PEDIDO (2026-09-28, "quero religar a aba feed... vai ficar como uma
 * sub aba dentro de explorar") — esta rota (`/feed`) não recebeu link
 * nenhum de volta na barra de navegação (segue exatamente como estava:
 * `<Tabs.Screen name="feed" options={{ href: null }} />` em
 * `app/(tabs)/_layout.tsx`, sem entrada em `DockNavegacao.tsx`) — quem
 * usa o Feed agora é a 1ª sub-aba de "Explorar"
 * (`app/(tabs)/explore.tsx`).
 *
 * Todo o conteúdo (lista de posts, curtida, Realtime, botão de criar
 * post) foi extraído pra `components/explore/FeedTabContent.tsx`, que
 * este arquivo e `explore.tsx` compartilham — sem duplicar lógica. Esta
 * rota fica só como um fallback caso algo aponte pra `/feed` direto
 * (link antigo, deep link) — continua funcionando sozinha, com seu
 * próprio `<Screen>`.
 */
export default function FeedScreen() {
  return (
    <Screen padded={false}>
      <FeedTabContent />
    </Screen>
  );
}
