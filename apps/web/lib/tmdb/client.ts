import type {
  CastMember,
  Episode,
  MediaSearchResult,
  MediaType,
  MovieDetails,
  SeriesDetails,
  WatchProvider,
} from "@seenlist/types";
import { env } from "@/lib/env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * CORREÇÃO (bug real, investigado — Bleach preso em "Em dia" mesmo
 * com episódio pendente de verdade) — causa raiz: `tmdbGet` nunca
 * tentava de novo quando o TMDB respondia com erro passageiro (429 =
 * excesso de pedidos simultâneos, ou 5xx = instabilidade momentânea
 * do lado do TMDB). Isso não dava problema pra série comum (poucas
 * chamadas), mas `getAllEpisodesWithAirDates` (abaixo) dispara UMA
 * chamada por TEMPORADA — séries com catálogo muito grande (Bleach
 * tem mais de 15 temporadas no TMDB, um anime longo dividido por
 * arco de história) disparavam uma rajada grande o bastante pra
 * esbarrar em limite de requisições simultâneas. Quando isso
 * acontecia, a temporada que falhava era simplesmente descartada
 * (ver `Promise.allSettled` logo abaixo) — silenciosamente, sem
 * avisar ninguém — e se fosse justo a temporada com o episódio
 * pendente, o app concluía errado que a série estava "em dia".
 *
 * Só tenta de novo pra erros que fazem sentido tentar de novo (429/5xx
 * ou falha de rede) — erro "permanente" (404, por exemplo) continua
 * falhando na hora, sem atraso à toa. Respeita o cabeçalho
 * `Retry-After` do TMDB quando ele vem preenchido (é o próprio TMDB
 * dizendo quanto tempo esperar); sem isso, espera crescente (300ms,
 * depois 600ms) antes de desistir de vez.
 */
const TMDB_MAX_RETRIES = 2; // total de até 3 tentativas (1 original + 2 retentativas)
const TMDB_RETRY_BASE_DELAY_MS = 300;

function isRetryableTmdbStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Único helper de baixo nível que efetivamente chama api.themoviedb.org.
 * Todas as funções deste arquivo passam por aqui — é o que dá pra
 * chamar de "client centralizado" e evita duplicar a lógica de
 * montar URL/api_key/idioma em cada função.
 */
async function tmdbGet<T>(path: string, params: Record<string, string> = {}, revalidateSeconds = 300): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", env.tmdbApiKey());
  url.searchParams.set("language", "pt-BR");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  let lastError: unknown;
  for (let attempt = 0; attempt <= TMDB_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        // TMDB muda pouco de um minuto pro outro — 5 min de cache no
        // fetch do Next complementa (não substitui) o cache de 5 min do
        // React Query no client. Alguns dados (gênero, por exemplo) quase
        // NUNCA mudam — essas chamadas passam um `revalidateSeconds` bem
        // maior (ver `getGenreMap`), em vez de tratar tudo igual.
        next: { revalidate: revalidateSeconds },
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (!isRetryableTmdbStatus(response.status) || attempt === TMDB_MAX_RETRIES) {
        throw new Error(`TMDB respondeu ${response.status} em ${path}`);
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const delayMs = Number.isFinite(retryAfterMs) ? retryAfterMs : TMDB_RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.error(`[tmdb] Resposta ${response.status} em ${path} — tentando de novo em ${delayMs}ms (tentativa ${attempt + 1}/${TMDB_MAX_RETRIES}).`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === TMDB_MAX_RETRIES) throw error;
      await sleep(TMDB_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  // Inatingível na prática (o loop sempre retorna ou lança antes) — só pra satisfazer o typecheck.
  throw lastError instanceof Error ? lastError : new Error(`TMDB falhou em ${path}`);
}

/**
 * Formato bruto de item retornado por /search/multi — só os campos
 * que a gente de fato usa. TMDB também devolve `media_type: "person"`
 * nesse endpoint, por isso o filtro em `searchMovieAndSeries`.
 */
interface TmdbMultiSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string; // filmes
  name?: string; // séries
  original_title?: string; // filmes
  original_name?: string; // séries
  release_date?: string; // filmes
  first_air_date?: string; // séries
  poster_path: string | null;
  popularity?: number;
  vote_average?: number;
}

interface TmdbMultiSearchResponse {
  results: TmdbMultiSearchItem[];
}

function normalizeSearchItem(item: TmdbMultiSearchItem): MediaSearchResult {
  const mediaType: MediaType = item.media_type === "tv" ? "series" : "movie";
  const dateString = item.media_type === "tv" ? item.first_air_date : item.release_date;
  const originalTitle = item.media_type === "tv" ? item.original_name : item.original_title;

  return {
    id: item.id,
    mediaType,
    title: (item.media_type === "tv" ? item.name : item.title) ?? "Sem título",
    year: dateString ? Number(dateString.slice(0, 4)) || null : null,
    posterPath: item.poster_path,
    voteAverage: item.vote_average,
    popularity: item.popularity,
    originalTitle: originalTitle && originalTitle.length > 0 ? originalTitle : undefined,
  };
}

/** A rota `/api/search` é o único chamador. */
export async function searchMovieAndSeries(query: string, language = "pt-BR"): Promise<MediaSearchResult[]> {
  const data = await tmdbGet<TmdbMultiSearchResponse>("/search/multi", {
    query,
    include_adult: "false",
    language,
  });

  return data.results
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map(normalizeSearchItem);
}

// ---------------------------------------------------------------
// Busca por ID externo — TVDB/IMDb (TASK-027L, importador TV Time Out)
// ---------------------------------------------------------------

interface TmdbFindResponse {
  movie_results: { id: number; title: string; release_date?: string; poster_path: string | null; popularity?: number }[];
  tv_results: { id: number; name: string; first_air_date?: string; poster_path: string | null; popularity?: number }[];
}

export interface FindByExternalIdResult {
  tvdbId: string;
  source: "tvdb_id" | "imdb_id";
  seriesTmdbId: number | null;
  movieTmdbId: number | null;
  /** TASK-027Q — campos diagnósticos, só pra auditoria de matching. Não influenciam qual ID é escolhido (isso continua sendo results[0], intocado). */
  seriesName: string | null;
  seriesYear: number | null;
}

/**
 * TASK-027L — o novo importador prioriza TVDB ID (e IMDb ID como
 * segunda opção) em vez de buscar por nome — muito mais confiável
 * que o "Wrecked (2016)" vs "Wrecked" que motivou a TASK-027F. O
 * endpoint /find do TMDB aceita um id externo de cada vez; batching
 * acontece em quem chama isto (a rota da API), não aqui.
 */
export async function findByExternalId(
  externalId: string,
  source: "tvdb_id" | "imdb_id"
): Promise<FindByExternalIdResult> {
  const data = await tmdbGet<TmdbFindResponse>(`/find/${externalId}`, { external_source: source });

  return {
    tvdbId: externalId,
    source,
    seriesTmdbId: data.tv_results[0]?.id ?? null,
    movieTmdbId: data.movie_results[0]?.id ?? null,
    seriesName: data.tv_results[0]?.name ?? null,
    seriesYear: data.tv_results[0]?.first_air_date ? Number(data.tv_results[0].first_air_date.slice(0, 4)) || null : null,
  };
}


interface TmdbTvDetailsResponse {
  id: number;
  name: string;
  /** TASK-168 — nome original (não traduzido) do TMDB. Pra anime japonês normalmente vem em kanji/hiragana, não serve sozinho pra comparar com o MyAnimeList (que usa romaji/inglês) — por isso `alternative_titles` também é buscado, de preferência. */
  original_name: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  status: string;
  /** CORREÇÃO (2026-08-26) — ver `SeriesDetails.inProduction` em packages/types/src/index.ts pro porquê. */
  in_production: boolean;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  networks: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  seasons: { season_number: number; name: string; episode_count: number }[];
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
  similar?: { results: TmdbMultiSearchItem[] };
  recommendations?: { results: TmdbMultiSearchItem[] };
  alternative_titles?: { results: { iso_3166_1: string; title: string }[] };
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] };
  images?: { backdrops: { file_path: string }[] };
}

