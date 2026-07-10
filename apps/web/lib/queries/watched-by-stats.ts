import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface WatchedByStats {
  count: number;
  avatars: string[];
}

const SAMPLE_LIMIT = 3;

/**
 * TASK-058 — "pessoas que assistiram" nos cards do Feed. Dado real:
 * conta quantos usuários têm essa mídia em `movie_status`/
 * `series_status` (qualquer status — já é o sinal mais próximo de
 * "interagiu com isso" que existe), com uma amostra de avatares só
 * de perfis PÚBLICOS (respeitando a RLS de `profiles` — perfis
 * privados nunca aparecem na amostra, mesmo entrando na contagem).
 */
export function useWatchedByStats(mediaType: "movie" | "series", mediaId: number) {
  return useQuery({
    queryKey: ["watched-by", mediaType, mediaId],
    queryFn: async (): Promise<WatchedByStats> => {
      const supabase = createClient();
      const table = mediaType === "movie" ? "movie_status" : "series_status";
      const column = mediaType === "movie" ? "movie_id" : "series_id";

      const { count } = await supabase.from(table).select("user_id", { count: "exact", head: true }).eq(column, mediaId);

      const { data: statusRows } = await supabase.from(table).select("user_id").eq(column, mediaId).limit(20);

      let avatars: string[] = [];
      if (statusRows && statusRows.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("avatar_url")
          .in(
            "user_id",
            statusRows.map((r) => r.user_id)
          )
          .not("avatar_url", "is", null)
          .limit(SAMPLE_LIMIT);
        avatars = (profiles ?? []).map((p) => p.avatar_url).filter((url): url is string => Boolean(url));
      }

      return { count: count ?? 0, avatars };
    },
  });
}
