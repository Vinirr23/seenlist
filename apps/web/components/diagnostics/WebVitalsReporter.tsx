"use client";

import { useCallback, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { recordWebVital } from "@/lib/perfMarks";

/**
 * TEMPORÁRIO — ver `lib/perfMarks.ts` pro contexto completo da
 * auditoria. `useReportWebVitals` é um hook JÁ EMBUTIDO no Next.js
 * (não precisa instalar pacote novo) que reporta os "Core Web
 * Vitals" — as métricas que o próprio Google usa pra julgar
 * velocidade percebida de um site de verdade:
 *
 * - LCP (Largest Contentful Paint): quando o maior elemento visível
 *   da tela apareceu — "a página parece pronta" pra quem está vendo.
 * - INP (Interaction to Next Paint): quanto tempo entre a pessoa
 *   tocar/clicar em algo e a tela responder.
 * - CLS (Cumulative Layout Shift): o quanto a tela "pula" enquanto
 *   carrega (imagem sem tamanho reservado, fonte trocando, etc.).
 * - TTFB (Time to First Byte): quanto tempo até o SERVIDOR começar a
 *   responder — separa "problema de servidor/rede" de "problema no
 *   navegador".
 * - FCP (First Contentful Paint): primeira coisa visível na tela.
 *
 * Mais confiável que só marca manual (`mark(...)`) pra "está
 * pronto?", porque não depende de qual componente a gente lembrou de
 * instrumentar — o navegador mede sozinho, pra qualquer página.
 *
 * Montado uma vez em `app/providers.tsx`, então cobre o site inteiro,
 * não só a Biblioteca.
 *
 * `recordWebVital` (ver `lib/perfMarks.ts`) faz o console.log E grava
 * em `perf_measurements` — necessário pra medir em celular de
 * verdade, onde não tem DevTools fácil pra ver o console.
 *
 * `initialPage` capturado UMA VEZ (primeira renderização no
 * navegador) — ver o comentário grande em `recordWebVital` pro porquê:
 * sem isso, cada navegação por dentro do app (App Router, sem recarga
 * real) reatribuía o mesmo LCP/FCP/TTFB da primeira carga pra
 * qualquer página onde a pessoa estivesse no momento.
 *
 * CORREÇÃO (bug real, achado com dado de teste real em celular, causa
 * raiz confirmada lendo o código-fonte do próprio Next.js —
 * `packages/next/src/client/web-vitals.ts`) — valores IDÊNTICOS
 * (ex.: LCP sempre exatamente 9952ms) apareciam repetidos várias
 * vezes ao longo do teste, mesmo depois de corrigir a página. Causa:
 * `useReportWebVitals` do Next.js é só isto por dentro —
 *
 *   useEffect(() => {
 *     onCLS(reportWebVitalsFn); onFID(reportWebVitalsFn);
 *     onLCP(reportWebVitalsFn); onINP(reportWebVitalsFn);
 *     onFCP(reportWebVitalsFn); onTTFB(reportWebVitalsFn);
 *   }, [reportWebVitalsFn])
 *
 * — SEM nenhuma trava pra evitar reinscrição, e com `reportWebVitalsFn`
 * na lista de dependências. Antes, essa função era criada DIRETO no
 * corpo de `WebVitalsReporter` (`(metric) => { ... }`), ou seja, uma
 * referência NOVA a cada re-renderização. Como `WebVitalsReporter`
 * mora em `providers.tsx` (envolve o app inteiro), QUALQUER
 * re-renderização da árvore — cada navegação por dentro do app, cada
 * mudança de estado que borbulha por um Provider — trocava essa
 * referência, o que reexecutava o `useEffect` do Next e chamava
 * `onLCP`/`onFCP`/`onTTFB`/etc. de novo. Essas funções da biblioteca
 * `web-vitals` usam `buffered: true` por dentro — ou seja, ao
 * reinscrever, elas IMEDIATAMENTE reportam de novo o valor já
 * calculado (LCP/FCP/TTFB já tinham terminado logo após a carga real
 * da página), gerando uma linha nova em `perf_measurements` com o
 * MESMO número, a cada navegação — não 13 medições de verdade, e sim
 * o mesmo resultado reportado 13 vezes.
 *
 * Fix: `useCallback` com deps `[]` deixa `reportWebVitalsFn`
 * referencialmente ESTÁVEL entre renderizações — o `useEffect` do
 * Next.js só roda (e só assina os observers) UMA VEZ por carga real
 * de página, exatamente como devia. `initialPage.current` continua
 * lido normalmente de dentro do callback memoizado (é uma ref, valor
 * mutável lido no momento da chamada, não "congelado" na criação).
 */
export function WebVitalsReporter() {
  const initialPage = useRef<string | null>(null);
  if (typeof window !== "undefined" && initialPage.current === null) {
    initialPage.current = window.location.pathname;
  }

  const handleWebVital = useCallback((metric: { name: string; value: number; rating: string }) => {
    recordWebVital(metric.name, metric.value, metric.rating, initialPage.current ?? "desconhecida");
  }, []);

  useReportWebVitals(handleWebVital);
  return null;
}