/**
 * Versão enxuta de `getSeriesDetails` — só temporadas/contagem de
 * episódios, sem elenco nem "semelhantes". Usada pelo importador do
 * TV Time (lib/tvtime-import) pra comparar o histórico assistido do
 * usuário contra a estrutura real de cada candidato ambíguo, sem
 * pagar o custo da chamada pesada de detalhe completo.
 */
export interface SeriesSeasonSummary {
  numberOfSeasons: number;
  seasons: { seasonNumber: number; episodeCount: number }[];
  /** Nomes alternativos/títulos em outros países — TASK-027.5, critério de "aliases". */
  alternativeTitles: string[];
  /**
   * TASK-166 — true quando a série já terminou de exibir (TMDB
   * status "Ended"/"Canceled"), mesmo campo que `getSeriesSummary`
   * já expõe pra Biblioteca/recalc ao vivo. Sem chamada nova ao TMDB
   * — já vem no mesmo request de `/tv/{id}`, só não era lido aqui.
   * Usado pelo importador GDPR pra aplicar a mesma correção
   * watching→completed que a Biblioteca já faz (ver
   * `correctStatusWithLiveTmdb.ts`).
   *
   * CORREÇÃO (2026-08-26) — agora também exige `!in_production` (ver
   * `SeriesDetails.inProduction`), mesma correção aplicada em
   * `getSeriesSummary` — `status` sozinho pode ficar "Ended" mesmo com
   * renovação já anunciada.
   */
  ended: boolean;
}

interface TmdbAlternativeTitlesResponse {
  results?: { title: string }[];
}

export async function getSeriesSeasonSummary(seriesId: number): Promise<SeriesSeasonSummary> {
  const data = await tmdbGet<TmdbTvDetailsResponse & { alternative_titles?: TmdbAlternativeTitlesResponse }>(
    `/tv/${seriesId}`,
    { append_to_response: "alternative_titles" }
  );
  return {
    numberOfSeasons: data.number_of_seasons,
    seasons: data.seasons.map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count })),
    alternativeTitles: (data.alternative_titles?.results ?? []).map((entry) => entry.title),
    // CORREÇÃO (2026-08-26) — `status` sozinho não basta (ver comentário
    // grande em `SeriesDetails.inProduction`, packages/types/src/index.ts):
    // só considera realmente encerrada se a TMDB TAMBÉM não marcar produção
    // em andamento.
    ended: (data.status === "Ended" || data.status === "Canceled") && !data.in_production,
  };
}

/**
 * Detalhes da série + elenco + séries semelhantes numa chamada só
 * (via `append_to_response`) — evita 3 requests separados pra
 * montar uma única tela.
 */
/**
 * TASK-168 (achado real, com prova em tela — "That Time I Got
 * Reincarnated as a Slime" mostrando foto de dublador em vez de
 * personagem) — toda chamada ao TMDB pede `language=pt-BR`
 * (`tmdbGet`), então `data.name` vem em português. O
 * MyAnimeList/Jikan (`lib/anime/jikan.ts`) só conhece título em
 * inglês/romaji — comparar "título em português" contra "título em
 * inglês" nunca bate o placar mínimo de `tokenOverlapScore`, e a
 * busca falha silenciosamente (por design — cai pro elenco do TMDB
 * em vez de arriscar achar o anime errado). Esta função escolhe,
 * nesta ordem, o melhor título pra ESSA comparação específica (nunca
 * usado pra exibir na tela — só como entrada de `getAnimeCharacters`):
 *   1. Título alternativo dos EUA (`alternative_titles`, US) —
 *      normalmente é literalmente o título de distribuição em
 *      inglês, o que mais se parece com o que o MyAnimeList usa.
 *   2. Título alternativo do Reino Unido (GB) — mesma ideia,
 *      fallback caso não tenha entrada dos EUA especificamente.
 *   3. `original_name` — só serve quando já está em escrita latina
 *      (funciona bem pra anime cujo nome original já é romanizado ou
 *      pra séries de outros países que não usam script latino
 *      diferente do JP); descartado se tiver caractere fora do
 *      básico (kanji/hangul/etc.), porque `normalizeTitle` em
 *      jikan.ts remove esses caracteres inteiros, zerando a
 *      comparação de qualquer forma.
 *   4. `data.name` (português) — último recurso, mesmo
 *      comportamento de antes desta correção (raramente bate, mas
 *      não é pior que não tentar).
 */
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

