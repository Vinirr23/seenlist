"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * CORREÇÃO (bug real, reportado — botão de comentários e botão "+"
 * do Feed aparecendo POR CIMA da barra de navegação) — os dois
 * usavam `bottom: calc(5rem + safe-area)` direto, sem checar contra
 * a altura de verdade da barra (`BottomNavigation.tsx`): `bottom-3`
 * (12px) + `py-2.5` (20px) + ícone `h-9` (36px) + `gap-1` (4px) +
 * texto (~14px) ≈ 86px de altura total — MAIOR que os 80px (5rem)
 * que os botões flutuantes usavam. Como os botões têm `z-50` (maior
 * que o `z-40` da barra), a sobreposição de ~6px ficava visível por
 * cima dela, não atrás.
 *
 * Constante única, com folga de verdade (não só o mínimo calculado)
 * — se a altura da barra mudar no futuro, só precisa ajustar aqui,
 * não caçar cada botão flutuante espalhado pelo app.
 */
export const FLOATING_BUTTON_BOTTOM_OFFSET = "calc(6.5rem + env(safe-area-inset-bottom))";

interface BottomNavVisibilityContextValue {
  hidden: boolean;
  setHiddenBy: (id: string, hidden: boolean) => void;
}

const BottomNavVisibilityContext = createContext<BottomNavVisibilityContextValue | null>(null);

/**
 * BUG (Web Mobile / iOS Safari) — a barra de navegação inferior é
 * `position: fixed`, renderizada uma vez só em `(main)/layout.tsx`,
 * fora da árvore de qualquer modal (ex.: `CreatePostButton`, que fica
 * lá dentro de Explorar). Cobrir ela visualmente com um overlay não
 * bastava — em iOS Safari, elementos `fixed` não reagem bem à
 * abertura do teclado (ficam "presos" à posição do viewport de
 * layout, que não encolhe junto com o teclado), então a barra podia
 * continuar visível por cima do modal mesmo com um overlay entre os
 * dois. A correção de verdade é a barra deixar de existir no DOM
 * enquanto o modal está aberto — não só ficar escondida atrás dele.
 *
 * Guardado por um Set de IDs (não um boolean só) — permite mais de
 * um modal concorrente sem um fechar cedo demais "roubar" a
 * visibilidade que o outro ainda precisa (o mesmo raciocínio de um
 * contador de referências).
 */
export function BottomNavVisibilityProvider({ children }: { children: ReactNode }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const value = useMemo<BottomNavVisibilityContextValue>(
    () => ({
      hidden: hiddenIds.size > 0,
      setHiddenBy: (id, hidden) => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          if (hidden) next.add(id);
          else next.delete(id);
          return next;
        });
      },
    }),
    [hiddenIds]
  );

  return <BottomNavVisibilityContext.Provider value={value}>{children}</BottomNavVisibilityContext.Provider>;
}

/** Usado pelo próprio `<BottomNavigation>` pra decidir se renderiza ou não. */
export function useBottomNavHidden(): boolean {
  const ctx = useContext(BottomNavVisibilityContext);
  return ctx?.hidden ?? false;
}

/** Usado por um modal em tela cheia: `useHideBottomNav(open)` — some com a barra enquanto `open` for true, restaura sozinho ao fechar/desmontar. */
export function useHideBottomNav(hidden: boolean) {
  const ctx = useContext(BottomNavVisibilityContext);
  const idRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!ctx) return;
    const id = idRef.current;
    ctx.setHiddenBy(id, hidden);
    return () => ctx.setHiddenBy(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx.setHiddenBy é estável (useMemo), só `hidden` deve disparar de novo
  }, [hidden]);
}
