"use client";

import { usePathname } from "next/navigation";
import { tabs } from "@/lib/navigation";
import { BottomNavigationItem } from "./BottomNavigationItem";

/**
 * Fixa no rodapé, funciona igual em Web e no navegador mobile (sem
 * variante de sidebar para telas largas — fora do escopo do
 * TASK-003). Troca de aba é navegação normal do Next.js
 * (`next/link`), então é instantânea (prefetch + client-side
 * transition), sem precisar de lógica própria de troca de tela.
 */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((tab) => (
        <BottomNavigationItem key={tab.href} {...tab} active={pathname === tab.href} />
      ))}
    </nav>
  );
}
