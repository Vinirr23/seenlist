// supabase/functions/_shared/tmdbSeries.ts
//
// FASE 1 (migração mobile sem Vercel, 2026-10-20) — pedaço de
// `apps/web/lib/tmdb/client.ts` compartilhado pela Edge Function
// `series-data` (que atende os dois usos antigos — "detalhe da
// série" e "episode-context" — numa função só, a pedido explícito do
// usuário: "reutilize a lógica existente... preferencialmente em uma
// única Edge Function com operações distintas"). Extraído pra
// `_shared/` (mesmo padrão já usado por `weekBounds.ts`) só pra não
// duplicar código entre as duas operações.
//
// Texto/lógica idênticos a `apps/web/lib/tmdb/client.ts` — a rota web
// NÃO foi tocada, isto é uma CÓPIA fiel (Node → Deno não compartilham
// módulo direto neste monorepo).
//
// GRAVAÇÃO EM `series_season_episode_counts` (emblema "Temporada
// Concluída") — HISTÓRICO da correção em relação ao código original
// da Vercel (a pedido explícito do usuário: "garanta que falhas de
// gravação não passem despercebidas"): na rota web (Node/Vercel), essa
// gravação é fire-and-forget (`void cacheSeasonEpisodeCount(...)`) —
// a função serverless segue rodando até a promise terminar mesmo
// depois da resposta, então "soltar e esquecer" era seguro lá. O
// runtime de Edge Function da Supabase (Deno) NÃO garante isso pra uma
// promise realmente solta: ela pode ser interrompida quando a
// resposta já foi enviada e o isolado é reciclado.
//
// AJUSTE (2026-10-20, resposta ao 2º ponto levantado pelo usuário —
// "isso pode aumentar a latência... verificar se falhas de gravação
// não estão impedindo desnecessariamente o retorno dos dados da
// TMDB") — a 1ª versão desta correção usava `await` antes de devolver
// a resposta, o que RESOLVIA a garantia de execução mas introduzia uma
// latência nova (o round-trip do upsert) que a rota original da Vercel
// nunca tinha (lá era fire-and-forget de verdade). Troquei `await` por
// `EdgeRuntime.waitUntil(...)` — primitivo NATIVO do runtime de Edge
// Function da Supabase (mesmo usado em `enrich-media-countries/index.ts`
// pro job de enriquecimento inteiro) que resolve os dois lados ao
// mesmo tempo: mantém o isolado vivo até a promise terminar (garante a
// gravação, sem depender de sorte), MAS sem bloquear a resposta — a
// function devolve os dados da TMDB pro app assim que eles chegam,
// exatamente como a rota Vercel original fazia. Resultado: zero
// latência nova (restaura o comportamento original) + zero risco de
// perder a gravação (corrige o bug real do fire-and-forget em Deno).
// Responde também ao ponto 4 da validação pedida: como a gravação
// nunca bloqueia a resposta (nem bloqueava antes, nem bloqueia agora
// com `waitUntil`), uma falha nela não pode, por construção, impedir o
// retorno dos dados da TMDB — o `try/catch` interno de
// `cacheSeasonEpisodeCount` garante isso mesmo pra quem lê sua
// promise depois.
//
// CORREÇÃO (2026-10-20, erro real de `deno check` reportado pelo
// usuário em `season-recap` e `series-data`) — todas as funções deste
// arquivo que recebem `supabase` como parâmetro usavam
// `ReturnType<typeof createClient>` pra tipar o parâmetro. Sem um
// `Database` genérico explícito, essa expressão resolve pelos
// DEFAULTS da declaração de tipos do `createClient` desta versão do
// `@supabase/supabase-js` — que são `Database = unknown`, o que faz o
// nome do schema cair pra `never` (já que `keyof unknown` é `never`) —
// DIFERENTE do tipo do cliente real criado com argumentos
// (`SupabaseClient<any, "public", ...>`). Daí os erros reais:
// "Type '\"public\"' is not assignable to type 'never'" em toda
// chamada que passava o cliente real pra uma função tipada assim, e
// "'series_id' does not exist in type 'never[]'" no `.upsert()` logo
// abaixo (sem `Database`, `.from(tabela)` não sabe o formato da linha
// e cai no tipo mais restritivo, `never`). Corrigido importando o
// `Database` real (ver `_shared/database.ts`, descreve as 3 tabelas
// que esta fase lê/grava — sem nenhuma migration, só a descrição do
// que já existe) e usando `SupabaseClient<Database>` em vez de
// `ReturnType<typeof createClient>` em toda assinatura deste arquivo.
// `createClient` não precisa mais ser importado aqui — nenhuma função
// deste arquivo CRIA um cliente, só recebe um já criado pelo chamador.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Database } from "./database.ts";
import { tmdbGet, translateTvGenreName, dedupeWatchProviders } from "./tmdb.ts";

