"use client";

import { usePathname } from "next/navigation";
import { tabs } from "@/lib/navigation";
import { BottomNavigationItem } from "./BottomNavigationItem";

/**
 * Fixa no rodapé. TASK-014: nada de sidebar/layout de desktop — em
 * telas ≥768px, a barra fica com a mesma largura de "moldura de
 * celular" (~430px) do resto do app, centralizada via
 * `left-1/2 + -translate-x-1/2` (elementos `fixed` ignoram o
 * `max-width`/centralização do elemento pai, então isso precisa ser
 * feito na própria barra, não em quem a envolve). Troca de aba é
 * navegação normal do Next.js (`next/link`), então é instantânea
 * (prefetch + client-side transition), sem precisar de lógica
 * própria de troca de tela.
 */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-1/2 z-40 flex w-full -translate-x-1/2 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:max-w-[430px]"
    >
      {tabs.map((tab) => (
        <BottomNavigationItem key={tab.href} {...tab} active={pathname === tab.href} />
      ))}
    </nav>
  );
}
