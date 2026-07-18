"use client";

import { usePathname } from "next/navigation";
import { tabs } from "@/lib/navigation";
import { BottomNavigationItem } from "./BottomNavigationItem";
import { useBottomNavHidden } from "@/lib/layout/bottomNavVisibility";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useUnreadRecommendationsCount } from "@/lib/queries/recommendations";

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
 *
 * BUG (Web Mobile / iOS Safari) — some do DOM (não só fica invisível)
 * enquanto um modal em tela cheia estiver aberto (`useBottomNavHidden`,
 * ver bottomNavVisibility.tsx). `display:none`/opacidade sozinhos não
 * bastavam: um elemento `fixed` continua ocupando sua posição de
 * empilhamento e, em iOS Safari, pode ficar visível por cima de outro
 * `fixed` quando o teclado abre, mesmo com z-index menor — remover do
 * DOM é a única garantia real.
 *
 * Tradução (1º lote) — `tabs` em `navigation.ts` guarda uma CHAVE de
 * tradução em `label` (ex.: "nav.series"), não mais o texto em
 * português direto — `t(tab.label)` resolve pro idioma atual. Essa é
 * a barra que aparece em toda tela do app, então é o ponto de maior
 * impacto pra começar a extensão do sistema de tradução além de
 * Configurações.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  const hidden = useBottomNavHidden();
  const { t } = useTranslation();
  const { data: unreadCount } = useUnreadRecommendationsCount();

  if (hidden) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-1/2 z-40 flex w-full -translate-x-1/2 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:max-w-[430px]"
    >
      {tabs.map((tab) => (
        <BottomNavigationItem
          key={tab.href}
          {...tab}
          label={t(tab.label)}
          active={pathname === tab.href}
          badge={tab.href === "/profile" && (unreadCount ?? 0) > 0}
        />
      ))}
    </nav>
  );
}