export { translateTvGenreName };

/**
 * `series_season_episode_counts` — chamada via `EdgeRuntime.waitUntil`
 * pelo chamador (ver comentário grande no topo do arquivo), nunca
 * `await`-ada diretamente. Nunca lança: uma falha de gravação é só um
 * cache de emblema desatualizado, nunca algo que deva quebrar a tela
 * do mobile — qualquer falha vai pro log com `console.error` (visível
 * com destaque em Supabase → Edge Functions → Logs), não mais
 * `console.warn`.
 */
export async function cacheSeasonEpisodeCount(
  supabase: SupabaseClient<Database>,
  seriesId: string,
  seasonNumber: number,
  episodeCount: number
): Promise<void> {
  if (episodeCount <= 0) return;
  try {
    const { error } = await supabase.from("series_season_episode_counts").upsert(
      {
        series_id: Number(seriesId),
        season_number: seasonNumber,
        episode_count: episodeCount,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "series_id,season_number" }
    );
    if (error) {
      console.error(
        `[tmdbSeries] FALHA AO GRAVAR series_season_episode_counts (série ${seriesId}, temporada ${seasonNumber}) — emblema "Temporada Concluída" pode ficar desatualizado pra esta temporada.`,
        error.message
      );
    }
  } catch (err) {
    console.error(
      `[tmdbSeries] FALHA AO GRAVAR series_season_episode_counts (série ${seriesId}, temporada ${seasonNumber}) — emblema "Temporada Concluída" pode ficar desatualizado pra esta temporada.`,
      err
    );
  }
}

export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  stillPath: string | null;
  runtimeMinutes: number | null;
  airDate: string | null;
}

interface TmdbSeasonResponse {
  episodes: {
    id: number;
    season_number: number;
    episode_number: number;
    name: string;
    still_path: string | null;
    runtime: number | null;
    air_date: string | null;
  }[];
}

/**
 * Lista de episódios de UMA temporada — mesma função de
 * `apps/web/lib/tmdb/client.ts`, com a gravação do cache de contagem
 * AGUARDADA (ver comentário grande no topo do arquivo), não mais
 * fire-and-forget.
 */
export async function getSeasonEpisodes(
  supabase: SupabaseClient<Database>,
  seriesId: string,
  seasonNumber: number,
  language = "pt-BR"
): Promise<Episode[]> {
  const data = await tmdbGet<TmdbSeasonResponse>(`/tv/${seriesId}/season/${seasonNumber}`, { language });
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(cacheSeasonEpisodeCount(supabase, seriesId, seasonNumber, data.episodes.length));

  return data.episodes.map((episode) => ({
    id: episode.id,
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    name: episode.name,
    stillPath: episode.still_path,
    runtimeMinutes: episode.runtime,
    airDate: episode.air_date,
  }));
}