export async function getSeriesDetails(
  seriesId: string,
  language = "pt-BR"
): Promise<Omit<SeriesDetails, "seasons">> {
  // A PEDIDO (2026-08-25) — "onde assistir" também pra série. Reaproveita
  // `getSeriesWatchProviders`, que já existia (TASK-030, usada pela tela
  // de Episódio) mas nunca tinha sido chamada aqui — busca em paralelo com
  // o resto, mesmo padrão de `getMovieDetails`.
  const [data, englishData, watchProviders] = await Promise.all([
    tmdbGet<TmdbTvDetailsResponse>(`/tv/${seriesId}`, {
      append_to_response: "credits,recommendations,similar,alternative_titles,videos,images",
      language,
    }),
    // TASK-168 (correção 2) — depender só de `alternative_titles` não
    // bastava: muita série/anime não tem uma entrada "US" cadastrada
    // ali (o campo normalmente só existe quando o título de
    // distribuição difere region a region de verdade, não é uma
    // cópia garantida do nome em inglês). Pedir o mesmo `/tv/{id}`
    // de novo, só que com `language=en-US`, sempre devolve o nome que
    // o TMDB usa em inglês pra essa série — muito mais confiável pra
    // comparar com o MyAnimeList. Falha (rede, 404 raríssimo) não
    // derruba a tela inteira — cai pros fallbacks de sempre.
    //
    // Este `en-US` é FIXO de propósito — serve só pra comparação
    // interna com o MyAnimeList (`matchTitle`, nunca exibido na
    // tela), não tem relação com o idioma que a pessoa está usando
    // no app. Não confundir com o `language` do parâmetro acima.
    tmdbGet<{ name: string }>(`/tv/${seriesId}`, { language: "en-US" }).catch(() => null),
    getSeriesWatchProviders(seriesId),
  ]);

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 15).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
  }));

  /*
   * CORREÇÃO (bug real, reportado com print — "as séries semelhantes
   * não têm nada a ver com o anime": um anime mostrando Game of
   * Thrones, The Walking Dead e Pessoa de Interesse).
   *
   * A causa é o endpoint escolhido, não o nosso código. O `/similar`
   * do TMDB compara por PALAVRA-CHAVE E GÊNERO — como quase todo
   * anime de fantasia compartilha "fantasy"/"drama" com séries
   * ocidentais grandes, o resultado vira uma lista de populares sem
   * relação nenhuma. É uma limitação conhecida (já estava registrada
   * como pendência: "limitação do algoritmo do próprio TMDB").
   *
   * O `/recommendations` do mesmo TMDB é baseado em COMPORTAMENTO
   * de quem assiste (quem viu isto também viu aquilo) — muito mais
   * próximo do que a pessoa espera. Mantemos `/similar` como reserva
   * pra títulos obscuros, onde não há dados de comportamento
   * suficientes e o endpoint bom volta vazio.
   */
  const recommended = data.recommendations?.results ?? [];
  const similarFallback = data.similar?.results ?? [];
  const similar: MediaSearchResult[] = (recommended.length > 0 ? recommended : similarFallback)
    .slice(0, 12)
    .map((item) => normalizeSearchItem({ ...item, media_type: "tv" }));

  // A PEDIDO — refinamento da aba Sobre: trailer oficial mais recente do YouTube (o TMDB às vezes lista
  // vários — teaser, clipe, trailer de temporada antiga; prioriza "Trailer" oficial, cai pro primeiro do YouTube se não achar).
  const videos = data.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    videos.find((v) => v.site === "YouTube");
  const gallery = (data.images?.backdrops ?? []).slice(0, 8).map((img) => img.file_path);

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
    // CORREÇÃO (ver `translateTvGenreName`, achado real investigando
    // "chips de gênero de série em inglês", 2026-08-22) — mesmo gap do
    // TMDB (8 gêneros de série nunca traduzidos pro português) também
    // vazava aqui, na tela de detalhe da série.
    genres: data.genres.map((genre) => translateTvGenreName(genre.name, language)),
    networks: data.networks.map((network) => network.name),
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    trailerKey: trailer?.key ?? null,
    gallery,
    cast,
    watchProviders,
    similar,
  };
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

