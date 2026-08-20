import { createClient } from "@/lib/supabase/client";

/**
 * TEMPORÁRIO — mesma rodada de auditoria de performance do mobile
 * (ver `apps/mobile/lib/perfMarks.ts`), agora no web, já que a
 * maioria de quem usa o SeenList está no site, não no app. Depois de
 * coletar os números, dá pra remover isto (e a tabela
 * `perf_measurements`, migration `20260904000000`) sem afetar nada.
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
 *
 * ATUALIZADO — a pedido: medir em CELULAR DE VERDADE não dá pra fazer
 * só com `console.log`, porque não tem DevTools fácil no navegador do
 * celular (diferente do computador, onde dá pra abrir F12). Por isso
 * cada marca/métrica agora TAMBÉM é gravada em `perf_measurements`
 * (Supabase) — a pessoa só precisa abrir o site normal no celular
 * dela, sem fazer nada especial, e o número fica disponível pra
 * consulta via SQL depois. `console.log` continua também, útil pra
 * quem tiver como conectar o DevTools remoto.
 */
function record(metric: string, value: number, rating?: string) {
  if (typeof window === "undefined") return;
  try {
    const supabase = createClient();
    supabase
      .from("perf_measurements")
      .insert({
        metric,
        value,
        rating: rating ?? null,
        page: window.location.pathname,
        user_agent: navigator.userAgent,
      })
      .then(({ error }) => {
        if (error) console.warn("[PERF] falha ao registrar medição no banco", error.message);
      });
  } catch (error) {
    console.warn("[PERF] falha ao registrar medição no banco", error);
  }
}

export function mark(label: string) {
  if (typeof window === "undefined" || typeof performance === "undefined") return;
  const elapsed = Math.round(performance.now());
  // eslint-disable-next-line no-console
  console.log(`[PERF] ${label}: ${elapsed}ms desde o início da navegação`);
  record(label, elapsed);
}

/** Usado por `WebVitalsReporter.tsx` — mesma tabela, métricas do navegador em vez de marca customizada. */
export function recordWebVital(name: string, value: number, rating: string) {
  // eslint-disable-next-line no-console
  console.log(`[PERF] ${name}: ${Math.round(value)} (${rating})`);
  record(name, Math.round(value), rating);
}
