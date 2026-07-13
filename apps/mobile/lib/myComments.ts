import { supabase } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

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
}

/**
 * TASK-116 (correção — Perfil) — porta de `my-comments.ts`.
 * Reaproveita `fetchDisplaySummaries` (mesma função que a
 * Biblioteca/Atividade já usam) — nenhuma integração nova com o
 * TMDB, uma chamada em lote pros ids únicos, não uma por comentário.
 */
export async function fetchMyComments(): Promise<MyComment[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("comments")
    .select("id, body, contains_spoiler, created_at, media_type, media_id, season_number, episode_number")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

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
    };
  });
}

export async function deleteMyComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
  if (error) throw error;
}
