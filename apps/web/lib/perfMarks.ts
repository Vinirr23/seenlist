/**
 * TEMPORÁRIO — mesma rodada de auditoria de performance do mobile
 * (ver `apps/mobile/lib/perfMarks.ts`), agora no web, já que a
 * maioria de quem usa o SeenList está no site, não no app. Não guarda
 * dado nenhum, não manda pra lugar nenhum — só loga no console do
 * navegador (F12 → Console, funciona em qualquer aparelho/navegador
 * real). Depois de coletar os números, dá pra remover isto e as
 * chamadas de `mark(...)` sem afetar nada.
 *
 * `performance.now()` em vez de `Date.now() - início manual` (como o
 * mobile precisa fazer): no navegador, `performance.now()` já é
 * relativo ao início da navegação da página (`performance.timeOrigin`)
 * — não precisa capturar um "APP_START" à mão.
 *
 * Guard de `typeof window` — este projeto é Next.js (App Router):
 * componentes "use client" ainda RENDERIZAM uma vez no servidor antes
 * de hidratar no navegador. Sem o guard, a marca de render rodaria
 * também no servidor (iria pro log do `next dev`/deploy, não pro
 * console do navegador, e mediria tempo do processo Node, não da
 * pessoa usando o site) — confuso e inútil pra essa medição.
 */
export function mark(label: string) {
  if (typeof window === "undefined" || typeof performance === "undefined") return;
  const elapsed = Math.round(performance.now());
  // eslint-disable-next-line no-console
  console.log(`[PERF] ${label}: ${elapsed}ms desde o início da navegação`);
}
