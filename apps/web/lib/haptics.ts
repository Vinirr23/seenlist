/**
 * TASK-026, item 15 — "vibração leve". Web tem `navigator.vibrate()`,
 * mas com uma limitação real que não dá pra contornar: **Safari/iOS
 * nunca implementou essa API** (nem em PWA instalado) — só funciona
 * em navegadores baseados em Chromium no Android. Chamado como
 * progressive enhancement: quando existe, vibra; quando não, não
 * quebra nada, só não faz nada.
 */
export function hapticTick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}
