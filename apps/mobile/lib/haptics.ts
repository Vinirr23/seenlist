import * as Haptics from "expo-haptics";

/**
 * Equivalente nativo do `hapticTick()` do web — lá usávamos
 * `navigator.vibrate()` (só funciona no Chrome Android, Safari/iOS
 * nunca implementou a API); aqui temos `expo-haptics` de verdade,
 * que fala com o Taptic Engine no iOS e o motor de vibração
 * padrão do Android — feedback de qualidade de verdade, não só
 * "vibra ou não vibra".
 *
 * Cada função engole o próprio erro sozinha (mesmo espírito do
 * `hapticTick()` do web: "se não existe, não quebra nada") — em
 * Android mais antigo ou emulador sem suporte, `expo-haptics` pode
 * rejeitar a Promise; isso nunca deve interromper a ação que a
 * pessoa estava fazendo (curtir, marcar episódio, etc.).
 */

/** Toque leve — a mesma "confirmação neutra" que `hapticTick()` do web faz. Usado em: curtir, marcar episódio, favoritar, votar em enquete, seguir, alternar interruptor. */
export function hapticTick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Toque médio — ações mais "decisivas" que um toque leve, mas que
 * ainda não são destrutivas. Usado em: enviar comentário (episódio
 * e post) — conteúdo publicado, visível pros outros, então pesa mais
 * que curtir ou marcar episódio.
 */
export function hapticImpact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/**
 * Feedback de sucesso — ação que terminou bem e vale comemorar um
 * pouco mais que um toque comum. Usado em: publicar post/enquete,
 * enviar recomendação, e terminar uma série (junto com o confete —
 * sem isso, a comemoração era só visual).
 */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Feedback de erro/aviso — falha de validação ou ação destrutiva (apagar, remover, bloquear). Distinto dos outros de propósito — a pessoa deve SENTIR que essa ação é diferente das outras. */
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/**
 * Seleção — o toque mais sutil de todos, pensado pra navegação
 * rápida e repetitiva (trocar de aba, deslizar entre opções). No
 * Android, `selectionAsync` não tem um equivalente de verdade tão
 * distinto quanto no iOS — o próprio `expo-haptics` já lida com
 * isso, escolhendo o motor certo por plataforma sozinho.
 */
export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}
