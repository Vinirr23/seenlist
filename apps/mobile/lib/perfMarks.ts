/**
 * TEMPORÁRIO — feito pra uma rodada específica de medição real em
 * aparelho (auditoria de performance), não é uma feature permanente.
 * Depois de coletar os números, dá pra remover isso e as chamadas de
 * `mark(...)` sem afetar nada — não guarda dado nenhum, não manda
 * pra lugar nenhum, só registra no log nativo do Android (visível
 * via `adb logcat`, funciona mesmo sem o Metro conectado).
 *
 * Cada marca registra quanto tempo passou desde que o módulo raiz do
 * app carregou (`APP_START`, capturado no topo deste arquivo — o
 * mais cedo que dá pra capturar em JS puro, sem tocar em código
 * nativo).
 */
const APP_START = Date.now();

export function mark(label: string) {
  const elapsed = Date.now() - APP_START;
  // eslint-disable-next-line no-console
  console.log(`[PERF] ${label}: ${elapsed}ms desde o início do app`);
}
