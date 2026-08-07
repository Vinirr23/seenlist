/**
 * CORREÇÃO (bug real, reportado com foto — barra de navegação e
 * folha de "novo post" esticando demais num aparelho Android com
 * navegação de 3 botões, em vez de gestos). Nessa configuração,
 * `useSafeAreaInsets().bottom` pode reportar um valor errado/inflado
 * — problema conhecido da biblioteca com esse tipo específico de
 * navegação, não um cálculo nosso.
 *
 * `34` é o teto: a maior área segura de baixo já vista de verdade em
 * aparelho normal (a barra de gestos do iPhone, por exemplo). Em
 * qualquer aparelho comum isso nunca é atingido — só protege contra
 * essa leitura específica errada.
 *
 * Usado nos 3 lugares que precisam de `insets.bottom` pra calcular
 * espaço reservado: a barra de navegação em si
 * (`app/(tabs)/_layout.tsx`), o espaço que toda tela com lista
 * reserva pra não esconder o último item atrás dela
 * (`useTabBarClearance.ts`), e a folha de criar post
 * (`CreatePostButton.tsx`).
 */
export function safeBottomInset(rawInset: number): number {
  return Math.min(rawInset, 34);
}
