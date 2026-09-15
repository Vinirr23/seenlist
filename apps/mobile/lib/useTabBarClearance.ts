import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * CORREÇÃO (2026-09-04, porte do "Floating Glass Dock" — ver
 * `app/(tabs)/_layout.tsx`) — a barra deixou de ser uma caixa sólida
 * encostada no rodapé (`bottom: 0`, altura fixa 56px) e virou um dock
 * flutuante, com sua PRÓPRIA margem até a borda de baixo da tela
 * (`DOCK_FLOATING_GAP`, 12px, antes de somar a área segura). O espaço
 * total ocupado por baixo do conteúdo agora é maior: a margem
 * flutuante (12px) + a altura de verdade do dock (~60px: 10px de
 * padding vertical de cada lado + caixa do ícone 24px + 2px de gap +
 * ~14px da legenda). Sem atualizar este número, o último item de
 * lista voltaria a ficar parcialmente atrás do dock (o mesmo bug que
 * esta tela já resolvia antes).
 */
const DOCK_FLOATING_GAP = 12;
const DOCK_HEIGHT = 60;
const EXTRA_GAP = 16;

/**
 * TASK-176 (achado real, a pedido — "precisa de espaço", último item
 * de lista ficando atrás da barra) — o dock de navegação é
 * `position: absolute`, então não reserva espaço no layout normal da
 * tela sozinho. Toda tela com `ScrollView`/`FlatList` precisa somar
 * essa distância no `paddingBottom` do CONTEÚDO, ou o último item fica
 * escondido atrás dele — mesmo cálculo já usado pro botão de criar
 * post (`CreatePostButton.tsx`).
 *
 * A folga vai no conteúdo, NUNCA no contêiner da tela: no web o
 * conteúdo passa POR BAIXO da barra (ela é `fixed`, com `pb-32` no
 * `PageContainer` só pra o último item não sumir) — e é justamente
 * esse conteúdo passando atrás que dá o efeito de vidro. Cortar a área
 * de rolagem antes da barra deixaria ela sempre sobre fundo liso.
 *
 * VALE PRA TODAS AS TELAS agora (2026-09-09, decisão do usuário — "a
 * barra de navegação não está aparecendo em várias telas"): a barra
 * subiu de `app/(tabs)/_layout.tsx` pro layout raiz
 * (`app/_layout.tsx`), como no `(main)/layout.tsx` do web, então
 * também aparece nas telas empilhadas (detalhe de série/filme,
 * episódio, avaliações, configurações, perfil público...). Antes, só
 * as telas de aba precisavam desta folga.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return DOCK_FLOATING_GAP + DOCK_HEIGHT + EXTRA_GAP + insets.bottom;
}
