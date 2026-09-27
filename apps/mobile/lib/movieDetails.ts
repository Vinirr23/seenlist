import type { MovieDetails, MovieWatchStatus } from "@seenlist/types";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { notifyWatchedAction } from "@/lib/reviewPrompt";

const SITE_URL = "https://seenlist.app";

/**
 * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance — item
 * 9.3: "Movie Details — cache igual ao Series Details") — `fetchSeriesDetails`
 * (`lib/seriesDetails.ts`) já tem cache de módulo com TTL de 5 minutos;
 * `fetchMovieDetails`, a função irmã pra filmes, não tinha nenhum —
 * navegar duas vezes pro mesmo filme na mesma sessão (ex.: voltar de
 * "Títulos parecidos" pro filme original) refazia a chamada de rede
 * completa toda vez. Mesmo TTL, mesma estratégia (`Map` de módulo,
 * chave por `movieId:language`, sem biblioteca externa) — nenhuma
 * arquitetura nova, só a réplica exata do padrão já aprovado.
 */
const MOVIE_DETAILS_TTL_MS = 5 * 60 * 1000;
const movieDetailsCache = new Map<string, { data: MovieDetails; expiresAt: number }>();

/**
 * CORREÇÃO (2026-09-27, auditoria de performance — Etapa 3, achado
 * real no aparelho: "abro um filme, saio, abro de novo, recarrega")
 * — causa raiz: o cache acima já evitava a segunda chamada de REDE
 * (confirmado por código na validação da Etapa 2), mas a tela
 * (`app/movies/[id].tsx`) desmonta por completo ao sair (é uma tela
 * de pilha, não uma aba) — remontar sempre reinicia `isLoading` pra
 * `true` incondicionalmente (`useMovieDetails.ts`), então o esqueleto
 * pisca por um frame mesmo quando o dado vem do cache. Esta função
 * deixa o hook CONFERIR o cache de forma síncrona antes de decidir se
 * mostra o esqueleto — sem ela, não tinha como o hook saber que a
 * resposta viria instantânea antes de já ter mandado renderizar o
 * esqueleto.
 */
export function peekCachedMovieDetails(movieId: string, language: string): MovieDetails | null {
  const cached = movieDetailsCache.get(`${movieId}:${language}`);
  return cached && cached.expiresAt > Date.now() ? cached.data : null;
}

/** Idêntico a lib/queries/movie.ts do web. */
export async function fetchMovieDetails(movieId: string, language = "pt-BR"): Promise<MovieDetails> {
  const cacheKey = `${movieId}:${language}`;
  const cached = movieDetailsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${SITE_URL}/api/tmdb/movie/${movieId}?language=${language}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "movie details fetch failed");
  }
  const data = (await response.json()) as MovieDetails;
  movieDetailsCache.set(cacheKey, { data, expiresAt: Date.now() + MOVIE_DETAILS_TTL_MS });
  return data;
}

/**
 * Idêntico a movie-status-state.ts do web, ampliado (redesenho da
 * header de Filme, mockup aprovado 2026-09-25) — a header nova mostra
 * a data em que o filme foi assistido (ícone de olho, ao lado da data
 * de lançamento). `status` sozinho não chega lá — precisa de
 * `watched_at` junto (coluna nova, ver
 * `20260925000000_movie_status_watched_at.sql`). Era `fetchMovieStatus`
 * (só `status`); renomeada porque agora devolve os dois — único
 * chamador (`useMovieStatus`, `useMovieDetails.ts`) já foi atualizado
 * junto.
 */
export async function fetchMovieStatusDetails(movieId: number): Promise<{ status: MovieWatchStatus | null; watchedAt: string | null }> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return { status: null, watchedAt: null };

  const { data, error } = await supabase
    .from("movie_status")
    .select("status, watched_at")
    .eq("movie_id", movieId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    status: (data?.status as MovieWatchStatus | undefined) ?? null,
    watchedAt: data?.watched_at ?? null,
  };
}

