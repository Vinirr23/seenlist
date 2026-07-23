import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllWatchedEpisodeRows } from "@/lib/library";

/**
 * Porta fiel de `profile-media-carousel.ts` do web — mesma regra de
 * "atividade mais recente" (série: o mais recente entre
 * `series_status.updated_at` e o `watched_at` mais recente entre os
 * episódios dela; filme: só `movie_status.updated_at`; favoritos:
 * `favorites.created_at`). Esses hooks só calculam a ORDEM (lista de
 * IDs) — a busca de pôster/título continua vindo de
 * `fetchDisplaySummaries` (`lib/library.ts`), paginada conforme o
 * carrossel rola (`ProfileMediaCarousel.tsx`), pra não buscar resumo
 * de centenas de itens de uma vez só.
 *
 * Sem react-query no mobile (mesmo padrão de `useMyLists.ts`) — só
 * `useState`/`useEffect` local por hook.
 */
export function useSeriesActivityIds(userId: string | null) {
  const [ids, setIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIds([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const [statusResult, episodeRows] = await Promise.all([
          supabase.from("series_status").select("series_id, status, updated_at").eq("user_id", userId),
          fetchAllWatchedEpisodeRows(userId),
        ]);
        if (statusResult.error) {
          console.error("[profileMediaCarousel] Falha ao buscar series_status", statusResult.error);
        }

        const lastActivityBySeriesId = new Map<number, number>();
        const removedIds = new Set<number>();

        for (const row of statusResult.data ?? []) {
          if (row.status === "removed") {
            removedIds.add(row.series_id);
            continue;
          }
          lastActivityBySeriesId.set(row.series_id, new Date(row.updated_at).getTime());
        }
        for (const row of episodeRows) {
          const watchedAtMs = new Date(row.watched_at).getTime();
          const current = lastActivityBySeriesId.get(row.series_id);
          if (!current || watchedAtMs > current) {
            lastActivityBySeriesId.set(row.series_id, watchedAtMs);
          }
        }
        for (const id of removedIds) {
          lastActivityBySeriesId.delete(id);
        }

        if (!cancelled) {
          setIds([...lastActivityBySeriesId.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id));
        }
      } catch (error) {
        console.error("[profileMediaCarousel] Falha ao calcular atividade de séries", error);
        if (!cancelled) setIds([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { ids, isLoading };
}

/** Mesma ideia, mais simples — filme não tem episódio, só `movie_status.updated_at`. */
export function useMovieActivityIds(userId: string | null) {
  const [ids, setIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIds([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    supabase
      .from("movie_status")
      .select("movie_id, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[profileMediaCarousel] Falha ao buscar movie_status", error);
          setIds([]);
        } else {
          setIds((data ?? []).map((row) => row.movie_id as number));
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { ids, isLoading };
}

/** Favoritos: ordenado por quando foi favoritado (mais recente primeiro), não por atividade de assistir. */
export function useFavoriteIds(userId: string | null, mediaType: "movie" | "series") {
  const [ids, setIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIds([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    supabase
      .from("favorites")
      .select("media_id, created_at")
      .eq("user_id", userId)
      .eq("media_type", mediaType)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[profileMediaCarousel] Falha ao buscar favoritos", error);
          setIds([]);
        } else {
          setIds((data ?? []).map((row) => row.media_id as number));
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, mediaType]);

  return { ids, isLoading };
}
