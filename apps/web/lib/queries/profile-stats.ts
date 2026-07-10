import { useMemo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems, LIBRARY_QUERY_KEY } from "./library-state";
import { useRealtimeInvalidate } from "@/lib/supabase/useRealtimeInvalidate";

const REALTIME_TABLES = ["movie_status", "series_status", "watched_episodes"] as const;

export interface ProfileStats {
  moviesInLibrary: number;
  seriesInLibrary: number;
  moviesCompleted: number;
  seriesCompleted: number;
  episodesWatched: number;
  seriesWatching: number;
  /** TASK-033 — "Em dia" virou status de verdade (up_to_date), distinto de "watching". Sem este campo, essas séries desapareceriam das estatísticas. */
  seriesUpToDate: number;
  seriesPaused: number;
  seriesWantToWatch: number;
  /** Minutos — soma de (episódios assistidos × duração média) por série. É uma estimativa, ver MediaSummary.runtimeMinutes. */
  seriesWatchMinutes: number;
  /** Minutos — soma da duração dos filmes concluídos. */
  movieWatchMinutes: number;
  /** TASK-054 — soma de (totalEpisodes - watchedEpisodes) das séries em andamento/em dia/interrompidas. Derivado de dados já presentes em cada item (LibraryProgress) — nenhuma consulta nova. */
  episodesRemaining: number;
}

/**
 * Extraído do corpo de `useProfileStats` (TASK-028) pra ser
 * reaproveitado por `usePublicStats` sem duplicar a lógica de
 * agregação — mesmo padrão já usado em `buildLibraryItemsFromRows`
 * pra biblioteca pública.
 *
 * TASK-027J — `episodesWatched`/`seriesWatchMinutes` são estatística
 * de CONSUMO (quanto o usuário assistiu, incluindo reassistidas),
 * não de biblioteca — por isso usam `totalWatchEvents`, não
 * `watchedEpisodes`. Todo o resto aqui (seriesCompleted, seriesWatching,
 * etc.) continua sendo ESTADO da biblioteca, e continua vindo de
 * `status`/`watchedEpisodes` como sempre — a separação pedida é
 * só nesses dois números específicos, não uma reescrita geral.
 */
export function computeProfileStats(items: LibraryItem[]): ProfileStats {
  let moviesInLibrary = 0;
  let seriesInLibrary = 0;
  let moviesCompleted = 0;
  let seriesCompleted = 0;
  let episodesWatched = 0;
  let seriesWatching = 0;
  let seriesUpToDate = 0;
  let seriesPaused = 0;
  let seriesWantToWatch = 0;
  let seriesWatchMinutes = 0;
  let movieWatchMinutes = 0;
  let episodesRemaining = 0;

  for (const item of items) {
    if (item.mediaType === "movie") {
      moviesInLibrary += 1;
      if (item.status === "completed") {
        moviesCompleted += 1;
        movieWatchMinutes += item.runtimeMinutes ?? 0;
      }
    } else {
      seriesInLibrary += 1;
      // TASK-027J — estatística de CONSUMO, não de biblioteca: usa
      // totalWatchEvents (inclui reassistidas) quando existe. Cai de
      // volta pra episódios únicos só quando a série nunca passou
      // pelo importador do TV Time (totalWatchEvents undefined) —
      // pra essas, "quantas vezes assistiu" e "quantos episódios
      // únicos" são a mesma coisa mesmo, já que reassistir não é um
      // conceito rastreado fora da importação ainda.
      const watchEvents = item.progress?.totalWatchEvents ?? item.progress?.watchedEpisodes ?? 0;
      episodesWatched += watchEvents;
      seriesWatchMinutes += watchEvents * (item.runtimeMinutes ?? 0);

      if (item.status === "completed") seriesCompleted += 1;
      if (item.status === "watching") seriesWatching += 1;
      if (item.status === "up_to_date") seriesUpToDate += 1;
      if (item.status === "paused") seriesPaused += 1;
      if (item.status === "want_to_watch") seriesWantToWatch += 1;

      if (["watching", "up_to_date", "paused"].includes(item.status) && item.progress) {
        episodesRemaining += Math.max(0, item.progress.totalEpisodes - item.progress.watchedEpisodes);
      }
    }
  }

  return {
    moviesInLibrary,
    seriesInLibrary,
    moviesCompleted,
    seriesCompleted,
    episodesWatched,
    seriesWatching,
    seriesUpToDate,
    seriesPaused,
    seriesWantToWatch,
    seriesWatchMinutes,
    movieWatchMinutes,
    episodesRemaining,
  };
}

/**
 * TASK-021 — substitui o antigo `useUserStats` (TASK-009) por uma
 * versão mais completa, pedida explicitamente aqui. Mesma ideia de
 * antes: zero chamada nova ao Supabase/TMDB, tudo agregado em cima
 * do que `useLibraryItems` já traz — item 10 ("calcular tudo a
 * partir dos dados atuais", "não criar tabela nova") continua
 * satisfeito por construção.
 *
 * "Temporadas concluídas", pedido no item 2 como "se possível
 * calcular", ficou de fora — calcular isso direito exigiria saber
 * quantos episódios cada TEMPORADA tem individualmente (não só o
 * total da série), o que não vem de `useLibraryItems` hoje. Só
 * existe hoje na página de detalhe de cada série (que busca isso
 * sob demanda). Fazer isso pra toda série da biblioteca só pra
 * calcular uma estatística no Perfil pesaria bem mais do que o
 * resto desta tela inteira, e um número aproximado seria enganoso
 * (temporadas têm quantidades de episódio diferentes). Preferi não
 * mostrar a mostrar um número errado.
 *
 * Ajuste (Estatísticas — carrossel): "tempo assistido" usa a mesma
 * ideia — não é uma soma exata de duração por episódio individual
 * (isso não existe em lugar nenhum do banco), é episódios assistidos
 * × duração média do episódio (`runtimeMinutes`, que já vem do mesmo
 * request de resumo do TMDB que a Biblioteca sempre fez). Documentado
 * também em `MediaSummary.runtimeMinutes`.
 */
export function useProfileStats() {
  const libraryQuery = useLibraryItems();
  useRealtimeInvalidate(REALTIME_TABLES, LIBRARY_QUERY_KEY);

  const stats = useMemo<ProfileStats | undefined>(() => {
    if (!libraryQuery.data) return undefined;
    return computeProfileStats(libraryQuery.data);
  }, [libraryQuery.data]);

  return { ...libraryQuery, data: stats };
}
