import type { WatchProvider } from "@seenlist/types";
import { supabase } from "@/lib/supabase";

export interface EpisodeDetails {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtimeMinutes: number | null;
  airDate: string | null;
  voteAverage: number | null;
}

export interface EpisodePageData {
  episode: EpisodeDetails;
  watchProviders: WatchProvider[];
}

/**
 * FASE 1 (migração mobile sem Vercel, 2026-10-20) — passou a chamar a
 * operação "episode" da Supabase Edge Function `series-data` em vez
 * da rota Vercel `/api/tmdb/episode/[seriesId]/[season]/[episode]`.
 * MESMO contrato de saída (`{ episode, watchProviders }` — ver
 * `supabase/functions/series-data/index.ts`). Esta rota, sozinha, não
 * tinha nenhum efeito colateral no Supabase e seria segura pra
 * chamada direta à TMDB do mobile — entrou na Edge Function por
 * decisão explícita do usuário, pra não expor `TMDB_API_KEY` no
 * bundle do app (ver comentário grande no topo de `series-data/index.ts`).
 */
export async function fetchEpisodePage(seriesId: string, season: number, episode: number, language = "pt-BR"): Promise<EpisodePageData> {
  const { data, error } = await supabase.functions.invoke("series-data", {
    body: { operation: "episode", seriesId, season, episode, language },
  });
  if (error) throw new Error("episode fetch failed");
  return data as EpisodePageData;
}
