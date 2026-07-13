import { useCallback, useEffect, useState } from "react";
import type { SeriesDetails, LibraryStatus } from "@seenlist/types";
import {
  episodeKey,
  fetchIsFavorite,
  fetchSeriesDetails,
  fetchSeriesStatus,
  fetchWatchedEpisodes,
  incrementEpisodeRewatch,
  markEpisodesWatched,
  removeSeriesFromLibrary,
  setSeriesStatus,
  toggleEpisodeWatched,
  toggleFavorite,
  unmarkSeasonWatched,
  type WatchedEpisodeKey,
} from "./seriesDetails";

export function useSeriesDetails(seriesId: string) {
  const [series, setSeries] = useState<SeriesDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchSeriesDetails(seriesId)
      .then((data) => {
        if (!cancelled) setSeries(data);
      })
      .catch((error) => {
        console.error("[useSeriesDetails] Falha ao buscar detalhes", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  return { series, isLoading, isError };
}

export function useWatchedEpisodes(seriesId: number) {
  const [watched, setWatched] = useState<Set<WatchedEpisodeKey>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    fetchWatchedEpisodes(seriesId).then((data) => setWatched(data));
  }, [seriesId]);

  useEffect(() => {
    let cancelled = false;
    fetchWatchedEpisodes(seriesId).then((data) => {
      if (!cancelled) {
        setWatched(data);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const toggle = useCallback(
    async (seasonNumber: number, episodeNumber: number) => {
      const key = episodeKey(seasonNumber, episodeNumber);
      const wasWatched = watched.has(key);

      // Otimista: muda a tela antes da resposta do servidor, desfaz se der erro.
      setWatched((current) => {
        const next = new Set(current);
        if (wasWatched) next.delete(key);
        else next.add(key);
        return next;
      });

      try {
        await toggleEpisodeWatched(seriesId, seasonNumber, episodeNumber, wasWatched);
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao marcar/desmarcar episódio", error);
        setWatched((current) => {
          const next = new Set(current);
          if (wasWatched) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    },
    [seriesId, watched]
  );

  /** TASK-113 — "marcar episódios anteriores?" e "marcar temporada inteira" usam a mesma função, só muda a lista de episódios passada. */
  const markMany = useCallback(
    async (episodes: { seasonNumber: number; episodeNumber: number }[]) => {
      setBusy(true);
      setWatched((current) => {
        const next = new Set(current);
        for (const e of episodes) next.add(episodeKey(e.seasonNumber, e.episodeNumber));
        return next;
      });
      try {
        await markEpisodesWatched(seriesId, episodes);
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao marcar vários episódios", error);
        reload(); // desfazer otimista de vários itens de uma vez é mais simples recarregando do que revertendo item a item
      } finally {
        setBusy(false);
      }
    },
    [seriesId, reload]
  );

  const unmarkSeason = useCallback(
    async (seasonNumber: number) => {
      setBusy(true);
      const prefix = `${seasonNumber}-`;
      setWatched((current) => new Set([...current].filter((key) => !key.startsWith(prefix))) as Set<WatchedEpisodeKey>);
      try {
        await unmarkSeasonWatched(seriesId, seasonNumber);
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao desmarcar temporada", error);
        reload();
      } finally {
        setBusy(false);
      }
    },
    [seriesId, reload]
  );

  const rewatch = useCallback(
    async (seasonNumber: number, episodeNumber: number) => {
      try {
        await incrementEpisodeRewatch(seriesId, seasonNumber, episodeNumber);
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao marcar reassistido", error);
      }
    },
    [seriesId]
  );

  return { watched, isLoading, busy, toggle, markMany, unmarkSeason, rewatch };
}

export function useSeriesStatus(seriesId: number) {
  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSeriesStatus(seriesId).then((data) => {
      if (!cancelled) {
        setStatus(data);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const changeStatus = useCallback(
    async (newStatus: LibraryStatus) => {
      const previous = status;
      const next = previous === newStatus ? null : newStatus;
      setBusy(true);
      setStatus(next); // otimista

      try {
        await setSeriesStatus(seriesId, newStatus, previous);
      } catch (error) {
        console.error("[useSeriesStatus] Falha ao mudar status", error);
        setStatus(previous);
      } finally {
        setBusy(false);
      }
    },
    [seriesId, status]
  );

  return { status, isLoading, busy, changeStatus };
}

export function useIsFavorite(seriesId: number) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIsFavorite(seriesId).then((value) => {
      if (!cancelled) setIsFavorite(value);
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const toggle = useCallback(async () => {
    const previous = isFavorite;
    setBusy(true);
    setIsFavorite(!previous); // otimista
    try {
      await toggleFavorite(seriesId, previous);
    } catch (error) {
      console.error("[useIsFavorite] Falha ao favoritar/desfavoritar", error);
      setIsFavorite(previous);
    } finally {
      setBusy(false);
    }
  }, [seriesId, isFavorite]);

  return { isFavorite, busy, toggle };
}

export async function removeSeries(seriesId: number): Promise<void> {
  await removeSeriesFromLibrary(seriesId);
}
