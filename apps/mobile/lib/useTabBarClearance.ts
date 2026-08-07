import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_MARGIN, TOP_PADDING } from "@/app/(tabs)/_layout";

const TAB_BAR_HEIGHT = 56;
const EXTRA_GAP = 16;

/**
 * TASK-176 (achado real, a pedido — "precisa de espaço", último item
 * de lista ficando atrás da barra) — a barra de navegação é
 * `position: absolute` (ver `app/(tabs)/_layout.tsx`), então não
 * reserva espaço no layout normal da tela sozinha. Toda tela com
 * `ScrollView`/`FlatList` dentro de uma aba precisa somar essa
 * distância no `paddingBottom` do conteúdo, ou o último item fica
 * escondido atrás dela — mesmo cálculo já usado pro botão de criar
 * post (`CreatePostButton.tsx`).
 *
 * CORREÇÃO (a pedido — barra ganhou respiro no topo e margem
 * intencional da borda de baixo, ver `_layout.tsx`) — `BOTTOM_MARGIN`
 * + `TOP_PADDING` somados aqui, importados do MESMO lugar que os
 * define, pra nunca ficar dessincronizado se aqueles valores mudarem
 * de novo no futuro.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + TOP_PADDING + BOTTOM_MARGIN + EXTRA_GAP + insets.bottom;
}
