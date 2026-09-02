"use client";

import { useEffect, useMemo } from "react";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { EmptyLibraryHero } from "../media/EmptyLibraryHero";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";
import { todayLocalKey, isReleased } from "./release-date";

/**
 * CORREÇÃO (a pedido, "diverge do web de propósito" — o app nativo
 * já resolveu isso antes, TASK-099/TASK-148) — três mudanças, mesma
 * origem: filme não tem um estado "assistindo" que faça sentido
 * mostrar como lista própria — diferente de série, não tem
 * episódio/progresso pra acompanhar aos poucos; um filme é "quero
 * assistir" ou já foi assistido (o que já muda o status pra
 * "completed" sozinho). Categoria "Assistindo" removida.
 *
 * Um filme em "Assistir depois" com lançamento no FUTURO saía
 * misturado junto com os já lançados — agora sai daqui e vai pra
 * "Em breve" (`EmBreveSection.tsx`) automaticamente.
 *
 * "Concluídos" (a pedido, bater 100% com o mobile) também saiu
 * daqui — mobile só mostra essa categoria no Perfil, não na Central
 * de Filmes. Estrutura simplificada de "lista de categorias" pra
 * uma seção só, mesmo padrão do mobile.
 *
 * Mesmos hooks de sempre — nenhuma mudança de dados ou lógica além
 * do filtro dessas categorias.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { data: items, isLoading, isError, error, refetch } = useLibraryItems();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("movies-library");
  const { t } = useTranslation();

  useEffect(() => {
    if (isError) {
      console.error("[MoviesHome/MinhaListaSection] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  const movies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);
  const todayKey = useMemo(() => todayLocalKey(), []);

  const wantToWatch = useMemo(
    () => movies.filter((item) => item.status === "want_to_watch" && isReleased(item.releaseDate, todayKey)),
    [movies, todayKey]
  );

  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  /*
   * A PEDIDO (2026-09-01 — "no empty state, não faz sentido ter
   * 'continue assistindo/assistir depois' e a seleção de lista/grid.
   * tira isso, mas somente na tela de empty state", mesmo ajuste em
   * `series-home/MinhaListaSection.tsx`) — só o cabeçalho (título da
   * seção + alternador grade/lista) some quando o estado vazio de
   * verdade está confirmado; carregando ou com itens continua igual.
   */
  const isEmptyState = viewModeReady && !isLoading && wantToWatch.length === 0;

  return (
    <>
      {!isEmptyState && (
        /*
         * CORREÇÃO (2026-08-27, ver comentário de `HomeSkeleton.tsx`) —
         * cabeçalho sempre visível, mesmo raciocínio de
         * `movies-home/EmBreveSection.tsx`.
         *
         * PADRONIZADO (2026-09-01, a pedido — "deixe os espaços
         * padronizados", mesmo ajuste já feito em `series-home/MinhaListaSection.tsx`)
         * — era `mb-2` (8px), virou `mb-3` (12px), o mesmo espaçamento
         * título-conteúdo usado em toda fileira de carrossel do app
         * (Explorar, Perfil) e agora também na Home de Séries.
         */
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>{t("seriesHome.watchlist")}</SectionTitle>
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      )}

      {!viewModeReady ? (
        // CORREÇÃO (2026-08-27, "ainda mostra 2 esqueletons" — ver
        // comentário completo em `useViewModePreference.ts`).
        null
      ) : isLoading ? (
        <HomeSkeleton variant={viewMode === "grid" ? "grid" : "list"} />
      ) : wantToWatch.length === 0 ? (
        /*
         * "PORTE DO ESTADO VAZIO ILUSTRADO PRA FILMES" (2026-09-01, a
         * pedido — "faça isso", depois de eu ter sinalizado que Filmes
         * ainda usava o `EmptyShelf` simples enquanto Séries já tinha
         * ganhado a versão ilustrada) — mesma receita de
         * `series-home/MinhaListaSection.tsx`: `EmptyLibraryHero`
         * (ilustração + título + subtítulo + botão + divisor) seguido
         * da fileira `PopularMediaRow`. Reaproveita a MESMA imagem
         * (`empty-library-scene.png`) — a ilustração (sofá/luminária/
         * gato/manta/pipoca) não é específica de série ou filme.
         *
         * Só UMA variante de texto aqui (`emptyWatchlistTitle`/
         * `Subtitle`, chaves novas), não duas como em Séries: essa
         * seção é literalmente "Assistir depois" (`wantToWatch`), sem
         * conceito de "progresso"/"tudo em dia" — filme não tem
         * episódio pendente pra zerar (ver comentário no topo deste
         * arquivo, "filme não tem um estado 'assistindo'"). Lista
         * vazia aqui só tem um significado possível: "não tem nada
         * pra assistir depois ainda".
         *
         * `list="trending_movies"` (existia no tipo `DiscoverListKey`,
         * já usado em Explorar) + `viewAllHref="/explore/all/trending_movies"`
         * (mesma rota genérica "ver todos" que Séries já usa pra
         * `trending_series`). Título reaproveita `seriesHome.popularSeries`
         * ("Populares no SeenList") — o texto já era genérico de
         * propósito (marca do app, não "séries populares"), mesmo
         * ícone de chama âmbar.
         */
        <>
          {/*
            * A PEDIDO (2026-09-02 — "tira o 'populares no seenlist' e
            * deixa o restante de cima centralizado", pedido em Séries,
            * PADRONIZADO aqui também a pedido explícito, pra ficar
            * igual nas duas Centrais) — fileira `PopularMediaRow`
            * removida daqui junto com `series-home/MinhaListaSection.tsx`.
            * `EmptyLibraryHero` já nasce centralizado na horizontal
            * sozinho (`items-center text-center`, ver o componente),
            * então nenhuma mudança de alinhamento foi necessária além
            * de remover a fileira. Fica ancorado perto do topo, sem
            * centralização vertical nova (mesma escolha do usuário
            * pro lado de Séries).
            */}
          <EmptyLibraryHero
            illustrationSrc="/illustrations/empty-library-scene.png"
            title={t("moviesHome.emptyWatchlistTitle")}
            subtitle={t("moviesHome.emptyWatchlistSubtitle")}
            actionLabel={t("moviesHome.exploreMovies")}
            actionHref="/explore?tab=movies"
          />
        </>
      ) : viewMode === "grid" ? (
        <PosterGrid items={wantToWatch} />
      ) : (
        <div className="space-y-2">
          {wantToWatch.map((item) => (
            <MediaListRow key={item.id} item={item} secondaryText={item.year ? String(item.year) : ""} />
          ))}
        </div>
      )}
    </>
  );
}
