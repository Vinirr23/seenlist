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

export function HomeSkeleton({ variant = "grid" }: HomeSkeletonProps) {
  const { t } = useTranslation();

  if (variant === "list") {
    return (
      <div className="animate-pulse space-y-2" aria-busy="true" aria-label={t("media.loadingLibrary")}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
            style={{
              background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10), transparent 60%), rgba(255,255,255,0.06)",
            }}
          >
            <div className="h-20 w-14 shrink-0 rounded bg-surface" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-border" />
              <div className="h-2.5 w-1/3 rounded bg-border" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid animate-pulse grid-cols-3 gap-2" aria-busy="true" aria-label={t("media.loadingLibrary")}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="aspect-[2/3] w-full rounded-lg bg-surface" />
      ))}
    </div>
  );
}
