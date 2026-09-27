import { useCallback, useEffect, useState } from "react";
import type { MovieDetails, MovieWatchStatus } from "@seenlist/types";
import {
  fetchMovieDetails,
  fetchMovieStatusDetails,
  setMovieStatus,
  incrementMovieRewatch,
  fetchIsMovieFavorite,
  toggleMovieFavorite,
  fetchMovieAddedCount,
  peekCachedMovieDetails,
} from "./movieDetails";
import { hapticTick } from "./haptics";
import { useTranslation } from "./i18n/LocaleProvider";

export function useMovieDetails(movieId: string) {
  const { locale } = useTranslation();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    /*
     * CORREÇÃO (2026-09-27, Etapa 3 — "abro filme, saio, abro de
     * novo, recarrega") — a tela desmonta e remonta de verdade a cada
     * navegação (é tela de pilha, não aba), então este efeito roda do
     * zero toda vez, INDEPENDENTE do cache de `fetchMovieDetails` já
     * evitar a rede. Conferir o cache aqui, de forma síncrona, antes
     * de decidir `isLoading`, é o que faz o esqueleto não piscar
     * quando a resposta já está pronta — sem isso, `setIsLoading(true)`
     * incondicional garantia pelo menos um quadro de esqueleto mesmo
     * num cache-hit perfeito.
     */
    const cached = peekCachedMovieDetails(movieId, locale);
    if (cached) {
      setMovie(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setIsError(false);

    fetchMovieDetails(movieId, locale)
      .then((data) => {
        if (!cancelled) setMovie(data);
      })
      .catch((error) => {
        console.error("[useMovieDetails] Falha ao buscar detalhes", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [movieId, reloadToken, locale]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { movie, isLoading, isError, refetch };
}

export function useMovieStatus(movieId: number) {
  const [status, setStatus] = useState<MovieWatchStatus | null>(null);
  /**
   * A PEDIDO (redesenho da header, mockup aprovado 2026-09-25) — a
   * header nova mostra a data em que o filme foi assistido; antes
   * este hook só sabia o `status`, nunca a data. Otimista junto com
   * `status` em `changeStatus` (mesma regra do banco — só existe
   * enquanto o status atual é "watched", ver `movieDetails.ts`).
   */
  const [watchedAt, setWatchedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMovieStatusDetails(movieId).then((data) => {
      if (!cancelled) {
        setStatus(data.status);
        setWatchedAt(data.watchedAt);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  const changeStatus = useCallback(
    async (newStatus: MovieWatchStatus) => {
      hapticTick();
      const previousStatus = status;
      const previousWatchedAt = watchedAt;
      const next = previousStatus === newStatus ? null : newStatus;
      const nextWatchedAt = next === "watched" ? new Date().toISOString() : null;
      setBusy(true);
      setStatus(next); // otimista
      setWatchedAt(nextWatchedAt); // otimista

      try {
        await setMovieStatus(movieId, newStatus, previousStatus);
      } catch (error) {
        console.error("[useMovieStatus] Falha ao mudar status", error);
        setStatus(previousStatus);
        setWatchedAt(previousWatchedAt);
      } finally {
        setBusy(false);
      }
    },
    [movieId, status, watchedAt]
  );

  /**
   * "Reassistido" (ver `MovieActions.tsx`/`OptionSheet` de "Marcar
   * como...") não passa por `changeStatus` — `status` já é "watched"
   * e não muda, só `rewatch_count`/`watched_at` no banco
   * (`incrementMovieRewatch`). Sem isso, o `watchedAt` local ficava
   * parado na primeira vez assistido até o usuário sair e voltar da
   * tela (só então `fetchMovieStatusDetails` buscaria de novo).
   */
  const markRewatched = useCallback(async () => {
    const previousWatchedAt = watchedAt;
    const nextWatchedAt = new Date().toISOString();
    setWatchedAt(nextWatchedAt); // otimista
    try {
      await incrementMovieRewatch(movieId);
    } catch (error) {
      console.error("[useMovieStatus] Falha ao registrar reassistido", error);
      setWatchedAt(previousWatchedAt);
      throw error;
    }
  }, [movieId, watchedAt]);

  return { status, watchedAt, isLoading, busy, changeStatus, markRewatched };
}

/**
 * A PEDIDO (redesenho da header de Filme) — "Este filme foi
 * adicionado por X usuário(s)", número real via função no banco (ver
 * `movieDetails.ts`/`fetchMovieAddedCount`).
 */
export function useMovieAddedCount(movieId: number) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMovieAddedCount(movieId)
      .then((value) => {
        if (!cancelled) setCount(value);
      })
      .catch((error) => {
        console.error("[useMovieAddedCount] Falha ao buscar contagem", error);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  return count;
}

/** TASK-172 — favoritar filme, espelha useIsFavorite de useSeriesDetails.ts (que já existia só pra série). */
export function useIsMovieFavorite(movieId: number) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIsMovieFavorite(movieId).then((value) => {
      if (!cancelled) setIsFavorite(value);
    });
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  const toggle = useCallback(async () => {
    hapticTick();
    const previous = isFavorite;
    setBusy(true);
    setIsFavorite(!previous); // otimista
    try {
      await toggleMovieFavorite(movieId, previous);
    } catch (error) {
      console.error("[useIsMovieFavorite] Falha ao favoritar/desfavoritar", error);
      setIsFavorite(previous);
    } finally {
      setBusy(false);
    }
  }, [movieId, isFavorite]);

  return { isFavorite, busy, toggle };
}
