import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LibraryItem, MediaType } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";

interface FavoriteRow {
  media_type: MediaType;
  media_id: number;
}

function favoritesKey(userId: string | null) {
  return ["favorites", userId ?? ""] as const;
}

/**
 * Mesmo padrão de `fetchLibraryItems` (lib/queries/library-state.ts):
 * busca os favoritos brutos no Supabase, depois pede título/pôster/
 * ano pro TMDB via a MESMA rota `/api/tmdb/library-summaries` que a
 * Biblioteca já usa — nenhuma rota nova.
 */
export function usePublicFavorites(userId: string | null) {
  return useQuery({
    queryKey: favoritesKey(userId),
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase.from("favorites").select("media_type, media_id").eq("user_id", userId);
      if (error) {
        console.error("[favorites] Falha ao buscar favoritos", describeSupabaseError(error));
        throw error;
      }

      const rows = (data ?? []) as FavoriteRow[];
      const movieIds = rows.filter((row) => row.media_type === "movie").map((row) => row.media_id);
      const seriesIds = rows.filter((row) => row.media_type === "series").map((row) => row.media_id);
      if (movieIds.length === 0 && seriesIds.length === 0) return [];

      const response = await fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds, seriesIds }),
      });
      if (!response.ok) throw new Error("Falha ao buscar detalhes dos favoritos");
      const summaries = (await response.json()) as {
        movies: { id: number; title: string; year: number | null; posterPath: string | null }[];
        series: { id: number; title: string; year: number | null; posterPath: string | null }[];
      };

      const now = new Date().toISOString();
      const movieItems: LibraryItem[] = summaries.movies.map((summary) => ({
        mediaType: "movie",
        id: summary.id,
        status: "completed",
        createdAt: now,
        updatedAt: now,
        title: summary.title,
        year: summary.year,
        posterPath: summary.posterPath,
      }));
      const seriesItems: LibraryItem[] = summaries.series.map((summary) => ({
        mediaType: "series",
        id: summary.id,
        status: "completed",
        createdAt: now,
        updatedAt: now,
        title: summary.title,
        year: summary.year,
        posterPath: summary.posterPath,
      }));

      return [...movieItems, ...seriesItems];
    },
    enabled: Boolean(userId),
  });
}

export function useIsFavorite(mediaType: MediaType, mediaId: number) {
  return useQuery({
    queryKey: ["is-favorite", mediaType, mediaId],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("favorites")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("media_type", mediaType)
        .eq("media_id", mediaId)
        .maybeSingle();
      if (error) {
        console.error("[favorites] Falha ao checar favorito", describeSupabaseError(error));
        throw error;
      }
      return Boolean(data);
    },
  });
}

/** Item 13: "não implementar likes" — favoritar não é curtida pública nem gera atividade nenhuma, só marca a série/filme pra aparecer na seção "Favoritos" do próprio perfil. */
export function useToggleFavorite(mediaType: MediaType, mediaId: number) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (currentlyFavorite: boolean) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      if (currentlyFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .match({ user_id: user.id, media_type: mediaType, media_id: mediaId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, media_type: mediaType, media_id: mediaId });
        if (error) throw error;
      }
      return { userId: user.id, wasFavorite: currentlyFavorite };
    },
    onMutate: () => hapticTick(),
    onSuccess: ({ userId, wasFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ["is-favorite", mediaType, mediaId] });
      queryClient.invalidateQueries({ queryKey: favoritesKey(userId) });
      toast.success(wasFavorite ? "Removido dos favoritos" : "Adicionado aos favoritos");
    },
    onError: (error) => {
      console.error("[favorites] Falha ao favoritar/desfavoritar", error);
      toast.error("Erro de conexão");
    },
  });
}
