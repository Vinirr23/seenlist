import { useSafeAreaInsets } from "react-native-safe-area-context";

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
 * Ajuste (a pedido — barra virou fixa, borda a borda, em vez de
 * flutuante com margem) — removidos os 12px de margem que existiam
 * antes entre a barra e a borda da tela (não existem mais nesse
 * formato); a altura reservada agora é só a altura de conteúdo da
 * barra (56) + respiro (16) + a área segura de baixo (`insets.bottom`,
 * que a própria barra já absorve como padding interno agora).
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + EXTRA_GAP + insets.bottom;
}
