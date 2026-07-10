import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { fetchDisplaySummaries } from "./library-state";

export interface MyComment {
  id: string;
  body: string;
  containsSpoiler: boolean;
  createdAt: string;
  mediaType: "movie" | "series";
  mediaId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  mediaTitle: string;
  mediaPosterPath: string | null;
  /** URL de destino ao tocar — episódio/filme/série, exatamente como pedido (nunca uma lista intermediária). */
  targetUrl: string;
}

function buildTargetUrl(
  mediaType: "movie" | "series",
  mediaId: number,
  season: number | null,
  episode: number | null,
  commentId: string
): string {
  if (mediaType === "movie") return `/movies/${mediaId}/comments?highlight=${commentId}`;
  if (season != null && episode != null) {
    return `/series/${mediaId}/season/${season}/episode/${episode}/comments?highlight=${commentId}`;
  }
  return `/series/${mediaId}/comments?highlight=${commentId}`;
}

/**
 * TASK-056 — "todos os comentários publicados pelo usuário". Não
 * existia essa consulta antes (as existentes são sempre escopadas
 * por UMA mídia — useComments). Reaproveita fetchDisplaySummaries
 * (já existia, TASK-038) pro título/pôster de cada mídia comentada —
 * uma chamada em lote pros ids únicos, não uma por comentário.
 */
export function useMyComments() {
  return useQuery({
    queryKey: ["my-comments"],
    queryFn: async (): Promise<MyComment[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { data, error } = await supabase
        .from("comments")
        .select("id, body, contains_spoiler, created_at, media_type, media_id, season_number, episode_number")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[my-comments] Falha ao buscar comentários", describeSupabaseError(error));
        throw error;
      }

      const rows = data ?? [];
      const movieIds = [...new Set(rows.filter((r) => r.media_type === "movie").map((r) => r.media_id))];
      const seriesIds = [...new Set(rows.filter((r) => r.media_type === "series").map((r) => r.media_id))];
      const summaries = await fetchDisplaySummaries(movieIds, seriesIds);

      return rows.map((r) => {
        const summary = r.media_type === "movie" ? summaries.movies[r.media_id] : summaries.series[r.media_id];
        return {
          id: r.id,
          body: r.body,
          containsSpoiler: r.contains_spoiler,
          createdAt: r.created_at,
          mediaType: r.media_type as "movie" | "series",
          mediaId: r.media_id,
          seasonNumber: r.season_number,
          episodeNumber: r.episode_number,
          mediaTitle: summary?.title ?? "Título indisponível",
          mediaPosterPath: summary?.posterPath ?? null,
          targetUrl: buildTargetUrl(r.media_type as "movie" | "series", r.media_id, r.season_number, r.episode_number, r.id),
        };
      });
    },
  });
}
