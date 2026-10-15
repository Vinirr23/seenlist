"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * NOVO (2026-10-09 — a pedido do usuário, comparando com o "More like
 * this" do IMDb: "ao invés de passar pro lado com esses slides,
 * prefiro como o IMDb que tem uma seta"). Envolve o conteúdo com
 * rolagem horizontal já existente (elenco, galeria de imagens,
 * recomendações) com setas de navegação, sem mudar o layout interno de
 * cada carrossel — cada chamador continua dono do seu próprio grid de
 * itens, só troca a `<div overflow-x-auto>` crua por este wrapper.
 *
 * Continua funcionando por arrastar/tocar (o `overflow-x-auto` interno
 * não muda) — as setas são um atalho A MAIS, não uma substituição.
 * Setas só aparecem quando há conteúdo pra rolar naquela direção
 * (`canScrollLeft`/`canScrollRight`, recalculado no scroll e no
 * resize/mudança de tamanho do conteúdo via `ResizeObserver` — a
 * galeria/carrossel pode mudar de largura depois do primeiro render
 * conforme as imagens carregam). Escondidas em telas pequenas
 * (`sm:flex`) — no mobile o gesto de arrastar já é natural, setas
 * sobrepostas só atrapalhariam o toque.
 */
export function ArrowCarousel({ children, gapClassName = "gap-3" }: { children: ReactNode; gapClassName?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();

    el.addEventListener("scroll", updateArrows, { passive: true });
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      resizeObserver.disconnect();
    };
  }, [updateArrows]);

  function scrollByDirection(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="group/carousel relative">
      <div ref={scrollRef} className={`flex ${gapClassName} overflow-x-auto overflow-y-hidden scroll-smooth pb-1`}>
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByDirection(-1)}
          aria-label="Ver itens anteriores"
          className="absolute left-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/85 text-text shadow-lg backdrop-blur-sm hover:bg-background sm:flex"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByDirection(1)}
          aria-label="Ver próximos itens"
          className="absolute right-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/85 text-text shadow-lg backdrop-blur-sm hover:bg-background sm:flex"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
