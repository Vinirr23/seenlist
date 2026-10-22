// supabase/functions/series-data/index.ts
//
// FASE 1 (migração mobile sem Vercel, 2026-10-20) — porta QUATRO rotas
// web numa função só, a pedido explícito do usuário ("reutilize a
// lógica existente nas duas rotas, preferencialmente em uma única
// Edge Function com operações distintas, se isso simplificar a
// implementação"):
//
//   operation "details"            ← apps/web/app/api/tmdb/series/[id]/route.ts
//                                     (tela de detalhe da série — todas as temporadas)
//   operation "episode-context"    ← apps/web/app/api/tmdb/series/[id]/season/[season]/episode-context/route.ts
//                                     (tela de Episódio — só temporada anterior/atual/seguinte)
//   operation "episode"            ← apps/web/app/api/tmdb/episode/[seriesId]/[season]/[episode]/route.ts
//                                     (tela de Episódio — detalhe + onde assistir)
//   operation "episodes-at-export" ← apps/web/app/api/tmdb/series-episodes-at-export/route.ts
//                                     (recalcular status Em dia/Concluída ao marcar episódio —
//                                     CONTINUAÇÃO DA FASE 1, 2026-10-20, varredura das rotas
//                                     pendentes; entrou AQUI, não em `tmdb-catalog`, porque
//                                     compartilha a mesma `getSeasonEpisodes`/efeito colateral
//                                     das duas primeiras — "reutilize as Edge Functions
//                                     existentes quando fizer sentido")
//
// "details", "episode-context" e "episodes-at-export" compartilham a
// MESMA dependência que as obriga a ser Edge Function em vez de
// chamada direta à TMDB do mobile: todas chamam `getSeasonEpisodes`
// (`apps/web/lib/tmdb/client.ts` / `_shared/tmdbSeries.ts`), que grava
// em `series_season_episode_counts` (emblema "Temporada Concluída",
// só gravável com a chave de serviço).
//
// "episode" é diferente — `getEpisodeDetails`+`getSeriesWatchProviders`
// não têm NENHUM efeito colateral no Supabase, seriam seguras pra
// chamada DIRETA da TMDB a partir do mobile. Entrou aqui mesmo assim
// por DECISÃO EXPLÍCITA do usuário (2026-10-20, ver AskUserQuestion):
// `TMDB_API_KEY` no `.env` do mobile não tem o prefixo `EXPO_PUBLIC_`
// hoje (não é lida pelo bundle do app em runtime) — marcá-la como
// pública exporia a chave no JS do app, e o usuário preferiu manter a
// chave só no servidor (igual é hoje na Vercel) a fazer essa mudança
// de modelo de credencial. Reaproveita a mesma function por já estar
// no mesmo domínio (série/episódio) e já importar `_shared/tmdbSeries.ts`.
//
// Nenhuma rota em `apps/web` foi tocada — isto é uma CÓPIA fiel.
//
// AUTENTICAÇÃO — mesmo modelo de `library-summaries`/`season-recap`:
// token da sessão / anon key verificado automaticamente pelo Supabase
// (`verify_jwt`), nenhuma lógica extra aqui.