// ---------------------------------------------------------------
// CONTINUAÇÃO DA FASE 1 (2026-10-20) — `getAllEpisodesWithAirDates`,
// usada pela operação "episodes-at-export" de `series-data`
// (substitui `/api/tmdb/series-episodes-at-export`). Cópia fiel de
// `apps/web/lib/tmdb/client.ts`: busca episódios de TODAS as
// temporadas em levas de `SEASON_FETCH_BATCH_SIZE` (reduz o tamanho da
// rajada de chamadas simultâneas ao TMDB — mesma correção real
// aplicada lá pro caso de catálogo grande, ex. Bleach); se QUALQUER
// temporada falhar mesmo após o retry de `tmdbGet`, a função inteira
// LANÇA (lista de episódios incompleta não é tratada como sucesso) —
// quem chama (`series-data/index.ts`) já sabe lidar com isso via
// `Promise.allSettled` + `failedIds`, mesmo padrão da rota original.
// Usa a MESMA `getSeasonEpisodes` acima — herda a mesma gravação de
// `series_season_episode_counts` via `EdgeRuntime.waitUntil` (zero
// código novo pra esse efeito colateral, só reaproveitado).
// ---------------------------------------------------------------
const SEASON_FETCH_BATCH_SIZE = 5;

interface TmdbSeriesSeasonsResponse {
  seasons: { season_number: number; episode_count: number }[];
}

export async function getAllEpisodesWithAirDates(
  supabase: SupabaseClient<Database>,
  seriesId: string,
  language = "pt-BR"
): Promise<Episode[]> {
  const seasonsData = await tmdbGet<TmdbSeriesSeasonsResponse>(`/tv/${seriesId}`);
  const seasonNumbers = seasonsData.seasons.filter((s) => s.season_number >= 1).map((s) => s.season_number);

  const episodes: Episode[] = [];
  const failedSeasons: number[] = [];
  for (let i = 0; i < seasonNumbers.length; i += SEASON_FETCH_BATCH_SIZE) {
    const batch = seasonNumbers.slice(i, i + SEASON_FETCH_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((n) => getSeasonEpisodes(supabase, seriesId, n, language)));
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        episodes.push(...outcome.value);
      } else {
        failedSeasons.push(batch[index]!);
        console.error(
          `[tmdbSeries] Falha ao buscar temporada ${batch[index]} da série ${seriesId} — as demais temporadas continuam sendo buscadas, mas a função vai lançar no final (lista incompleta não é confiável).`,
          outcome.reason
        );
      }
    });
  }

  if (failedSeasons.length > 0) {
    throw new Error(
      `${failedSeasons.length} de ${seasonNumbers.length} temporada(s) da série ${seriesId} falharam ao buscar (temporadas: ${failedSeasons.join(", ")}) — lista de episódios incompleta, não é seguro tratar como sucesso.`
    );
  }

  return episodes;
}

export interface SeasonEpisodeOverview {
  episodeNumber: number;
  name: string;
  overview: string;
}

interface TmdbSeasonWithOverviewResponse {
  episodes: { episode_number: number; name: string; overview: string | null }[];
}

/**
 * Usada pelo season-recap (`apps/web/lib/tmdb/client.ts` →
 * `getSeasonEpisodesWithOverview`) — mesmos campos de
 * `getSeasonEpisodes` só que com a sinopse de cada episódio, e com a
 * MESMA gravação de cache (agora aguardada — ver comentário grande no
 * topo do arquivo).
 */
export async function getSeasonEpisodesWithOverview(
  supabase: SupabaseClient<Database>,
  seriesId: string,
  seasonNumber: number,
  language = "pt-BR"
): Promise<SeasonEpisodeOverview[]> {
  const data = await tmdbGet<TmdbSeasonWithOverviewResponse>(`/tv/${seriesId}/season/${seasonNumber}`, { language });
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(cacheSeasonEpisodeCount(supabase, seriesId, seasonNumber, data.episodes.length));

  return data.episodes.map((episode) => ({
    episodeNumber: episode.episode_number,
    name: episode.name,
    overview: episode.overview ?? "",
  }));
}

export async function getSeriesSeasonList(seriesId: string, language = "pt-BR"): Promise<{ seasonNumber: number; name: string }[]> {
  const data = await tmdbGet<{ seasons: { season_number: number; name: string }[] }>(`/tv/${seriesId}`, { language });
  return data.seasons.filter((season) => season.season_number > 0).map((season) => ({ seasonNumber: season.season_number, name: season.name }));
}

