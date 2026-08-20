"use client";

import { useRef } from "react";
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
 */
export function WebVitalsReporter() {
  const initialPage = useRef<string | null>(null);
  if (typeof window !== "undefined" && initialPage.current === null) {
    initialPage.current = window.location.pathname;
  }

  useReportWebVitals((metric) => {
    recordWebVital(metric.name, metric.value, metric.rating, initialPage.current ?? "desconhecida");
  });
  return null;
}