// CORREÇÃO (2026-10-20, erro real de `deno check` reportado pelo
// usuário — ver `_shared/database.ts` pra causa raiz completa) —
// `createClient(...)` sem um `Database` genérico explícito faz
// `ReturnType<typeof createClient>` (usado nas assinaturas de
// `handleDetails`/`handleEpisodeContext`/`handleEpisodesAtExport`
// abaixo) resolver pra um tipo DIFERENTE do cliente real criado com
// argumentos. Corrigido com `createClient<Database>(...)` +
// `SupabaseClient<Database>`.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonResponse, CORS_HEADERS } from "../_shared/tmdb.ts";
import {
  getSeriesDetails,
  getSeriesSeasonList,
  getSeasonEpisodes,
  getEpisodeDetails,
  getSeriesWatchProviders,
  getAllEpisodesWithAirDates,
  type Episode,
} from "../_shared/tmdbSeries.ts";
import type { Database } from "../_shared/database.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------------------------------------------------------------
// Operação "details" — mesmo payload de
// `apps/web/app/api/tmdb/series/[id]/route.ts`: detalhes + TODAS as
// temporadas, cada uma com a lista completa de episódios.
// ---------------------------------------------------------------
interface SeasonWithEpisodes {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

async function handleDetails(supabase: SupabaseClient<Database>, seriesId: string, language: string) {
  const [details, seasonList] = await Promise.all([
    getSeriesDetails(seriesId, language),
    getSeriesSeasonList(seriesId, language),
  ]);

  const seasons: SeasonWithEpisodes[] = await Promise.all(
    seasonList.map(async (season) => ({
      seasonNumber: season.seasonNumber,
      name: season.name,
      episodes: await getSeasonEpisodes(supabase, seriesId, season.seasonNumber, language),
    }))
  );

  return { ...details, seasons };
}

// ---------------------------------------------------------------
// Operação "episode-context" — mesmo payload de
// `apps/web/app/api/tmdb/series/[id]/season/[season]/episode-context/route.ts`:
// só título/elenco (personagem de anime) + NÚMERO de cada episódio da
// temporada anterior/atual/seguinte (pra "anterior/próximo" na tela
// de Episódio).
// ---------------------------------------------------------------
interface EpisodeContextSeason {
  seasonNumber: number;
  episodes: { seasonNumber: number; episodeNumber: number }[];
}

async function handleEpisodeContext(supabase: SupabaseClient<Database>, seriesId: string, seasonNumber: number, language: string) {
  const [details, seasonList] = await Promise.all([
    getSeriesDetails(seriesId, language),
    getSeriesSeasonList(seriesId, language),
  ]);

  const sortedSeasonNumbers = seasonList.map((s) => s.seasonNumber).sort((a, b) => a - b);
  const currentIndex = sortedSeasonNumbers.indexOf(seasonNumber);
  const neededSeasonNumbers = [
    ...new Set(
      [
        currentIndex > 0 ? sortedSeasonNumbers[currentIndex - 1] : undefined,
        sortedSeasonNumbers[currentIndex] ?? seasonNumber,
        currentIndex >= 0 && currentIndex < sortedSeasonNumbers.length - 1 ? sortedSeasonNumbers[currentIndex + 1] : undefined,
      ].filter((n): n is number => n !== undefined)
    ),
  ];

  const seasons: EpisodeContextSeason[] = await Promise.all(
    neededSeasonNumbers.map(async (sn) => {
      const episodes = await getSeasonEpisodes(supabase, seriesId, sn, language);
      return {
        seasonNumber: sn,
        episodes: episodes.map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })),
      };
    })
  );

  return {
    title: details.title,
    matchTitle: details.matchTitle,
    firstAirDate: details.firstAirDate,
    cast: details.cast,
    seasons,
  };
}

// ---------------------------------------------------------------
// Operação "episode" — mesmo payload de
// `apps/web/app/api/tmdb/episode/[seriesId]/[season]/[episode]/route.ts`:
// detalhe de UM episódio + onde assistir a SÉRIE (TMDB não tem
// providers por episódio). SEM efeito colateral no Supabase — não
// recebe `supabase` de propósito (ver comentário grande no topo do
// arquivo pro porquê desta operação estar aqui mesmo assim).
// ---------------------------------------------------------------
async function handleEpisode(seriesId: string, seasonNumber: number, episodeNumber: number, language: string) {
  const [episode, watchProviders] = await Promise.all([
    getEpisodeDetails(seriesId, seasonNumber, episodeNumber, language),
    getSeriesWatchProviders(seriesId).catch((error) => {
      console.error(`[series-data] Falha ao buscar providers da série ${seriesId}`, error);
      return [];
    }),
  ]);
  return { episode, watchProviders };
}

