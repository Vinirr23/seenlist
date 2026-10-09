import type { ReactNode } from "react";

/**
 * NOVO (2026-10-09 — redesign das páginas públicas, achado da
 * auditoria: tanto o `<div className="...md:max-w-[430px]">` que as
 * duas páginas públicas tinham quanto o próprio `PageContainer.tsx`
 * reaproveitado prendiam a página a 430px DE PROPÓSITO — mas aquele
 * teto é uma decisão deliberada só pro APP LOGADO ("o layout oficial
 * do SeenList é o mobile — o desktop só exibe isso centralizado", ver
 * comentário em `PageContainer.tsx`), não pra estas páginas públicas,
 * que precisam parecer uma página de verdade em desktop. Por isso um
 * contêiner NOVO, só pras duas páginas públicas — `PageContainer.tsx`
 * não é tocado, continua exatamente como está pro resto do app.
 *
 * Duas colunas a partir de `lg` (mesmo breakpoint onde o conteúdo já
 * tem espaço de sobra pra isso): sidebar à esquerda (CTA do app +
 * ficha técnica) + conteúdo principal à direita — mesma disposição já
 * validada no mockup aprovado. Uma coluna só abaixo disso — "sem
 * rolagem horizontal da página" (pedido item 11), carrosséis internos
 * continuam com a própria rolagem horizontal deles. Ordem no HTML é
 * conteúdo primeiro, sidebar depois (`order-*` troca só a posição
 * VISUAL em `lg`) — no mobile empilhado, item 9 pede "posição natural
 * no fluxo vertical" pra ficha técnica: mais natural vir depois da
 * sinopse/elenco do que antes, por isso a ordem no DOM.
 */
export function TitlePageLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-20 pt-6 sm:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <main className="min-w-0 flex flex-col gap-8 lg:order-2">{children}</main>
        <aside className="flex flex-col gap-4 lg:order-1">{sidebar}</aside>
      </div>
    </div>
  );
}
