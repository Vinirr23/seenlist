import { createAdminClient } from "@/lib/supabase/admin";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * A PEDIDO (2026-10-08 — "preciso que o perfil fique compartilhável
 * nas redes sociais igual ao Bingers"). Causa raiz do problema
 * original: `app/u/[username]/page.tsx` nunca teve `generateMetadata`
 * nenhum, então toda página de perfil herdava o card genérico do site
 * inteiro (`app/layout.tsx` — título/imagem fixos). Esta função monta
 * os dados reais do card (opção "Estilo Bingers", escolhida pelo
 * usuário num mockup) — consumida tanto por `generateMetadata` quanto
 * por `opengraph-image.tsx`, cada um chamando-a de novo (requisições
 * HTTP separadas — um crawler busca a página e a imagem em chamadas
 * distintas, não dá pra compartilhar o resultado entre as duas).
 *
 * POR QUE `createAdminClient` (chave de serviço, ignora RLS) EM VEZ do
 * cliente normal — diferente do resto do app (`lib/supabase/admin.ts`
 * documenta "só pra rotas de API já protegidas por `adminEmail()`"),
 * aqui é uma EXCEÇÃO deliberada, pelo mesmo motivo que
 * `media_summaries_cache` só é lida pela chave de serviço: quem chama
 * esta função é um CRAWLER de rede social (WhatsApp/Threads/etc.)
 * gerando o preview do link, nunca uma sessão de usuário logado — não
 * existe "usuário atual" nem cookie de sessão nesse contexto, então a
 * RPC `get_watched_episode_stats` (que exige `authenticated`) e a RLS
 * de `profiles`/`movie_status`/etc. (que dependem de quem está
 * logado) não se aplicam. A visibilidade é replicada NA MÃO abaixo —
 * perfil ou biblioteca que não seja `'public'` nunca aparece aqui,
 * exatamente como um visitante deslogado veria.
 */

export interface ProfileShareStats {
  /** Filmes concluídos + episódios assistidos, somados num número só — o card de compartilhamento mostra UMA estatística de "assistidos" (como o do Bingers), não o detalhamento de 8 cards do carrossel de Estatísticas. */
  watchedCount: number;
  watchMinutes: number;
}

export interface ProfileShareCard {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  verifiedTier: "gold" | "blue" | null;
  /** `null` quando a biblioteca não é pública — o card mostra só identidade (nome/@/avatar/selo), sem números nem pôsteres. */
  stats: ProfileShareStats | null;
  posterUrls: string[];
}

interface MediaSummaryRow {
  tmdb_id: number;
  poster_path: string | null;
  runtime_minutes: number | null;
}

// Card de compartilhamento é sempre pt-BR por enquanto — ver
// `formatWatchMinutesPlain.ts` pro mesmo raciocínio (sem sessão de
// usuário, não tem idioma pra escolher).
const LANGUAGE = "pt-BR";
const MAX_POSTERS = 6;

export async function fetchProfileShareCard(username: string): Promise<ProfileShareCard | null> {
  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, verified_tier, profile_visibility, library_visibility")
    .ilike("username", username)
    .maybeSingle();

  if (profileError) {
    console.error("[profileShareCard] Falha ao buscar perfil", profileError);
    return null;
  }
  // Perfil inexistente OU privado: MESMA resposta pros dois casos —
  // não revela "existe mas é privado", igual à regra já aplicada em
  // `usePublicProfile` pra quem abre a página em si.
  if (!profile || profile.profile_visibility !== "public") return null;

  const card: ProfileShareCard = {
    username: profile.username,
    displayName: profile.display_name ?? profile.username,
    avatarUrl: profile.avatar_url,
    verifiedTier: profile.verified_tier,
    stats: null,
    posterUrls: [],
  };

  // Biblioteca restrita (seguidores/privada): card só com identidade,
  // sem números nem pôsteres — mesma regra de seção que
  // `PublicLibrarySection` já aplica dentro da página.
  if (profile.library_visibility !== "public") return card;

  const userId = profile.user_id;

  const [movieResult, seriesResult, episodeRowsResult] = await Promise.all([
    supabase.from("movie_status").select("movie_id, status, updated_at").eq("user_id", userId),
    supabase.from("series_status").select("series_id, status, total_watch_events, updated_at").eq("user_id", userId),
    supabase.from("watched_episodes").select("series_id").eq("user_id", userId).eq("is_special", false),
  ]);

  if (movieResult.error || seriesResult.error || episodeRowsResult.error) {
    console.error("[profileShareCard] Falha ao buscar biblioteca", {
      movieError: movieResult.error,
      seriesError: seriesResult.error,
      episodeError: episodeRowsResult.error,
    });
    return card; // identidade sozinha ainda é um card válido — melhor isso que quebrar o preview inteiro
  }

  const watchedMovieRows = (movieResult.data ?? []).filter((row) => row.status === "watched");
  const seriesRows = (seriesResult.data ?? []).filter((row) => row.status !== "removed");

  // `total_watch_events` (contagem "oficial", inclui reassistidas —
  // ver `computeProfileStats`/`profile-stats.ts`) só falta pra série
  // que nunca passou pelo importador do TV Time; pra essas, conta
  // episódio assistido único como proxy (mesma regra de lá).
  const watchedEpisodeCountBySeries = new Map<number, number>();
  for (const row of episodeRowsResult.data ?? []) {
    watchedEpisodeCountBySeries.set(row.series_id, (watchedEpisodeCountBySeries.get(row.series_id) ?? 0) + 1);
  }

  const movieIds = [...new Set(watchedMovieRows.map((row) => row.movie_id))];
  const seriesIds = [...new Set(seriesRows.map((row) => row.series_id))];

  // `media_summaries_cache`: cache compartilhado só-servidor (ver
  // `20260905000000_media_summaries_cache.sql`) com pôster + duração —
  // dá pra montar o card inteiro sem NENHUMA chamada ao vivo pro TMDB.
  // Um título que ainda não passou por esse cache (nunca foi aberto na
  // Biblioteca de ninguém) simplesmente não contribui pôster/duração
  // aqui — degrada graciosamente, nunca quebra o card.
  const [movieSummaries, seriesSummaries] = await Promise.all([
    movieIds.length
      ? supabase
          .from("media_summaries_cache")
          .select("tmdb_id, poster_path, runtime_minutes")
          .eq("media_type", "movie")
          .eq("language", LANGUAGE)
          .in("tmdb_id", movieIds)
      : Promise.resolve({ data: [] as MediaSummaryRow[] }),
    seriesIds.length
      ? supabase
          .from("media_summaries_cache")
          .select("tmdb_id, poster_path, runtime_minutes")
          .eq("media_type", "series")
          .eq("language", LANGUAGE)
          .in("tmdb_id", seriesIds)
      : Promise.resolve({ data: [] as MediaSummaryRow[] }),
  ]);

  const movieSummaryById = new Map((movieSummaries.data ?? []).map((row) => [row.tmdb_id, row]));
  const seriesSummaryById = new Map((seriesSummaries.data ?? []).map((row) => [row.tmdb_id, row]));

  let moviesCompleted = 0;
  let movieWatchMinutes = 0;
  for (const row of watchedMovieRows) {
    moviesCompleted += 1;
    movieWatchMinutes += movieSummaryById.get(row.movie_id)?.runtime_minutes ?? 0;
  }

  let episodesWatched = 0;
  let seriesWatchMinutes = 0;
  for (const row of seriesRows) {
    const watchEvents = row.total_watch_events ?? watchedEpisodeCountBySeries.get(row.series_id) ?? 0;
    episodesWatched += watchEvents;
    seriesWatchMinutes += watchEvents * (seriesSummaryById.get(row.series_id)?.runtime_minutes ?? 0);
  }

  card.stats = {
    watchedCount: moviesCompleted + episodesWatched,
    watchMinutes: movieWatchMinutes + seriesWatchMinutes,
  };

  // Pôsteres pra fileira do card: os itens mais recentemente mexidos
  // primeiro, intercalando série/filme, só os que já têm pôster em
  // cache (sem placeholder — melhor mostrar menos pôsteres de verdade
  // que inventar um genérico).
  const recentSeries = [...seriesRows].sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
  const recentMovies = [...watchedMovieRows].sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));

  const posterUrls: string[] = [];
  for (let i = 0; i < Math.max(recentSeries.length, recentMovies.length) && posterUrls.length < MAX_POSTERS; i++) {
    // Guardar `recentSeries[i]`/`recentMovies[i]` numa variável antes
    // do `if` (em vez de reacessar o índice dentro dele) é o que faz o
    // TS estreitar o tipo pra fora de `undefined` — com
    // `noUncheckedIndexedAccess` ligado, repetir `recentSeries[i]`
    // depois do check continua "possivelmente undefined" porque é uma
    // nova leitura do array, não a mesma expressão já testada.
    const seriesRow = recentSeries[i];
    if (seriesRow) {
      const url = tmdbImage(seriesSummaryById.get(seriesRow.series_id)?.poster_path ?? null, "w342");
      if (url) posterUrls.push(url);
    }
    if (posterUrls.length >= MAX_POSTERS) break;
    const movieRow = recentMovies[i];
    if (movieRow) {
      const url = tmdbImage(movieSummaryById.get(movieRow.movie_id)?.poster_path ?? null, "w342");
      if (url) posterUrls.push(url);
    }
  }
  card.posterUrls = posterUrls.slice(0, MAX_POSTERS);

  return card;
}
