import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_MARGIN = 12;
const TAB_BAR_HEIGHT = 56;
const EXTRA_GAP = 16;

/**
 * TASK-176 (achado real, a pedido — "precisa de espaço", último item
 * de lista ficando atrás da barra) — a barra de navegação virou
 * flutuante (`position: absolute`, ver `app/(tabs)/_layout.tsx`),
 * então parou de reservar espaço no layout normal da tela sozinha.
 * Toda tela com `ScrollView`/`FlatList` dentro de uma aba precisa
 * somar essa distância no `paddingBottom` do conteúdo, ou o último
 * item fica escondido atrás dela — mesmo cálculo já usado pro botão
 * de criar post (`CreatePostButton.tsx`).
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_MARGIN + TAB_BAR_HEIGHT + EXTRA_GAP + insets.bottom;
}