/** Idêntico a useSetMovieStatus do web: tocar no status já ativo remove; tocar em outro substitui. */
export async function setMovieStatus(movieId: number, status: MovieWatchStatus, currentStatus: MovieWatchStatus | null): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentStatus === status) {
    const { error } = await supabase.from("movie_status").delete().match({ movie_id: movieId, user_id: user.id });
    if (error) throw error;
  } else {
    // `watched_at` só existe enquanto o status atual É "watched" — sai
    // (volta a `null`) em qualquer outra transição (ex.: "assistido" →
    // "quero assistir"), pra não sobrar uma data de "assistido" presa
    // num filme que não está mais marcado como assistido.
    const { error } = await supabase.from("movie_status").upsert({
      user_id: user.id,
      movie_id: movieId,
      status,
      updated_at: new Date().toISOString(),
      watched_at: status === "watched" ? new Date().toISOString() : null,
    });
    if (error) throw error;
    // Gatilho do prompt de avaliação (rodada 2026-09-24) — só quando o
    // status novo é "watched" de verdade (não pra "quero ver"/
    // "assistindo"), mesmo critério de contar assistido usado no resto
    // do app (ver `incrementMovieRewatch` acima).
    if (status === "watched") {
      void notifyWatchedAction();
    }
  }
}

/**
 * A PEDIDO (redesenho da header de Filme) — número REAL de usuários
 * que têm o filme na biblioteca (qualquer status), não só o que a RLS
 * de `movie_status` deixaria o usuário logado enxergar (dono da linha
 * + bibliotecas públicas/seguidos). Função no banco (`security
 * definer`, só devolve o número agregado) — ver
 * `20260925000001_movie_added_count_rpc.sql`.
 */
export async function fetchMovieAddedCount(movieId: number): Promise<number> {
  const { data, error } = await supabase.rpc("get_movie_added_count", { p_movie_id: movieId });
  if (error) throw error;
  return data ?? 0;
}

/**
 * CORREÇÃO (a pedido — auditoria mais rigorosa, achado real: só
 * existia no web) — porta de `useIncrementMovieRewatch` do web
 * (TASK-047). Incrementa `rewatch_count` na mesma linha de
 * `movie_status`, mantém `status="watched"` intocado — nunca cria
 * outra linha, nunca muda o status. Mesma tabela/coluna do web, sem
 * migration nova.
 */
export async function incrementMovieRewatch(movieId: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { data: row, error: readError } = await supabase
    .from("movie_status")
    .select("rewatch_count")
    .eq("user_id", user.id)
    .eq("movie_id", movieId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) throw new Error("Filme não está marcado como assistido — não dá pra reassistir.");

  // `watched_at` também atualiza aqui — decisão minha (não pedida
  // explicitamente): reassistir é o evento de "assistido" mais
  // recente, então a data que a header mostra (ícone de olho) deve
  // refletir isso. Se você preferir que a data fique travada na
  // PRIMEIRA vez que foi assistido, me avisa que eu tiro essa linha.
  const { error: updateError } = await supabase
    .from("movie_status")
    .update({ rewatch_count: (row.rewatch_count ?? 0) + 1, watched_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("movie_id", movieId);
  if (updateError) throw updateError;
}

/** TASK-172 — favoritar filme, achado real: só existia pra série no mobile. Idêntico a fetchIsFavorite de lib/seriesDetails.ts, mesma tabela genérica `favorites`, só troca media_type. */
export async function fetchIsMovieFavorite(movieId: number): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("media_type", "movie")
    .eq("media_id", movieId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleMovieFavorite(movieId: number, currentlyFavorite: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyFavorite) {
    const { error } = await supabase.from("favorites").delete().match({ user_id: user.id, media_type: "movie", media_id: movieId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("favorites").insert({ user_id: user.id, media_type: "movie", media_id: movieId });
    if (error) throw error;
  }
}

/** TASK-172 — remover filme da biblioteca, achado real: menu "..." não existia pra filme. Mais simples que série (sem episódio assistido pra apagar junto). */
export async function removeMovieFromLibrary(movieId: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("movie_status").delete().match({ movie_id: movieId, user_id: user.id });
  if (error) throw error;
}