// ---------------------------------------------------------------
// Operação "episodes-at-export" — mesmo payload de
// `apps/web/app/api/tmdb/series-episodes-at-export/route.ts`: VÁRIAS
// séries de uma vez (não uma só, diferente das outras 3 operações),
// cada uma com a lista completa de episódios (todas as temporadas,
// com air_date e episodeId) + `failedIds` pras que falharam depois de
// todas as tentativas — mesmo contrato exato, inclusive o
// `Promise.allSettled` no nível de série (uma série com problema não
// derruba as outras do lote).
// ---------------------------------------------------------------
const MAX_EPISODES_AT_EXPORT_IDS = 20; // mesmo limite da rota original

interface EpisodesAtExportResult {
  id: number;
  episodes: { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null; episodeId: number }[];
}

async function handleEpisodesAtExport(supabase: SupabaseClient<Database>, seriesIds: number[], language: string) {
  const settled = await Promise.allSettled(
    seriesIds.map(async (id) => ({
      id,
      episodes: await getAllEpisodesWithAirDates(supabase, String(id), language),
    }))
  );

  const series: EpisodesAtExportResult[] = [];
  const failedIds: number[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      series.push({
        id: outcome.value.id,
        episodes: outcome.value.episodes.map((e) => ({
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          name: e.name,
          airDate: e.airDate,
          episodeId: e.id,
        })),
      });
    } else {
      failedIds.push(seriesIds[index]!);
      console.error(
        `[series-data] Falha ao buscar episódios da série ${seriesIds[index]} (episodes-at-export) — as demais não são afetadas.`,
        outcome.reason
      );
    }
  });

  return { series, failedIds };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: Partial<{
    operation: string;
    seriesId: string | number;
    seriesIds: number[];
    season: number;
    episode: number;
    language: string;
  }>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[series-data] Corpo da requisição inválido.", error);
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const language = body.language || "pt-BR";
  const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

  // "episodes-at-export" tem um formato de corpo diferente das outras
  // 3 operações (lista de séries, não uma só) — tratada antes da
  // validação de `seriesId` único, que não se aplica a ela.
  if (body.operation === "episodes-at-export") {
    const seriesIds = Array.isArray(body.seriesIds)
      ? body.seriesIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, MAX_EPISODES_AT_EXPORT_IDS)
      : [];
    try {
      const payload = await handleEpisodesAtExport(supabase, seriesIds, language);
      return jsonResponse(payload);
    } catch (error) {
      console.error("[series-data] Falha inesperada em episodes-at-export.", error);
      return jsonResponse({ error: "Não foi possível carregar os dados agora." }, 502);
    }
  }

  const seriesId = String(body.seriesId ?? "");
  if (!seriesId || !Number.isInteger(Number(seriesId)) || Number(seriesId) <= 0) {
    return jsonResponse({ error: "Série inválida." }, 400);
  }

  try {
    if (body.operation === "details") {
      const payload = await handleDetails(supabase, seriesId, language);
      return jsonResponse(payload);
    }

    if (body.operation === "episode-context") {
      const seasonNumber = Number(body.season);
      if (!Number.isInteger(seasonNumber)) {
        return jsonResponse({ error: "Temporada inválida." }, 400);
      }
      const payload = await handleEpisodeContext(supabase, seriesId, seasonNumber, language);
      return jsonResponse(payload);
    }

    if (body.operation === "episode") {
      const seasonNumber = Number(body.season);
      const episodeNumber = Number(body.episode);
      if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
        return jsonResponse({ error: "Temporada/episódio inválidos." }, 400);
      }
      const payload = await handleEpisode(seriesId, seasonNumber, episodeNumber, language);
      return jsonResponse(payload);
    }

    return jsonResponse({ error: "Operação inválida. Use 'details', 'episode-context', 'episode' ou 'episodes-at-export'." }, 400);
  } catch (error) {
    console.error(`[series-data] Falha ao carregar operação "${body.operation}" da série ${seriesId}.`, error);
    return jsonResponse({ error: "Não foi possível carregar os dados agora." }, 502);
  }
});