// ---------------------------------------------------------------
// Watch providers de série — mesma dedupe de marca de
// `apps/web/lib/tmdb/client.ts` (Netflix/Netflix Standard with Ads,
// Paramount Plus/Paramount+, etc.).
// ---------------------------------------------------------------
export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

// `normalizeProviderName`/`dedupeWatchProviders` movidos pra
// `_shared/tmdb.ts` (2026-10-20, continuação da Fase 1) — `tmdbCatalog.ts`
// (getMovieDetails) também precisa deles, sem duplicar.

const WATCH_PROVIDERS_REGION = "BR";

interface TmdbSeriesWatchProvidersResponse {
  results?: Record<string, { flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[] }>;
}

export async function getSeriesWatchProviders(seriesId: string): Promise<WatchProvider[]> {
  const data = await tmdbGet<TmdbSeriesWatchProvidersResponse>(`/tv/${seriesId}/watch/providers`);
  const regionProviders = data.results?.[WATCH_PROVIDERS_REGION];
  const providers: WatchProvider[] = (regionProviders?.flatrate ?? []).map((provider) => ({
    id: provider.provider_id,
    name: provider.provider_name,
    logoPath: provider.logo_path,
  }));
  return dedupeWatchProviders(providers);
}

// ---------------------------------------------------------------
// Detalhe de UM episódio — mesma função de
// `apps/web/lib/tmdb/client.ts` (`getEpisodeDetails`). SEM nenhum
// efeito colateral no Supabase (diferente de `getSeasonEpisodes`
// acima) — passthrough puro de TMDB, por isso usada pela operação
// "episode" de `series-data` só pra não expor `TMDB_API_KEY` no
// bundle do app (decisão do usuário, 2026-10-20: Edge Function também
// pra esta rota, em vez de marcar a chave como `EXPO_PUBLIC_`).
// ---------------------------------------------------------------
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

interface TmdbEpisodeDetailsResponse {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
  vote_average: number | null;
}

