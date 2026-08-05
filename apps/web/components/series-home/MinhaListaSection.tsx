"use client";

import { useEffect, useMemo } from "react";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { recalculateUpToDateSeriesCategoriesThrottled } from "@/lib/queries/seriesCategoryRecalc";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { EmptyShelf } from "../media/EmptyShelf";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";

const CONTINUE_ASSISTINDO_LIMIT = 8;

/**
 * A PEDIDO — seção "Faz um tempo que você não assiste". Série que
 * está em "Assistindo" mas sem NENHUM episódio marcado há 2 semanas
 * desce automaticamente de "Continue assistindo" pra essa seção
 * separada, mais abaixo. Porta fiel do que já foi feito no mobile
 * (`app/(tabs)/series/index.tsx`), mesmo corte e mesma regra.
 *
 * Usa `lastActivityAt` (não `updatedAt`): esse campo já reflete o
 * episódio mais recente REALMENTE assistido, não só a última vez que
 * o status mudou — é o que faz "faz um tempo que você não assiste"
 * significar o que promete. Sem botão nenhum e sem tela própria (a
 * pedido) — a seção só aparece quando tem algo nela, e some sozinha
 * quando a pessoa volta a assistir.
 */
const STALE_AFTER_DAYS = 14;

/**
 * Ajuste — o botão de alternância grade/lista mora aqui agora
 * (canto superior direito, junto do "Continue assistindo"). Escopo
 * próprio (`useViewModePreference("series-library")`) — trocar aqui
 * nunca afeta Filmes nem o Perfil, que têm sua própria preferência
 * independente.
 *
 * Mesmos hooks de sempre (`useLibraryItems`, `useLibraryRealtimeSync`)
 * — nada mudou na lógica de status, no banco, ou no tracker. Só a
 * apresentação de "Continue assistindo" alterna entre grade
 * (`PosterGrid`) e lista (`MediaListRow`) — a prateleira de scroll
 * horizontal que existia antes era o modo "grade" implícito; agora é
 * uma escolha explícita, com uma alternativa de verdade ao lado.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { data: items, isLoading, isError, error, refetch } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("series-library");
  const { t } = useTranslation();

  useEffect(() => {
    if (isError) {
      console.error("[MinhaListaSection] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  /**
   * CORREÇÃO (bug real, reportado) — mesmo espírito do
   * `useFocusEffect` do app nativo: ao abrir a Central de Séries,
   * recalcula sozinho quaisquer séries "Em dia" que já tenham
   * episódio novo pendente, promovendo de volta pra "Assistindo"
   * antes mesmo do usuário interagir. Silencioso — não mostra
   * spinner nem bloqueia a tela; só atualiza a lista se algo mudou.
   *
   * PERFORMANCE (achado real — "Home lenta") — usa a versão com
   * limite de 1x/dia (`...Throttled`, ver `seriesCategoryRecalc.ts`)
   * em vez da função crua: sem isso, essa checagem pesada (uma
   * chamada TMDB por temporada de CADA série "watching"/"up_to_date"
   * + rebuscar todo o histórico de episódios assistidos) rodava do
   * zero toda vez que essa tela montava — bastava sair da aba Séries
   * e voltar.
   */
  useEffect(() => {
    recalculateUpToDateSeriesCategoriesThrottled()
      .then(() => refetch())
      .catch((err) => console.error("[MinhaListaSection] Falha ao recalcular categorias 'Em dia'", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  /**
   * A PEDIDO — "Faz um tempo que você não assiste": corte por
   * `lastActivityAt` (episódio realmente assistido), 14 dias. Feito
   * ANTES das listas de "Continue assistindo" porque as duas
   * precisam desse mesmo corte pra não mostrar a mesma série nas
   * duas seções.
   */
  const { recentSeries, staleSeries } = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const recent: typeof series = [];
    const stale: typeof series = [];

    for (const item of series) {
      // Só "watching" pode ficar parada — "Em dia" não tem nada
      // pendente pra assistir, então não faz sentido cobrar.
      const isStale = item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff;
      (isStale ? stale : recent).push(item);
    }

    stale.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return { recentSeries: recent, staleSeries: stale };
  }, [series]);

  /**
   * Correção (bug real, reportado): "Em dia" (`up_to_date`) é um status
   * PRÓPRIO, separado de "watching" — mesma causa raiz já documentada
   * em `useUpcomingEpisodes`/"Em breve". Filtrando só "watching" aqui,
   * uma série que já estava em dia sumia de "Continue assistindo" pra
   * sempre, mesmo quando saía episódio novo — nunca tinha chance de
   * mostrar o card (e o selo NOVO) de novo, porque nada no web
   * recalcula essa categoria sozinho (diferente do app nativo, que
   * refaz esse recálculo toda vez que a aba ganha foco — decisão
   * documentada como só-nativo na época, não portada pro web).
   *
   * Ampliado só pro modo LISTA: é o único lugar que mostra o selo
   * NOVO (`ContinueWatchingCard`, que já sabe voltar `null` sozinho
   * quando a série em dia não tem episódio pendente nenhum — nada
   * aparece à toa). O modo GRADE (`PosterGrid`) não filtra nem mostra
   * selo nenhum — incluir "Em dia" ali poluiria "Continue assistindo"
   * com séries sem nada pendente, então esse continua só "watching".
   */
  const continueWatchingList = useMemo(
    () =>
      recentSeries
        .filter((item) => item.status === "watching" || item.status === "up_to_date")
        /*
         * CORREÇÃO (bug real, reportado — Tanya the Evil, Daemons do
         * Reino das Sombras e Rick and Morty sumindo só no modo
         * lista) — antes ordenava tudo junto por `updatedAt`, sem
         * diferenciar "watching" (tem episódio pronto pra assistir
         * AGORA) de "up_to_date" (pode não ter nada pendente, só
         * está aqui pra eventualmente voltar a mostrar o selo NOVO).
         * Ao ampliar o filtro pra incluir "up_to_date", o corte de
         * `CONTINUE_ASSISTINDO_LIMIT` passou a ter mais candidatos
         * disputando as mesmas vagas — uma série "up_to_date"
         * mexida recentemente conseguia empurrar pra fora do top-8
         * uma série "watching" de verdade, mesmo essa tendo algo
         * pendente pra assistir agora (e cabendo tranquilamente no
         * modo grade, que não tem esse concorrente extra). Ordenação
         * em duas camadas: primeiro por status (watching sempre
         * antes de up_to_date), dentro de cada grupo por
         * `updatedAt`. Uma série com episódio pendente de verdade
         * nunca perde vaga pra uma que talvez nem tenha nada pra
         * mostrar.
         */
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        })
        .slice(0, CONTINUE_ASSISTINDO_LIMIT),
    [recentSeries]
  );

  const continueWatchingGrid = useMemo(
    () =>
      recentSeries
        .filter((item) => item.status === "watching")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, CONTINUE_ASSISTINDO_LIMIT),
    [recentSeries]
  );

  const continueWatching = viewMode === "grid" ? continueWatchingGrid : continueWatchingList;

  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>{t("seriesHome.continueWatching")}</SectionTitle>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {isLoading ? (
        <HomeSkeleton />
      ) : continueWatching.length === 0 ? (
        <EmptyShelf
          message={t("seriesHome.emptyLibrary")}
          actionLabel={t("seriesHome.exploreSeries")}
          actionHref="/explore"
        />
      ) : viewMode === "grid" ? (
        <PosterGrid items={continueWatching} />
      ) : (
        <div className="space-y-3">
          {continueWatching.map((item) => (
            <ContinueWatchingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/*
        * A PEDIDO — "Ver todas da lista Assistir depois"
        * (`WatchlistButton`) removido daqui. A lista continua
        * acessível normalmente (a rota não foi apagada), só não
        * ocupa mais espaço fixo no fim da Home.
        */}

      {staleSeries.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Faz um tempo que você não assiste</SectionTitle>
          <div className="mt-2">
            {viewMode === "grid" ? (
              <PosterGrid items={staleSeries} />
            ) : (
              <div className="space-y-3">
                {/*
                  * A PEDIDO — mesma correção já feita no mobile: usa
                  * o MESMO card completo do "Continue assistindo"
                  * (`ContinueWatchingCard`: código do episódio, selo
                  * NOVO/MAIS RECENTE, botão de check rápido) em vez
                  * de um card simples só com progresso, que ficava
                  * visualmente inconsistente com o resto da tela. O
                  * componente já sabe voltar `null` sozinho quando a
                  * série não tem episódio pendente de verdade.
                  */}
                {staleSeries.map((item) => (
                  <ContinueWatchingCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