/** Lista de episódios de UMA temporada. Chamada uma vez por temporada, em paralelo, pela rota `/api/tmdb/series/[id]`. */
export async function getSeasonEpisodes(seriesId: string, seasonNumber: number, language = "pt-BR"): Promise<Episode[]> {
  const data = await tmdbGet<TmdbSeasonResponse>(`/tv/${seriesId}/season/${seasonNumber}`, { language });

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

interface TmdbSeriesSeasonsResponse {
  seasons: { season_number: number; episode_count: number }[];
}

/**
 * TASK-027R — "buscar todos os episódios no TMDB" pra comparar
 * air_date contra a data da exportação, não o total agregado. Busca
 * a lista de temporadas (leve) e depois TODAS as temporadas em
 * paralelo via getSeasonEpisodes (que já traz airDate por episódio),
 * com Promise.allSettled — uma temporada com problema não derruba as
 * outras. Ignora temporada 0 (especiais), mesma convenção do resto
 * do projeto.
 */
/**
 * CORREÇÃO (junto com o retry em `tmdbGet`, acima — mesmo bug do
 * Bleach) — antes, esta função disparava UMA chamada por temporada,
 * TODAS ao mesmo tempo (`Promise.allSettled` sem nenhum limite).
 * Pra série com poucas temporadas isso nunca foi problema, mas pra
 * catálogo grande (Bleach, 15+ temporadas) virava uma rajada de 15+
 * chamadas simultâneas — exatamente o cenário mais propenso a
 * esbarrar em limite de requisições do TMDB. Agora busca em levas
 * menores (`SEASON_FETCH_BATCH_SIZE` temporadas por vez, uma leva
 * depois da outra) — reduz o tamanho da rajada sem abrir mão do
 * paralelismo dentro de cada leva. Combinado com o retry de
 * `tmdbGet`, uma falha isolada de UMA temporada agora tem duas
 * camadas de proteção: tenta de novo sozinha (retry) e, mesmo assim
 * falhando, não competia com 14 outras chamadas ao mesmo tempo
 * (leva menor).
 */
const SEASON_FETCH_BATCH_SIZE = 5;

/**
 * CORREÇÃO 2 (bug real, causa raiz de VERDADE — "só o Reacher continua
 * aparecendo na Home", reportado DEPOIS do commit bf47544 que corrigiu
 * `series-episodes-at-export/route.ts`) — aquele primeiro conserto
 * cobria só a falha da chamada MAIS externa (`/tv/{id}`, os metadados
 * da série). Mas quem decide "tem episódio pendente?" (`UpToDatePendingGate.tsx`
 * → `findPendingEpisodes`) depende da lista de episódios de TODAS as
 * temporadas — e o loop abaixo, de propósito (ver comentário acima,
 * "uma temporada com problema não derruba as outras"), quando uma
 * temporada falhava (mesmo depois das 3 tentativas do `tmdbGet`),
 * simplesmente LOGAVA e seguia em frente sem essa temporada — a
 * função inteira ainda RESOLVIA com sucesso (`fulfilled` lá em
 * `route.ts`), só que com uma lista de episódios INCOMPLETA. Se a
 * temporada que falhou era justo a que tinha o episódio pendente, o
 * resultado era "série sem nada pendente" — indistinguível de "série
 * genuinamente em dia" — exatamente o mesmo tipo de bug do commit
 * anterior, só que numa camada mais funda (por temporada, não por
 * série inteira), por isso o fix de `route.ts` sozinho não resolveu.
 *
 * Fix: agora QUALQUER temporada que falhe (mesmo após as retentativas
 * do `tmdbGet`) faz a função inteira LANÇAR (com a lista de quais
 * temporadas falharam, pra facilitar diagnóstico no log do servidor)
 * em vez de devolver uma lista incompleta como se fosse completa. Isso
 * propaga pra cima e ativa a MESMA rede de segurança já existente:
 * `route.ts` marca a série em `failedIds` (rejeita no `Promise.allSettled`
 * de lá) → `seriesEpisodesLight.ts` lança um erro de verdade → o retry
 * automático do React Query tenta de novo sozinho. Verificado nos 2
 * únicos chamadores desta função (`series-episodes-at-export/route.ts`
 * e `admin/repair-series-categories/route.ts`) — os dois já tratam uma
 * rejeição desta função corretamente (o primeiro via `Promise.allSettled`
 * + `failedIds`, o segundo com seu próprio `try/catch` que já existia,
 * empurrando o id pra `errors`), então não há nenhum consumidor que
 * dependia da lista parcial silenciosa.
 */
export async function getAllEpisodesWithAirDates(seriesId: string, language = "pt-BR"): Promise<Episode[]> {
  const seasonsData = await tmdbGet<TmdbSeriesSeasonsResponse>(`/tv/${seriesId}`);
  const seasonNumbers = seasonsData.seasons.filter((s) => s.season_number >= 1).map((s) => s.season_number);

  const episodes: Episode[] = [];
  const failedSeasons: number[] = [];
  for (let i = 0; i < seasonNumbers.length; i += SEASON_FETCH_BATCH_SIZE) {
    const batch = seasonNumbers.slice(i, i + SEASON_FETCH_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((n) => getSeasonEpisodes(seriesId, n, language)));
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        episodes.push(...outcome.value);
      } else {
        failedSeasons.push(batch[index]!);
        console.error(
          `[tmdb] Falha ao buscar temporada ${batch[index]} da série ${seriesId} — as demais temporadas continuam sendo buscadas, mas a função vai lançar no final (lista incompleta não é confiável).`,
          outcome.reason
        );
      }
    });
  }

  if (failedSeasons.length > 0) {
    throw new Error(
      `[tmdb] ${failedSeasons.length} de ${seasonNumbers.length} temporada(s) da série ${seriesId} falharam ao buscar (temporadas: ${failedSeasons.join(", ")}) — lista de episódios incompleta, não é seguro tratar como sucesso.`
    );
  }

  return episodes;
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

/**
 * TASK-030 — `getSeasonEpisodes` (usada na página da série) não traz
 * `overview`/`vote_average` de propósito, pra não pesar a lista
 * inteira de episódios de uma tacada. A tela de episódio dedicada
 * precisa exatamente desses dois campos a mais — por isso uma função
 * separada, que busca só UM episódio por vez.
 */
