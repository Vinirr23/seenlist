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

  /*
   * A PEDIDO — cápsula deslizante por trás da aba ativa, em vez do
   * destaque aparecer/sumir na hora. `activeIndex` é a POSIÇÃO da
   * aba (0, 1, 2...), não o índice de array qualquer — é o que
   * `translateX(N * 100%)` usa pra mover a cápsula exatamente N
   * "casas" pra direita, já que cada aba ocupa 1/4 da barra
   * (`flex-1`, larguras iguais).
   *
   * `pathname === tab.href` é comparação EXATA — dentro de uma
   * série (`/series/123`), nenhuma aba bate, e `activeIndex` fica
   * -1. Sem tratar isso, a cápsula deslizaria pra FORA da barra
   * (translateX negativo) em vez de continuar visível na última
   * aba correta; por isso ela só aparece quando alguma aba bate de
   * verdade.
   */
  const activeIndex = tabs.findIndex((tab) => tab.href === pathname);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-[404px] items-center rounded-2xl border border-border bg-surface/95 shadow-lg shadow-black/20 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
    >
      {activeIndex >= 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1.5 rounded-xl bg-primary/15 border border-primary/40 transition-transform duration-300 ease-out"
          style={{
            width: `${100 / tabs.length}%`,
            left: 0,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      )}
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
