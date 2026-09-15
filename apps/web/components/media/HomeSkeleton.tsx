"use client";

import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ShimmerBlock } from "./ShimmerBlock";

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
   * 56×80 + duas barras de texto, mesmo "cartão de vidro" de
   * `MediaListRow.tsx`/`ContinueWatchingCard.tsx`).
   */
  variant?: "grid" | "list";
  /**
   * SUPERSEDIDO (2026-09-15, a pedido — "implementa o esqueleton 3
   * Shimmer") — existia só pra acompanhar os "pontinhos" (legenda
   * abaixo deles). O formato shimmer mostra a FORMA de verdade do
   * conteúdo (pôster+texto/grade) — não precisa de legenda pra dizer
   * "isso é um carregamento", o próprio formato já deixa claro. O
   * parâmetro continua aceito (só `series-home/MinhaListaSection.tsx`
   * passa) pra não precisar editar quem chama, mas não é mais lido.
   */
  message?: string;
  /** Quantos itens fantasmas desenhar — 6 no modo grade (2 linhas de 3), 4 no modo lista, por padrão. */
  count?: number;
}

/**
 * CORREÇÃO (2026-09-03, a pedido — "ao invés de uma tela sem nada,
 * algo interessante enquanto carrega os cards na Home") — as
 * caixinhas cinzas piscando ("grade de pôsteres falsos"/"linhas
 * falsas") viraram 3 pontinhos pulsando, cor de destaque da marca.
 *
 * SUPERSEDIDO (2026-09-15, bug real reportado no PORTE mobile deste
 * mesmo conceito — "o esqueleton está errado", print mostrando os
 * cartões fantasmas do `LibraryListSkeleton.tsx` invisíveis por um bug
 * de contraste; ver causa raiz completa em `Skeleton.tsx` do mobile) —
 * ao corrigir aquele bug, o usuário viu 4 formatos possíveis numa
 * prévia comparativa (pontinhos = o que já existia aqui; fantasma
 * corrigido; shimmer; respiração do cartão inteiro) e escolheu
 * shimmer — pra ser aplicado nos dois lados (mobile E web), não só no
 * mobile. Voltou a desenhar a FORMA de verdade do conteúdo (pôster +
 * texto/grade), só que com contraste correto e brilho varrendo em vez
 * de pulsar opacidade (ver `ShimmerBlock.tsx`) — mais parecido com o
 * conteúdo que vai substituir o esqueleto (reserva a altura certa
 * automaticamente, sem precisar do `min-h` fixo que os pontinhos
 * usavam pra não deixar a página "pular").
 */
export function HomeSkeleton({ variant = "grid", count }: HomeSkeletonProps) {
  const { t } = useTranslation();
  const itemCount = count ?? (variant === "grid" ? 6 : 4);

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label={t("common.loading")}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index}>
            <ShimmerBlock className="aspect-[2/3] w-full rounded-2xl" />
            <ShimmerBlock className="mt-2 h-3 w-4/5" />
            <ShimmerBlock className="mt-1 h-2.5 w-2/5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-2xl border border-white/10 p-2.5">
          <ShimmerBlock className="h-20 w-14 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <ShimmerBlock className="h-3.5 w-3/4" />
            <ShimmerBlock className="h-3 w-1/2" />
            <ShimmerBlock className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
