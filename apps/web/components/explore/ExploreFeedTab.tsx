"use client";

import { useEffect, useMemo, useState } from "react";
import { useDiscoverList } from "@/lib/queries/discover";
import { useMyFeedCategories } from "@/lib/queries/feed-categories";
import { usePosts } from "@/lib/queries/posts";
import { FeedCard } from "./FeedCard";
import { FeedOnboarding } from "./FeedOnboarding";
import { PostCard } from "./PostCard";
import { CreatePostButton } from "./CreatePostButton";

const FEED_LIMIT = 10;

/**
 * TASK-059 — "enquanto o usuário não selecionar pelo menos uma
 * categoria, o Feed não será exibido". O conteúdo de descoberta
 * (baseado em trending do TMDB, da TASK-058) continua o mesmo por
 * enquanto — a personalização por categoria/algoritmo de mistura de
 * sinais é fase futura.
 *
 * Fase 2 (esta) — posts reais de texto (usePosts/CreatePostButton)
 * aparecem numa seção própria, ANTES dos cards de descoberta —
 * deliberadamente não misturados entre si ainda: "misturar
 * constantemente" (post/review/enquete/meme/...) é o algoritmo final,
 * que só faz sentido depois que os outros tipos de post existirem.
 * Misturar só posts de texto com cards de descoberta agora seria
 * fingir uma mistura que não é a pedida.
 *
 * "duração (filmes) ou temporadas (séries)" no card de descoberta
 * exige o resumo COMPLETO (a listagem trending do TMDB não traz
 * isso) — por isso essa parte do feed é deliberadamente pequena (10
 * itens), não a lista inteira.
 */
export function ExploreFeedTab() {
  const { data: categories, isLoading: categoriesLoading } = useMyFeedCategories();
  const { data: posts, isLoading: postsLoading } = usePosts();
  const trendingSeries = useDiscoverList("trending_series", true);
  const trendingMovies = useDiscoverList("trending_movies", true);
  const [extraInfoById, setExtraInfoById] = useState<Record<string, string | null>>({});

  const items = useMemo(
    () => [...(trendingSeries.data?.items ?? []).slice(0, 6), ...(trendingMovies.data?.items ?? []).slice(0, 6)].slice(0, FEED_LIMIT),
    [trendingSeries.data, trendingMovies.data]
  );

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    async function loadExtraInfo() {
      const entries = await Promise.all(
        items.map(async (item) => {
          const key = `${item.mediaType}-${item.id}`;
          try {
            const endpoint = item.mediaType === "movie" ? `/api/tmdb/movie/${item.id}` : `/api/tmdb/series/${item.id}`;
            const response = await fetch(endpoint);
            if (!response.ok) return [key, null] as const;
            const data = await response.json();
            const info =
              item.mediaType === "movie"
                ? data.runtimeMinutes
                  ? `${Math.floor(data.runtimeMinutes / 60)}h ${data.runtimeMinutes % 60}min`
                  : null
                : data.numberOfSeasons
                  ? `${data.numberOfSeasons} temporada${data.numberOfSeasons === 1 ? "" : "s"}`
                  : null;
            return [key, info] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );
      if (!cancelled) setExtraInfoById(Object.fromEntries(entries));
    }

    void loadExtraInfo();
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (categoriesLoading) {
    return (
      <div className="space-y-4 px-4 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-video animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  if (categories && categories.length === 0) {
    return <FeedOnboarding />;
  }

  const isLoading = trendingSeries.isLoading || trendingMovies.isLoading;
  const genreMap = trendingSeries.data?.genreMap ?? trendingMovies.data?.genreMap;

  return (
    <>
      <div className="space-y-4 px-4 pt-4 pb-6">
        {postsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
            Ninguém publicou nada ainda. Seja o primeiro — toque no botão + aqui embaixo.
          </p>
        )}

        <h2 className="pt-2 text-base font-bold text-text">Descobrir</h2>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : (
          items.map((item) => (
            <FeedCard
              key={`${item.mediaType}-${item.id}`}
              item={item}
              genreMap={genreMap}
              extraInfo={extraInfoById[`${item.mediaType}-${item.id}`] ?? null}
            />
          ))
        )}
      </div>

      <CreatePostButton />
    </>
  );
}
