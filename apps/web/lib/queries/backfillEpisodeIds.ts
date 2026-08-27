import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";

const CONCURRENCY = 10;
const TMDB_EPISODES_CHUNK_SIZE = 20; // mesmo limite de /api/tmdb/series-episodes-at-export (MAX_IDS_PER_REQUEST), ver seriesCategoryRecalc.ts

export interface BackfillEpisodeIdsResult {
  totalSeriesScanned: number;
  seriesUpdated: number;
  episodesUpdated: number;
  seriesSkippedRestructured: number;
  seriesSkippedRestructuredIds: number[];
  seriesSkippedError: number;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

interface LiveEpisode {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
  episodeId: number;
}

/**
 * CORREÇÃO (bug real, reportado com print de erro — "Variável de
 * ambiente ausente: TMDB_API_KEY") — a primeira versão desta função
 * chamava `getAllEpisodesWithAirDates`/`getSeriesSeasonList`
 * (`lib/tmdb/client.ts`) DIRETO daqui, um módulo que roda no
 * NAVEGADOR (importado por uma página "use client"). `TMDB_API_KEY`
 * (`lib/env.ts`) é lido sem o prefixo `NEXT_PUBLIC_` DE PROPÓSITO —
 * é uma chave de servidor, nunca embutida no JS que roda no
 * navegador — então a chamada sempre falhava, pra qualquer usuário,
 * na hora de buscar dado da TMDB (o Next.js "engolia" o erro dentro
 * de cada `Promise.all` do loop de séries, e a tela terminava
 * mostrando "0 episódios atualizados em 0 séries" como se não
 * houvesse nada a corrigir — um segundo bug, de mascarar a falha como
 * sucesso vazio, corrigido junto: ver `seriesSkippedError` sendo
 * exibido na tela de resultado agora).
 *
 * Corrigido buscando os dados da TMDB através da MESMA rota de
 * servidor que o resto do app já usa pra isso —
 * `/api/tmdb/series-episodes-at-export` (usada por
 * `seriesCategoryRecalc.ts`/`seriesEpisodesLight.ts`) — em vez de
 * chamar a biblioteca da TMDB direto do navegador.
 */
async function fetchLiveEpisodesBySeriesId(seriesIds: number[]): Promise<Map<number, LiveEpisode[]>> {
  const result = new Map<number, LiveEpisode[]>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);
  const responses = await Promise.all(
    chunks.map((idsChunk) =>
      fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: idsChunk }),
      })
    )
  );
  for (const response of responses) {
    if (!response.ok) continue;
    const data = (await response.json()) as { series: { id: number; episodes: LiveEpisode[] }[] };
    for (const s of data.series) result.set(s.id, s.episodes);
  }
  return result;
}

/**
 * "Motor resistente" — Etapa 4 (backfill), 2026-08-26. Preenche
 * retroativamente `tmdb_episode_id` nas linhas de `watched_episodes`
 * que já existem no banco e ainda não têm esse campo (a Etapa 2 só
 * grava o ID em marcações NOVAS a partir de quando foi entregue — o
 * histórico anterior fica sem, até isto rodar).
 *
 * Mesmo padrão de `repairAllSeriesCategories` (RLS, escopo do próprio
 * usuário logado, sem chave de serviço) — cada usuário roda pra si
 * mesmo, sem precisar de nenhum acesso administrativo.
 *
 * SEGURANÇA (raiz do motivo de existir a "Etapa 4" separada da 5,
 * remapeamento por Episode Groups) — pra série que a TMDB já
 * reestruturou (fundiu/renumerou temporadas), a numeração atual da
 * TMDB não corresponde mais à numeração usada quando o episódio foi
 * marcado como assistido. Preencher o ID usando a numeração ATUAL
 * nesse caso gravaria o ID de um episódio DIFERENTE do que foi
 * realmente assistido — pior do que deixar em branco. Por isso: antes
 * de mexer em qualquer linha de uma série, checa (mesmo sinal já usado
 * em `scan-season-mismatches/route.ts`) se alguma temporada assistida
 * não existe mais na estrutura atual da TMDB (aqui, derivada da própria
 * lista de episódios ao vivo devolvida pela rota — nenhuma chamada
 * extra precisa) — se sim, a série INTEIRA é pulada (nenhuma linha
 * dela é tocada), ficando pra o remapeamento manual via Episode Groups
 * (trabalho separado). Dentro de uma série que passa nessa checagem,
 * cada linha só é preenchida se achar uma correspondência exata
 * (temporada, episódio) na lista atual da TMDB — sem correspondência,
 * a linha fica como está, sem arriscar um palpite.
 */
