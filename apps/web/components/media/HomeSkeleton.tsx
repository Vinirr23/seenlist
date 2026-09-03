"use client";

import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface HomeSkeletonProps {
  /**
   * BUG REAL CORRIGIDO (2026-08-27, reportado — "a tela 'em breve' de
   * séries o esqueleto está errado (já de antes)", "ver se alguma
   * outra tela está com o esqueleto errado") — causa raiz DUPLA,
   * achada checando os 4 lugares que usam este componente (`grep` por
   * `HomeSkeleton`):
   *
   * 1. Nenhum dos 4 usos passava informação nenhuma de qual formato o
   *    conteúdo real ia ter — então este componente sempre teve UM
   *    formato só, fixo: uma TIRA horizontal de pôsteres 2:3 (`flex`,
   *    `overflow-hidden`, 4 itens). Nenhuma das 4 telas que o usam
   *    mostra esse formato de verdade: são todas grade (`grid-cols-3`,
   *    `PosterGrid.tsx`) OU lista de linhas horizontais
   *    (`MediaListRow`/`ContinueWatchingCard`: pôster à esquerda +
   *    texto à direita) OU (Em breve de séries) uma lista vertical
   *    com trilha lateral — nenhuma é uma tira de carrossel. Ou seja,
   *    mesmo o modo "grade" já estava errado (tira ≠ grade que
   *    quebra linha), não só o modo "lista".
   * 2. A barra de título falsa embutida no topo do esqueleto duplicava
   *    o título de verdade em `series-home/MinhaListaSection.tsx`
   *    (único dos 4 usos que já mostra o título/alternador ANTES da
   *    checagem de carregamento, em vez de substituir a seção inteira)
   *    — corrigido junto: barra de título removida daqui, e as 2 telas
   *    que dependiam dela pra reservar espaço (`movies-home/
   *    EmBreveSection.tsx`, `movies-home/MinhaListaSection.tsx`) agora
   *    mostram o cabeçalho de verdade sempre (mesmo padrão já usado em
   *    `series-home/MinhaListaSection.tsx`), sem precisar de nenhuma
   *    barra falsa — também evita o título "pular" pra tela quando o
   *    carregamento termina.
   *
   * `variant` deixa quem chama dizer qual formato o conteúdo real vai
   * ter: "grid" (padrão — grade `grid-cols-3`, igual a
   * `PosterGrid.tsx`) ou "list" (linhas horizontais empilhadas, pôster
   * 80×56 + duas barras de texto, mesmo "cartão de vidro" de
   * `MediaListRow.tsx`/`ContinueWatchingCard.tsx`).
   */
  variant?: "grid" | "list";
}

/**
 * CORREÇÃO (2026-09-03, a pedido — "ao invés de uma tela sem nada,
 * algo interessante enquanto carrega os cards na Home") — as
 * caixinhas cinzas piscando ("grade de pôsteres falsos"/"linhas
 * falsas") viraram 3 pontinhos pulsando, cor de destaque da marca
 * (`bg-primary`, mesma usada na barra de navegação inferior). Escolha
 * do usuário entre 6 opções mostradas (brilho deslizante, cascata,
 * respiração, baralho de pôsteres, spinner, pontinhos) — "pontinhos"
 * venceu por ser o mais minimalista dos seis.
 *
 * `variant` continua existindo só pra decidir a ALTURA reservada
 * (evita a página "pular" quando o conteúdo de verdade chega — grade
 * costuma ocupar mais espaço vertical que lista) — a animação em si é
 * a mesma nos dois casos, não depende mais do formato do conteúdo
 * real que vem depois.
 */
export function HomeSkeleton({ variant = "grid" }: HomeSkeletonProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center justify-center gap-2 ${variant === "grid" ? "min-h-[220px]" : "min-h-[180px]"}`}
      aria-busy="true"
      aria-label={t("media.loadingLibrary")}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 animate-home-skeleton-dot rounded-full bg-primary"
          style={{ animationDelay: `${index * 0.15}s` }}
        />
      ))}
    </div>
  );
}
