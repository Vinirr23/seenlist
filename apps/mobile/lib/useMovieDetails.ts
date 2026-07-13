import { useCallback, useEffect, useState } from "react";
import type { MovieDetails, MovieWatchStatus } from "@seenlist/types";
import { fetchMovieDetails, fetchMovieStatus, setMovieStatus } from "./movieDetails";

export function useMovieDetails(movieId: string) {
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchMovieDetails(movieId)
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
  }, [movieId]);

  return { movie, isLoading, isError };
}

export function useMovieStatus(movieId: number) {
  const [status, setStatus] = useState<MovieWatchStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMovieStatus(movieId).then((data) => {
      if (!cancelled) {
        setStatus(data);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  const changeStatus = useCallback(
    async (newStatus: MovieWatchStatus) => {
      const previous = status;
      const next = previous === newStatus ? null : newStatus;
      setBusy(true);
      setStatus(next); // otimista

      try {
        await setMovieStatus(movieId, newStatus, previous);
      } catch (error) {
        console.error("[useMovieStatus] Falha ao mudar status", error);
        setStatus(previous);
      } finally {
        setBusy(false);
      }
    },
    [movieId, status]
  );

  return { status, isLoading, busy, changeStatus };
}