export async function getEpisodeDetails(
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number,
  language = "pt-BR"
): Promise<EpisodeDetails> {
  const data = await tmdbGet<TmdbEpisodeDetailsResponse>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`, {
    language,
  });

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


export async function getSeriesSeasonList(
  seriesId: string,
  language = "pt-BR"
): Promise<{ seasonNumber: number; name: string }[]> {
  const data = await tmdbGet<TmdbTvDetailsResponse>(`/tv/${seriesId}`, { language });
  // Temporada "0" do TMDB costuma ser especiais — fora do escopo pedido.
  return data.seasons
    .filter((season) => season.season_number > 0)
    .map((season) => ({ seasonNumber: season.season_number, name: season.name }));
}

// ---------------------------------------------------------------
// Página do filme (TASK-006)
// ---------------------------------------------------------------

interface TmdbWatchProvidersResponse {
  results?: Record<
    string,
    {
      flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[];
    }
  >;
}

interface TmdbMovieDetailsResponse {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  production_companies: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  original_language: string | null;
  budget: number;
  revenue: number;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
  similar?: { results: TmdbMultiSearchItem[] };
  recommendations?: { results: TmdbMultiSearchItem[] };
  "watch/providers"?: TmdbWatchProvidersResponse;
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] };
}

/** Região usada pra "onde assistir" — projeto é pt-BR de ponta a ponta, então fixamos BR. */
const WATCH_PROVIDERS_REGION = "BR";

/**
 * CORREÇÃO (bug real, reportado — Netflix e HBO Max aparecendo
 * "duplicados" em Onde assistir) — não é duplicação de dado: o TMDB
 * lista planos/produtos diferentes do mesmo serviço como provedores
 * TECNICAMENTE distintos (ex.: "Netflix" e "Netflix Standard with
 * Ads" têm `provider_id` diferentes) — visualmente parecem a mesma
 * marca duas vezes, mas tecnicamente não são "iguais" pro TMDB.
 *
 * O TMDB não marca explicitamente qual é a versão "principal" — a
 * forma prática de identificar isso: agrupar por PREFIXO do nome
 * (a variante quase sempre é "nome base" + sufixo, ex.: "Netflix" +
 * " Standard with Ads") e manter só a entrada de nome mais curto de
 * cada grupo. Exige ESPAÇO logo depois do prefixo (não só qualquer
 * caractere) — sem isso, "Apple TV+" seria tratado como variante de
 * "Apple TV" (só que "Apple TV", sem "+", nem costuma aparecer na
 * lista de assinatura — normalmente é só compra/aluguel avulso,
 * outra categoria do TMDB que a gente nem lê).
 *
 * CORREÇÃO 2 (bug real, reportado — Paramount+ continuou duplicado)
 * — achado com a comparação acima sozinha: o TMDB escreve o MESMO
 * serviço de duas formas diferentes dependendo da variante —
 * "Paramount Plus" (nome por extenso) vs "Paramount+ Amazon
 * Channel" (com o símbolo). Nenhuma das duas é prefixo literal da
 * outra ("Paramount Plus" ≠ início de "Paramount+..."), por isso
 * passou despercebido antes. Normaliza "+" pra " plus" antes de
 * comparar — assim as dias formas viram a mesma base ("paramount
 * plus"), sem precisar de uma lista de marcas conhecidas.
 */
function normalizeProviderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, " plus")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeWatchProviders<T extends { name: string }>(providers: T[]): T[] {
  const sorted = [...providers].sort((a, b) => a.name.length - b.name.length);
  const kept: T[] = [];
  for (const provider of sorted) {
    const normalized = normalizeProviderName(provider.name);
    const isVariantOfKept = kept.some((existing) => normalized.startsWith(`${normalizeProviderName(existing.name)} `));
    if (!isVariantOfKept) kept.push(provider);
  }
  // Devolve na ordem original do TMDB (só filtrada), não na ordem por tamanho usada pra comparar.
  const keptIds = new Set(kept.map((p) => p.name));
  return providers.filter((p) => keptIds.has(p.name));
}

interface TmdbSeriesWatchProvidersResponse {
  results?: Record<string, { flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[] }>;
}

/**
 * TASK-030 — providers de série nunca tinham sido buscados neste
 * projeto (só filmes, em getMovieDetails). TMDB não tem providers
 * por EPISÓDIO — é sempre no nível da série inteira; por isso a tela
 * de episódio usa esta função com o `seriesId`, não com dados do
 * episódio em si. Mesma região fixa (BR) e mesmo formato de
 * getMovieDetails, de propósito — mesma UI de "onde assistir"
 * reaproveitável dos dois lados.
 */
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

/**
 * Detalhes do filme + elenco/direção + filmes semelhantes + onde
 * assistir, tudo numa chamada só (via `append_to_response`).
 */
export async function getMovieDetails(movieId: string, language = "pt-BR"): Promise<MovieDetails> {
  const data = await tmdbGet<TmdbMovieDetailsResponse>(`/movie/${movieId}`, {
    append_to_response: "credits,recommendations,similar,watch/providers,videos",
    language,
  });

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 15).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
  }));

  const director = data.credits?.crew.find((member) => member.job === "Director")?.name ?? null;

  // Mesma correção da série (ver comentário longo em
  // `fetchSeriesDetailsBase`): `/recommendations` é baseado em
  // comportamento de quem assiste, `/similar` só em palavra-chave.
  const recommendedMovies = data.recommendations?.results ?? [];
  const similarMoviesFallback = data.similar?.results ?? [];
  const similar: MediaSearchResult[] = (recommendedMovies.length > 0 ? recommendedMovies : similarMoviesFallback)
    .slice(0, 12)
    .map((item) => normalizeSearchItem({ ...item, media_type: "movie" }));

  const regionProviders = data["watch/providers"]?.results?.[WATCH_PROVIDERS_REGION];
  const watchProviders: WatchProvider[] = dedupeWatchProviders(
    (regionProviders?.flatrate ?? []).map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path,
    }))
  );

  const videos = data.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    videos.find((v) => v.site === "YouTube");

  return {
    id: data.id,
    title: data.title,
    originalTitle: data.original_title,
    overview: data.overview,
    backdropPath: data.backdrop_path,
    posterPath: data.poster_path,
    releaseDate: data.release_date,
    runtimeMinutes: data.runtime,
    genres: data.genres.map((genre) => genre.name),
    voteAverage: data.vote_average,
    trailerKey: trailer?.key ?? null,
    director,
    cast,
    studios: data.production_companies.map((company) => company.name),
    country: data.production_countries[0]?.name ?? null,
    language: data.original_language,
    budget: data.budget > 0 ? data.budget : null,
    revenue: data.revenue > 0 ? data.revenue : null,
    watchProviders,
    similar,
  };
}

// ---------------------------------------------------------------
// Biblioteca (TASK-007) — resumos leves, só pra exibição
// (poster/título/ano/total de episódios). O estado da Biblioteca em
// si (o que está em cada lista, status, progresso assistido) vem só
// do Supabase — isso aqui NUNCA decide o que aparece na Biblioteca,
// só decora o que já veio de lá.
// ---------------------------------------------------------------

export interface MediaSummary {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Só preenchido pra séries. */
  totalEpisodes?: number;
  /**
   * Só preenchido pra séries — true quando a série já terminou de
   * exibir (TMDB status "Ended"/"Canceled"). Sem isso não dá pra
   * distinguir "assistiu tudo que já saiu, mas a série continua no
   * ar" (categoria "Em dia") de "assistiu tudo porque a série
   * realmente acabou" (categoria "Concluídas").
   */
  ended?: boolean;
  /**
   * Minutos: pra filme, a duração do filme; pra série, a duração
   * MÉDIA de um episódio (TMDB não guarda a duração de cada episódio
   * assistido individualmente — calcular "tempo assistido" a partir
   * disso é uma estimativa: episódios assistidos × duração média,
   * não uma soma exata episódio por episódio). Vem do mesmo request
   * que já busca o resto do resumo — nenhuma chamada nova ao TMDB.
   */
  runtimeMinutes?: number;
  /** Só preenchido pra filme (TASK-148, app nativo). Formato TMDB (YYYY-MM-DD). */
  releaseDate?: string | null;
  /**
   * A PEDIDO — "Seu ano" (gênero favorito). Só os NOMES (não os ids
   * do TMDB) — pra essa feature só interessa contar frequência por
   * nome, não precisa do id. Vem do MESMO request que já busca o
   * resto do resumo (o TMDB já devolve isso por padrão em
   * `/movie/{id}` e `/tv/{id}`) — nenhuma chamada nova ao TMDB.
   */
  genres?: string[];
}

interface TmdbMovieSummaryResponse {
  id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
}

export async function getMovieSummary(movieId: number, language = "pt-BR"): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbMovieSummaryResponse>(`/movie/${movieId}`, { language });
  return {
    id: data.id,
    title: data.title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    runtimeMinutes: data.runtime ?? undefined,
    releaseDate: data.release_date ?? null,
    genres: (data.genres ?? []).map((g) => g.name),
  };
}

interface TmdbSeriesSummaryResponse {
  id: number;
  name: string;
  first_air_date: string | null;
  poster_path: string | null;
  number_of_episodes: number;
  /** "Returning Series" | "Ended" | "Canceled" | "In Production" | "Planned" | "Pilot" */
  status: string;
  /** CORREÇÃO (2026-08-26) — ver `SeriesDetails.inProduction` em packages/types/src/index.ts pro porquê. */
  in_production: boolean;
  /** Nem toda série preenche isso no TMDB — por isso o fallback abaixo. */
  episode_run_time: number[];
  seasons: { season_number: number; episode_count: number }[];
  genres: { id: number; name: string }[];
}

const DEFAULT_EPISODE_RUNTIME_MINUTES = 45;

/**
 * TASK-030 (correção) — achado real: `number_of_episodes` do TMDB
 * inclui a temporada 0 (especiais). A contagem de episódios
 * assistidos usada em `library-state.ts` (`entry.watchedCount`)
 * EXCLUI especiais (`is_special = false`, coluna adicionada pra
 * preservar essa informação sem contaminar progresso). Comparar um
 * total COM especiais contra uma contagem SEM especiais fazia
 * "assistiu tudo" ficar praticamente impossível de bater pra
 * qualquer série com especiais no TMDB — e por isso "Em dia" e
 * "Concluída" praticamente nunca disparavam, mesmo com a importação
 * gravando tudo certo. Agora soma só temporada >= 1, mesma convenção
 * já usada em reconstructProgress.ts/resolveStatus.ts.
 */
export async function getSeriesSummary(seriesId: number, language = "pt-BR"): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbSeriesSummaryResponse>(`/tv/${seriesId}`, { language });
  const totalEpisodesExcludingSpecials = data.seasons
    .filter((season) => season.season_number >= 1)
    .reduce((sum, season) => sum + season.episode_count, 0);

  return {
    id: data.id,
    title: data.name,
    year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    totalEpisodes: totalEpisodesExcludingSpecials || data.number_of_episodes,
    // CORREÇÃO (2026-08-26) — `status` sozinho não basta (ver comentário
    // grande em `SeriesDetails.inProduction`, packages/types/src/index.ts):
    // só considera realmente encerrada se a TMDB TAMBÉM não marcar produção
    // em andamento.
    ended: (data.status === "Ended" || data.status === "Canceled") && !data.in_production,
    runtimeMinutes: data.episode_run_time?.[0] || DEFAULT_EPISODE_RUNTIME_MINUTES,
    // CORREÇÃO (ver `translateTvGenreName` acima) — sem isso, séries
    // com gêneros como "Action & Adventure"/"Sci-Fi & Fantasy" salvam
    // esse nome em INGLÊS em `media_summaries_cache`, mesmo pedindo
    // `language=pt-BR` — o TMDB nunca traduziu esses 8 gêneros de
    // série pro português.
    genres: (data.genres ?? []).map((g) => translateTvGenreName(g.name, language)),
  };
}

// ---------------------------------------------------------------
// "Em breve" (TASK-019) — próximo episódio a estrear de cada série
// acompanhada. O TMDB já devolve isso pronto em `next_episode_to_air`
// dentro de /tv/{id} — não precisa de nenhuma chamada extra.
// ---------------------------------------------------------------

export interface NextEpisodeToAir {
  seriesId: number;
  seriesTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
  /** TASK-051 — mesma chamada de sempre (/tv/{id}) já trazia isso, só não estava sendo lido. TMDB não tem horário de exibição (só data) — por isso não existe airTime aqui, seria inventar dado. */
  networks: string[];
}

interface TmdbNextEpisodeResponse {
  id: number;
  name: string;
  poster_path: string | null;
  networks: { name: string }[];
  next_episode_to_air: {
    season_number: number;
    episode_number: number;
    name: string;
    air_date: string | null;
  } | null;
}

export async function getNextEpisodeToAir(seriesId: number, language = "pt-BR"): Promise<NextEpisodeToAir | null> {
  const data = await tmdbGet<TmdbNextEpisodeResponse>(`/tv/${seriesId}`, { language });
  const next = data.next_episode_to_air;
  if (!next || !next.air_date) return null;

  return {
    seriesId: data.id,
    seriesTitle: data.name,
    posterPath: data.poster_path,
    seasonNumber: next.season_number,
    episodeNumber: next.episode_number,
    name: next.name,
    airDate: next.air_date,
    networks: data.networks.map((n) => n.name),
  };
}

/**
 * TASK-058 — aba Explorar. Todas essas usam endpoints de LISTAGEM do
 * TMDB (trending/popular/discover/on_the_air), que trazem
 * poster/título/data/genre_ids de vários itens numa chamada só — bem
 * mais barato que buscar detalhe completo item por item. `genre_ids`
 * vem cru (números); a tradução pra nome de gênero é uma chamada só,
 * separada e cacheada (`getGenreMap`), reaproveitada por todos os
 * cards.
 */
export interface DiscoverItem {
  id: number;
  mediaType: "movie" | "series";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  genreIds: number[];
  voteAverage: number;
}

/**
 * A PEDIDO ("existe um limite de séries e filmes recomendados?" →
 * "implemente isso", 2026-08-22) — até aqui, toda função desta seção
 * só buscava a página 1 do TMDB (até 20 títulos) e parava por aí, sem
 * jeito nenhum de pedir mais. `page`/`total_pages` já vinham em TODA
 * resposta de listagem do TMDB, só ninguém capturava. Pergunta feita
 * ao usuário (AskUserQuestion): paginação só nas telas "ver todos"
 * (grade) — os carrosséis da tela principal continuam mostrando só a
 * página 1 (~20 títulos), sem mudança nenhuma no comportamento deles.
 */
interface TmdbListResponse {
  page: number;
  total_pages: number;
  results: {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    first_air_date?: string;
    genre_ids: number[];
    vote_average: number;
  }[];
}

export interface DiscoverPage {
  items: DiscoverItem[];
  page: number;
  totalPages: number;
}

function fromListRow(row: TmdbListResponse["results"][number], mediaType: "movie" | "series"): DiscoverItem {
  const dateStr = row.release_date || row.first_air_date || null;
  return {
    id: row.id,
    mediaType,
    title: row.title || row.name || "",
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    year: dateStr ? Number(dateStr.slice(0, 4)) : null,
    genreIds: row.genre_ids,
    voteAverage: row.vote_average,
  };
}

function toDiscoverPage(data: TmdbListResponse, mediaType: "movie" | "series"): DiscoverPage {
  return {
    items: data.results.map((r) => fromListRow(r, mediaType)),
    page: data.page,
    // TMDB nunca devolve `total_pages` maior que 500, mesmo quando o
    // total de resultados sugeriria mais — limite do próprio TMDB,
    // não nosso; repassado como veio, sem tentar "corrigir".
    totalPages: data.total_pages,
  };
}

/*
 * A PEDIDO — as capas do onboarding (mobile) sempre vinham com título
 * em português, mesmo com o app noutro idioma. Causa: `tmdbGet` já
 * aceitava `language` por chamada (ver comentário dela e o uso em
 * `getEnglishSeriesName`, mais abaixo), só ninguém tinha passado isso
 * aqui — o padrão pt-BR (linha ~23) sempre vencia. `language`
 * opcional, default `"pt-BR"` (preserva TODO comportamento já
 * existente em quem chama sem passar nada — só o onboarding passa o
 * idioma real do app agora). `page` opcional, default `1` — mesmo
 * motivo: preserva o comportamento de quem chama sem passar nada
 * (os carrosséis da tela principal, que nunca pedem outra página).
 */
export async function getTrendingSeries(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/trending/tv/week", { language, page: String(page) });
  return toDiscoverPage(data, "series");
}

export async function getTrendingMovies(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/trending/movie/week", { language, page: String(page) });
  return toDiscoverPage(data, "movie");
}

export async function getPopularSeries(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/tv/popular", { language, page: String(page) });
  return toDiscoverPage(data, "series");
}

export async function getPopularMovies(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/movie/popular", { language, page: String(page) });
  return toDiscoverPage(data, "movie");
}

export async function getUpcomingMovies(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/movie/upcoming", { language, page: String(page) });
  return toDiscoverPage(data, "movie");
}

export async function getOnTheAirSeries(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/tv/on_the_air", { language, page: String(page) });
  return toDiscoverPage(data, "series");
}

/**
 * Fase C da reformulação da Explorar (2026-08-21) — "Para você" e os
 * chips de "Seus gêneros favoritos" precisam de uma lista de
 * descoberta FILTRADA por gênero (endpoint `/discover/movie` e
 * `/discover/tv` do TMDB, com `with_genres`), diferente das listas
 * fixas (trending/popular/etc.) que já existiam. Reaproveita
 * `TmdbListResponse`/`fromListRow` — mesmo formato de linha que
 * `/movie/popular` etc. já usam.
 */
export async function getMoviesByGenre(genreId: number, page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/discover/movie", {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    language,
    page: String(page),
  });
  return toDiscoverPage(data, "movie");
}

export async function getSeriesByGenre(genreId: number, page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/discover/tv", {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    language,
    page: String(page),
  });
  return toDiscoverPage(data, "series");
}

export type SimilarSource = "recommendations" | "similar";

export interface SimilarDiscoverPage extends DiscoverPage {
  source: SimilarSource;
}

/**
 * Fase D da reformulação da Explorar (2026-08-22) — "Porque você
 * assistiu a [X]": versão leve de `getMovieDetails`/`getSeriesDetails`
 * (só busca `recommendations`/`similar`, sem elenco/sinopse/vídeos,
 * que o carrossel não usa). Devolve o mesmo formato de `getMoviesByGenre`
 * (`DiscoverItem[]`, o que `DiscoverCarousel` já sabe renderizar sem
 * mudança nenhuma), diferente de `MediaSearchResult[]` (formato usado
 * só pela página de detalhe, `SimilarTitlesCarousel.tsx`). Mesma
 * preferência recommendations > similar de sempre — ver o comentário
 * longo em `getSeriesDetails` (linha ~284) pro histórico completo.
 *
 * IMPORTANTE — não reaproveita `data.recommendations`/`data.similar`
 * de `getMovieDetails`/`getSeriesDetails` (tipados como
 * `TmdbMultiSearchItem[]`, usado por `normalizeSearchItem`): aquele
 * tipo não tem `genre_ids`, que `DiscoverItem`/`fromListRow` exigem.
 *
 * CORREÇÃO (a pedido — paginação nas telas "ver todos", 2026-08-22) —
 * a PRIMEIRA versão desta função buscava `recommendations`/`similar`
 * via `append_to_response` num `GET /movie/{id}` só — mais barato,
 * MAS o TMDB não aceita `page` pra um recurso "anexado" dessa forma
 * (só repassa `language` do request principal pra dentro dele) —
 * ficaria preso pra sempre na página 1. Reescrito pra chamar os
 * endpoints dedicados (`/movie/{id}/recommendations`,
 * `/movie/{id}/similar`) direto, que aceitam `page` de verdade.
 *
 * `source` (opcional) — a ORIGEM (recommendations vs. similar) só é
 * decidida na página 1 (recommendations vem vazio → troca pra
 * similar PRA SEMPRE, não só naquela página). Da página 2 em diante,
 * quem chama (o hook de paginação) precisa informar explicitamente
 * qual das duas foi decidida na página 1 — sem isso, cada página
 * corre o risco de escolher uma fonte diferente da anterior, e a
 * lista pularia de assunto no meio da rolagem.
 */
export async function getSimilarMoviesForId(
  movieId: number,
  page = 1,
  language = "pt-BR",
  source?: SimilarSource
): Promise<SimilarDiscoverPage> {
  if (source === "similar") {
    const data = await tmdbGet<TmdbListResponse>(`/movie/${movieId}/similar`, { page: String(page), language });
    return { ...toDiscoverPage(data, "movie"), source: "similar" };
  }
  const recommended = await tmdbGet<TmdbListResponse>(`/movie/${movieId}/recommendations`, { page: String(page), language });
  if (page === 1 && recommended.results.length === 0) {
    const fallback = await tmdbGet<TmdbListResponse>(`/movie/${movieId}/similar`, { page: "1", language });
    return { ...toDiscoverPage(fallback, "movie"), source: "similar" };
  }
  return { ...toDiscoverPage(recommended, "movie"), source: "recommendations" };
}

export async function getSimilarSeriesForId(
  seriesId: number,
  page = 1,
  language = "pt-BR",
  source?: SimilarSource
): Promise<SimilarDiscoverPage> {
  if (source === "similar") {
    const data = await tmdbGet<TmdbListResponse>(`/tv/${seriesId}/similar`, { page: String(page), language });
    return { ...toDiscoverPage(data, "series"), source: "similar" };
  }
  const recommended = await tmdbGet<TmdbListResponse>(`/tv/${seriesId}/recommendations`, { page: String(page), language });
  if (page === 1 && recommended.results.length === 0) {
    const fallback = await tmdbGet<TmdbListResponse>(`/tv/${seriesId}/similar`, { page: "1", language });
    return { ...toDiscoverPage(fallback, "series"), source: "similar" };
  }
  return { ...toDiscoverPage(recommended, "series"), source: "recommendations" };
}

interface TmdbGenreListResponse {
  genres: { id: number; name: string }[];
}

const ONE_DAY_SECONDS = 24 * 60 * 60;

/**
 * CORREÇÃO (a pedido, investigado até a causa raiz — "por que os chips
 * de gênero de SÉRIE aparecem em inglês, mas os de filme não?",
 * 2026-08-22) — causa raiz CONFIRMADA batendo direto em
 * `/api/tmdb/genres?language=pt-BR` (o usuário rodou e mandou o JSON
 * de volta): o TMDB devolve `movieGenreMap` 100% traduzido pro
 * português, mas 8 gêneros de SÉRIE especificamente vêm SEM tradução
 * nenhuma pro português — o próprio TMDB nunca traduziu esses 8 (são
 * todos os gêneros "compostos"/adicionados depois na taxonomia deles:
 * Action & Adventure, Kids, News, Reality, Sci-Fi & Fantasy, Soap,
 * Talk, War & Politics). NÃO é um bug do código do SeenList — filme e
 * série usam exatamente o mesmo caminho de busca, o mesmo parâmetro de
 * idioma; a falta de tradução é uma lacuna real do banco de dados do
 * TMDB. Como não tem como "consertar" o TMDB, a correção é aplicar uma
 * tradução própria só pra esses 8 ids específicos, no ponto mais baixo
 * possível (aqui, antes de qualquer outro código usar o nome) — assim
 * TODO mundo que consome gênero de série (chips, cartões de "ver
 * todos", `useFavoriteGenres`) recebe o nome já certo, sem precisar de
 * correção espalhada em cada tela.
 *
 * Guardado por NOME (não por id) — o nome em inglês é o identificador
 * estável tanto na resposta fresca do TMDB (que tem id) quanto no dado
 * já gravado em `media_summaries_cache` (que só guarda o nome, sem id
 * — ver `translateTvGenreName` reaproveitado em
 * `api/tmdb/library-summaries/route.ts` pra corrigir também linhas já
 * em cache, sem precisar esperar as 24h de validade expirarem).
 *
 * Só `pt-BR` confirmado até aqui (o idioma que o usuário testou) — `es`
 * pode ter a mesma lacuna ou não, ainda não verificado; sem tradução
 * pra `es` aqui de propósito, pra não inventar um texto não conferido.
 */
const TV_GENRE_NAME_OVERRIDES_PT_BR: Record<string, string> = {
  "Action & Adventure": "Ação e aventura",
  Kids: "Infantil",
  News: "Notícias",
  Reality: "Reality show",
  "Sci-Fi & Fantasy": "Ficção científica e fantasia",
  Soap: "Novela",
  Talk: "Talk show",
  "War & Politics": "Guerra e política",
};

export function translateTvGenreName(name: string, language: string): string {
  if (language !== "pt-BR") return name;
  return TV_GENRE_NAME_OVERRIDES_PT_BR[name] ?? name;
}

async function fetchRawGenreLists(language: string): Promise<{ movie: TmdbGenreListResponse; tv: TmdbGenreListResponse }> {
  const [movie, tv] = await Promise.all([
    tmdbGet<TmdbGenreListResponse>("/genre/movie/list", { language }, ONE_DAY_SECONDS),
    tmdbGet<TmdbGenreListResponse>("/genre/tv/list", { language }, ONE_DAY_SECONDS),
  ]);
  return {
    movie,
    tv: { genres: tv.genres.map((g) => ({ ...g, name: translateTvGenreName(g.name, language) })) },
  };
}

/** Mapa id→nome de gênero, série + filme juntos (os ids não colidem entre os dois na prática do TMDB). Uma chamada só. Cache de 24h, bem maior que o padrão de 5min — lista de gêneros do TMDB praticamente nunca muda. */
export async function getGenreMap(language = "pt-BR"): Promise<Record<number, string>> {
  const { movie, tv } = await fetchRawGenreLists(language);
  const map: Record<number, string> = {};
  for (const g of [...movie.genres, ...tv.genres]) map[g.id] = g.name;
  return map;
}

/**
 * Fase C da reformulação da Explorar (2026-08-21) — CORREÇÃO (achado
 * real, "Principais séries para você" vindo sempre vazio) — o id de
 * gênero do TMDB NÃO é o mesmo espaço pra filme e série: "Ação" (28)
 * e "Aventura" (12), por exemplo, só existem no vocabulário de FILME —
 * séries usam "Ação e Aventura" (10759) em vez disso. `getGenreMap`
 * (acima) funde os dois mapas por id — ótimo pra "dado um id que eu
 * JÁ SEI que é válido, qual o nome" (uso em `explore/route.ts`), mas
 * ruim pra ir de NOME pra id quando o nome pode ser exclusivo de um
 * dos dois lados: `useFavoriteGenres` calculava um único "gênero
 * favorito" combinando filme+série e usava o id resultante pros dois
 * `/discover` (filme E série) — se esse gênero vinha majoritariamente
 * dos FILMES concluídos (ex.: "Ação", id 28), a chamada
 * `/discover/tv?with_genres=28` não tinha erro nenhum, só nunca
 * retornava nada (nenhuma série carrega o gênero 28) — carrossel
 * "vazio" sem nenhum erro pra investigar.
 *
 * Esta função devolve os DOIS mapas separados — `useFavoriteGenres`
 * agora calcula gênero favorito de filme e de série CADA UM com o seu
 * próprio mapa, evitando cruzar os dois espaços de id.
 */
export async function getGenreMaps(language = "pt-BR"): Promise<{ movie: Record<number, string>; tv: Record<number, string> }> {
  const { movie: movieGenres, tv: tvGenres } = await fetchRawGenreLists(language);
  const movie: Record<number, string> = {};
  for (const g of movieGenres.genres) movie[g.id] = g.name;
  const tv: Record<number, string> = {};
  for (const g of tvGenres.genres) tv[g.id] = g.name;
  return { movie, tv };
}