export async function backfillWatchedEpisodeIds(
  onProgress?: (done: number, total: number) => void
): Promise<BackfillEpisodeIdsResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) throw new Error("not authenticated");

  // Mesmo padrão de paginação+ordenação já corrigido em
  // `repairSeriesCategories.ts`/`seriesCategoryRecalc.ts` — sem
  // `.order()` explícito antes do `.range()`, o Postgres/PostgREST não
  // garante página determinística, o que já causou reclassificação
  // errada em massa antes (ver SEENLIST-HANDOFF.md).
  const PAGE_SIZE = 1000;
  const { count, error: countError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("tmdb_episode_id", null);
  if (countError) throw countError;

  const total = count ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id, season_number, episode_number")
        .eq("user_id", user.id)
        .is("tmdb_episode_id", null)
        .order("series_id", { ascending: true })
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
    })
  );

  type Row = { series_id: number; season_number: number; episode_number: number };
  const rowsBySeriesId = new Map<number, Row[]>();
  for (const page of pages) {
    if (page.error) throw page.error;
    for (const row of (page.data ?? []) as Row[]) {
      const list = rowsBySeriesId.get(row.series_id) ?? [];
      list.push(row);
      rowsBySeriesId.set(row.series_id, list);
    }
  }

  const seriesIds = [...rowsBySeriesId.keys()];
  onProgress?.(0, seriesIds.length);

  let seriesUpdated = 0;
  let episodesUpdated = 0;
  let seriesSkippedRestructured = 0;
  const seriesSkippedRestructuredIds: number[] = [];
  let seriesSkippedError = 0;

  for (let start = 0; start < seriesIds.length; start += CONCURRENCY) {
    const batch = seriesIds.slice(start, start + CONCURRENCY);
    // Busca em lote (até 20 séries por requisição — ver
    // `fetchLiveEpisodesBySeriesId`), uma vez por leva de
    // concorrência, em vez de uma chamada de rede por série.
    const liveEpisodesBySeriesId = await fetchLiveEpisodesBySeriesId(batch);

    await Promise.all(
      batch.map(async (seriesId) => {
        const seriesRows = rowsBySeriesId.get(seriesId) ?? [];
        const liveEpisodes = liveEpisodesBySeriesId.get(seriesId);

        // Série ausente da resposta (falhou na TMDB do lado do
        // servidor) ou sem nenhum episódio devolvido — não dá pra
        // avaliar com segurança, não mexe em nada dela.
        if (!liveEpisodes || liveEpisodes.length === 0) {
          seriesSkippedError++;
          return;
        }

        try {
          // Mesmo sinal de "reestruturada" já usado em
          // scan-season-mismatches/route.ts — uma temporada assistida
          // que simplesmente não existe mais na estrutura atual da
          // TMDB (aqui, o maior season_number entre os episódios ao
          // vivo devolvidos). Encontrado isso pra qualquer linha da
          // série, a série INTEIRA fica de fora do backfill (ver
          // comentário grande no topo do arquivo).
          const currentMaxSeason = Math.max(...liveEpisodes.map((e) => e.seasonNumber));
          const looksRestructured = seriesRows.some((row) => row.season_number > currentMaxSeason);
          if (looksRestructured) {
            seriesSkippedRestructured++;
            seriesSkippedRestructuredIds.push(seriesId);
            return;
          }

          const episodeIdByKey = new Map<string, number>();
          for (const episode of liveEpisodes) {
            episodeIdByKey.set(`${episode.seasonNumber}-${episode.episodeNumber}`, episode.episodeId);
          }

          let seriesHadUpdate = false;
          for (const row of seriesRows) {
            const episodeId = episodeIdByKey.get(`${row.season_number}-${row.episode_number}`);
            // Sem correspondência exata — não arrisca, não grava (linha fica como está).
            if (episodeId === undefined) continue;

            // Sem coluna `id` própria em watched_episodes (chave
            // primária composta) — atualiza pela mesma combinação já
            // usada como identidade em todo o resto do código.
            const { error: updateError } = await supabase
              .from("watched_episodes")
              .update({ tmdb_episode_id: episodeId })
              .eq("user_id", user.id)
              .eq("series_id", seriesId)
              .eq("season_number", row.season_number)
              .eq("episode_number", row.episode_number);
            if (updateError) throw updateError;
            episodesUpdated++;
            seriesHadUpdate = true;
          }
          if (seriesHadUpdate) seriesUpdated++;
        } catch (error) {
          console.error(`[backfill-episode-ids] Falha ao processar a série ${seriesId}`, error);
          seriesSkippedError++;
        }
      })
    );
    onProgress?.(Math.min(start + CONCURRENCY, seriesIds.length), seriesIds.length);
  }

  return {
    totalSeriesScanned: seriesIds.length,
    seriesUpdated,
    episodesUpdated,
    seriesSkippedRestructured,
    seriesSkippedRestructuredIds,
    seriesSkippedError,
  };
}
