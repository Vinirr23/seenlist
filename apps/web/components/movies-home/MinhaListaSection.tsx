"use client";

import { useEffect, useMemo } from "react";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { EmptyShelf } from "../media/EmptyShelf";
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
  const { viewMode, setViewMode } = useViewModePreference("movies-library");
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

  if (isLoading) return <HomeSkeleton />;
  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>{t("seriesHome.watchlist")}</SectionTitle>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {wantToWatch.length === 0 ? (
        <EmptyShelf message={t("seriesHome.emptyWatchlist")} />
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
