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
    // "Vidro" (redesign âmbar/vidro, 2026-08-26 — Barra de navegação) — mesmo padrão de vidro neutro já usado em cartões/containers do resto do app (SearchBar.tsx/ConfirmDialog.tsx), em vez de `bg-surface/95` opaco.
    //
    // "Floating Glass Dock" (2026-08-26, ajuste final — proposta trazida
    // pelo usuário, originada de outra IA — "GPT", revisada e ajustada
    // com ele antes de aplicar: escopo confirmado só pra esta barra, as
    // pílulas sólidas de HomeTabs.tsx/ExploreTabs.tsx NÃO mudaram) —
    // borda mais fina/discreta (`border-white/10` → `border-white/[0.06]`)
    // e sombra mais suave, pra a barra parecer flutuar sobre o conteúdo
    // em vez de ser uma caixa em cima dele.
    //
    // Compactação (2026-08-26, a pedido — "os 4 itens estão muito
    // espalhados") — barra ~11% mais estreita (404px → 360px) e um
    // `px-3` (12px de cada lado) que NÃO existia antes: com 4 itens
    // `flex-1` dividindo a barra em partes iguais, esses 12px "roubam"
    // espaço que antes ia todo pro vão entre os ícones — resultado:
    // cada coluna de item cai de ~101px pra 84px (~17% mais estreita,
    // mais do que a barra como um todo), aproximando os 4 itens sem
    // mudar o tamanho de ícone/legenda. Ícones e cápsulas continuam do
    // MESMO tamanho — só o espaço ao redor deles encolheu.
    //
    // Compactação nº2 (2026-08-26, a pedido — "ainda muito espalhados,
    // quero mais densidade, mas sem reduzir os ícones") — mais um corte
    // em cima do anterior: 360px → 284px (a barra em si) e `px-3` (12px)
    // → `px-2` (8px) de respiro nas bordas. Resultado: coluna de cada
    // item cai de 84px pra ~67px (outros ~20% mais estreita) — o pedido
    // explícito foi "o problema não é o tamanho dos ícones, é o espaço
    // morto ao redor", então só o espaço encolheu de novo, ícone (20px)
    // e legenda (10px) continuam do mesmo tamanho de sempre.
    <nav
      aria-label={t("nav.mainNavigation")}
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-[284px] items-center rounded-2xl border border-white/[0.06] px-2 shadow-lg shadow-black/20 backdrop-blur-[18px] backdrop-saturate-[180%] pb-[env(safe-area-inset-bottom)]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
      {activeIndex >= 0 && (
        <>
          {/*
           * "Floating Glass Dock" — a cápsula sólida virou 2 elementos
           * separados, os dois deslizando pela MESMA fórmula de posição
           * de antes (só a largura de cada um muda): (1) um brilho
           * âmbar suave, sem borda, que se dissolve dentro do vidro —
           * mistura % (posição da coluna) com px (largura fixa) no
           * mesmo `calc()`, igual a antes. (2) um traço fino embaixo do
           * item ativo (ver mais abaixo, depois do glow).
           *
           * Compactação (2026-08-26) — a barra ganhou padding interno
           * (`px-3`, depois `px-2`) que ela não tinha antes. Esses
           * elementos são posicionados com `left` em % do LARGURA TOTAL
           * da barra (não do espaço interno já com padding descontado)
           * — por isso a fórmula soma o padding na frente e troca
           * `100%` por `(100% - padding×2)`, senão o brilho/traço
           * ficariam desalinhados com a coluna real do item (que SIM já
           * nasce encolhida pelo padding). Valores abaixo (8px/16px)
           * batem com o `px-2` atual da barra — se o padding mudar de
           * novo, estes dois números têm que acompanhar.
           *
           * Compactação nº2 (2026-08-26) — a coluna de cada item
           * encolheu de 84px pra ~67px; o brilho (76px de largura)
           * passou a ser MAIOR que a própria coluna, vazando visualmente
           * pro espaço do vizinho ao lado. Reduzido pra 60px — cabe
           * dentro da coluna nova com uma margem parecida com a de
           * antes, sem mudar o estilo do brilho em si (só o tamanho).
           */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 h-[52px] w-[60px] rounded-full transition-[left] duration-300 ease-out"
            style={{
              left: `calc(8px + ${activeIndex} * ((100% - 16px) / ${tabs.length}) + ((100% - 16px) / ${tabs.length} - 60px) / 2)`,
              background: "radial-gradient(closest-side, rgba(232,163,61,0.32), rgba(232,163,61,0.10) 55%, transparent 80%)",
              filter: "blur(6px)",
            }}
          />
          {/*
           * Refinamento do traço (2026-08-26, a pedido — "um pouco mais
           * curta, ligeiramente mais fina, pontas totalmente
           * arredondadas, glow mínimo") — 22×3px → 16×2px (`rounded-full`
           * já garantia pontas arredondadas, não mudou), e o
           * `boxShadow` de brilho ficou mais discreto (raio e opacidade
           * menores) em vez de removido — a ideia era suavizar, não
           * apagar o brilho.
           *
           * Distância até a legenda (2026-08-26, a pedido — "ícone e
           * legenda próximos, e o traço mais afastado") — `bottom-[9px]`
           * → `bottom-[4px]`: o traço desce mais perto da borda de
           * baixo da barra, abrindo um respiro visível entre ele e o
           * texto da aba (que não mudou de lugar — só o traço desceu).
           */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[4px] h-[2px] w-[16px] rounded-full transition-[left] duration-300 ease-out"
            style={{
              left: `calc(8px + ${activeIndex} * ((100% - 16px) / ${tabs.length}) + ((100% - 16px) / ${tabs.length} - 16px) / 2)`,
              background: "linear-gradient(90deg, rgba(240,169,79,0.4), rgba(232,163,61,1), rgba(240,169,79,0.4))",
              boxShadow: "0 0 4px rgba(232,163,61,0.55)",
            }}
          />
        </>
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
