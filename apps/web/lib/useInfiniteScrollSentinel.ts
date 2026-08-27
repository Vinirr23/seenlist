"use client";

import { useEffect, useRef } from "react";

/**
 * A PEDIDO — paginação nas telas "ver todos" da Explorar (2026-08-22).
 * Usuário escolheu os dois jeitos de carregar mais ao mesmo tempo:
 * botão "Carregar mais" (sempre visível, clicável) E rolagem
 * automática (carrega sozinho quando a pessoa chega perto do fim da
 * grade). Este hook cuida só da parte automática — devolve um `ref`
 * pra grudar num `<div>` sentinela no fim da lista; um
 * `IntersectionObserver` observa esse `<div>` e dispara `fetchNextPage`
 * assim que ele entra na tela, sem esperar chegar exatamente no fim
 * (`rootMargin` dá uma folga de 200px, pra carregar um pouco ANTES da
 * pessoa bater no fundo de verdade — rolagem mais suave). O botão
 * "Carregar mais" (renderizado por quem usa este hook, não por ele)
 * continua funcionando de qualquer forma — os dois disparam a MESMA
 * função `fetchNextPage`, então não há risco de duas buscas
 * conflitantes: React Query já ignora uma segunda chamada de
 * `fetchNextPage` enquanto a anterior ainda está em andamento.
 */
export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return sentinelRef;
}