export async function getEpisodeDetails(seriesId: string, seasonNumber: number, episodeNumber: number, language = "pt-BR"): Promise<EpisodeDetails> {
  const data = await tmdbGet<TmdbEpisodeDetailsResponse>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`, { language });
  return {
    id: data.id,
    seasonNumber: data.season_number,
    episodeNumber: data.episode_number,
    name: data.name,
    overview: data.overview,
    stillPath: data.still_path,
    runtimeMinutes: data.runtime,
    airDate: data.air_date,
    voteAverage: data.vote_average,
  };
}

// ---------------------------------------------------------------
// Detalhes completos da série — mesma lógica de `getSeriesDetails`
// (apps/web/lib/tmdb/client.ts): elenco, trailer, galeria,
// recomendações/similares, matchTitle (pro anime/MyAnimeList),
// certificação BR. Usado pela operação "details" de `series-data`.
// ---------------------------------------------------------------
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface MediaSearchResult {
  id: number;
  mediaType: "movie" | "series";
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage?: number;
  popularity?: number;
  originalTitle?: string;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
  overview: string | null;
}

export interface SeriesDetailsWithoutSeasons {
  id: number;
  title: string;
  matchTitle: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  firstAirDate: string | null;
  status: string;
  inProduction: boolean;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  genres: string[];
  networks: string[];
  creators: string[];
  country: string | null;
  language: string | null;
  voteAverage: number;
  voteCount: number;
  trailerKey: string | null;
  gallery: string[];
  cast: CastMember[];
  watchProviders: WatchProvider[];
  similar: MediaSearchResult[];
  certification: string | null;
  seasonSummaries: SeasonSummary[];
}

interface TmdbTvDetailsResponse {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  status: string;
  in_production: boolean;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  networks: { name: string }[];
  created_by: { name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  original_language: string;
  vote_average: number;
  vote_count: number;
  seasons: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null; overview: string | null }[];
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
  recommendations?: { results: TmdbSearchItemLike[] };
  similar?: { results: TmdbSearchItemLike[] };
  alternative_titles?: { results: { iso_3166_1: string; title: string }[] };
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] };
  images?: { backdrops: { file_path: string }[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
}

interface TmdbSearchItemLike {
  id: number;
  media_type?: "movie" | "tv" | "person";
  name?: string;
  original_name?: string;
  first_air_date?: string;
  poster_path: string | null;
  popularity?: number;
  vote_average?: number;
}

function normalizeSeriesSearchItem(item: TmdbSearchItemLike): MediaSearchResult {
  return {
    id: item.id,
    mediaType: "series",
    title: item.name ?? "Sem título",
    year: item.first_air_date ? Number(item.first_air_date.slice(0, 4)) || null : null,
    posterPath: item.poster_path,
    voteAverage: item.vote_average,
    popularity: item.popularity,
    originalTitle: item.original_name && item.original_name.length > 0 ? item.original_name : undefined,
  };
}

function pickTitleForExternalMatching(data: TmdbTvDetailsResponse): string {
  const alternatives = data.alternative_titles?.results ?? [];
  const us = alternatives.find((t) => t.iso_3166_1 === "US" && t.title.trim().length > 0);
  if (us) return us.title;

  const gb = alternatives.find((t) => t.iso_3166_1 === "GB" && t.title.trim().length > 0);
  if (gb) return gb.title;

  const isBasicLatin = (s: string) => /^[\x20-\x7E]*$/.test(s);
  if (data.original_name && isBasicLatin(data.original_name)) return data.original_name;

  return data.name;
}

function pickBrazilianSeriesCertification(results: { iso_3166_1: string; rating: string }[] | undefined): string | null {
  const rating = results?.find((entry) => entry.iso_3166_1 === "BR")?.rating;
  return rating?.trim() || null;
}

export async function getSeriesDetails(seriesId: string, language = "pt-BR"): Promise<SeriesDetailsWithoutSeasons> {
  const [data, englishData, watchProviders] = await Promise.all([
    tmdbGet<TmdbTvDetailsResponse>(`/tv/${seriesId}`, {
      append_to_response: "credits,recommendations,similar,alternative_titles,videos,images,content_ratings",
      language,
      include_image_language: "null,pt-BR,en",
    }),
    tmdbGet<{ name: string }>(`/tv/${seriesId}`, { language: "en-US" }).catch(() => null),
    getSeriesWatchProviders(seriesId),
  ]);

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 15).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
  }));

  const recommended = data.recommendations?.results ?? [];
  const similarFallback = data.similar?.results ?? [];
  const similar: MediaSearchResult[] = (recommended.length > 0 ? recommended : similarFallback).slice(0, 12).map(normalizeSeriesSearchItem);

  const videos = data.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    videos.find((v) => v.site === "YouTube");
  const gallery = (data.images?.backdrops ?? []).slice(0, 8).map((img) => img.file_path);

  const seasonSummaries: SeasonSummary[] = data.seasons
    .filter((season) => season.season_number >= 1)
    .map((season) => ({
      seasonNumber: season.season_number,
      name: season.name,
      episodeCount: season.episode_count,
      airDate: season.air_date,
      posterPath: season.poster_path,
      overview: season.overview || null,
    }));

  return {
    id: data.id,
    title: data.name,
    matchTitle: englishData?.name ? englishData.name : pickTitleForExternalMatching(data),
    overview: data.overview,
    backdropPath: data.backdrop_path,
    posterPath: data.poster_path,
    firstAirDate: data.first_air_date,
    status: data.status,
    inProduction: data.in_production,
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    genres: data.genres.map((genre) => translateTvGenreName(genre.name, language)),
    networks: data.networks.map((network) => network.name),
    creators: data.created_by.map((creator) => creator.name),
    country: data.production_countries[0]?.name ?? null,
    language: data.original_language,
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    trailerKey: trailer?.key ?? null,
    gallery,
    cast,
    watchProviders,
    similar,
    certification: pickBrazilianSeriesCertification(data.content_ratings?.results),
    seasonSummaries,
  };
}
