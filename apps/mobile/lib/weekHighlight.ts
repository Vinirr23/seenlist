// apps/mobile/lib/weekHighlight.ts
//
// Lógica do "destaque da semana" pro Week Review (2026-09-23, rodada 24).
// Responsabilidade única: dado um usuário e uma semana de calendário
// (segunda a domingo), decidir qual série ou filme é o "destaque" —
// combinando atividade (quanto foi assistido) com a nota que o próprio
// usuário deu (tabela `reviews`, escala 0-5, meio-passo).
//
// NÃO busca título/pôster da obra (isso é responsabilidade de quem
// chama, via TMDB — mesmo padrão já usado em `week-review-test.tsx`
// com `fetchSeriesDetails`/`fetchMovieDetails`) e NÃO chama a geração
// de frase (`week-review-generate`, ver Edge Function) — esta função
// só decide QUAL obra é o destaque, com base em dados 100% locais
// (Supabase), sem nenhuma chamada de IA.
//
// Regras confirmadas com o usuário via `AskUserQuestion` (rodada 24,
// regra do projeto: nunca assumir grandes decisões):
//   1. "Atividade decide, nota desempata" — a obra com mais atividade
//      na semana vence. A nota só entra pra desempatar quando duas ou
//      mais obras têm exatamente a mesma atividade.
//   2. Falta de nota NÃO desqualifica uma obra de ser o destaque — se
//      ela já é a única líder em atividade, vira destaque mesmo sem
//      nota (o card de compartilhar simplesmente não mostra estrelas
//      nesse caso, já suportado por `StarRating`/`ShareCardExport`
//      desde a rodada 23, que aceitam `rating: null`).
//
// Semana de calendário: segunda 00:00 (hora local do aparelho) até o
// domingo seguinte 23:59:59 (exclusivo no fim, ou seja, até a
// próxima segunda 00:00) — decisão já tomada na rodada 23, pra bater
// com a notificação de domingo à noite. Usa hora LOCAL (Date nativo,
// sem UTC), seguindo o mesmo padrão já usado em `yearInReview.ts`
// (`localDateKey`) — não UTC, pra semana do usuário bater com o
// relógio dele, não com um fuso arbitrário do servidor.

import type { SupabaseClient } from "@supabase/supabase-js";

export type WeekHighlightMediaType = "series" | "movie";

export interface WeekHighlight {
  mediaType: WeekHighlightMediaType;
  mediaId: number;
  /**
   * Só preenchido pra série — a temporada com MAIS episódios
   * assistidos pelo usuário nesta semana especificamente (não a
   * "temporada atual" da série em geral). Usada tanto pro rótulo
   * "Temporada X" no card quanto pra buscar a nota certa (ver
   * `rating` abaixo — prioriza review dessa temporada).
   */
  seasonNumber: number | null;
  /**
   * Nota do usuário (0-5, meio-passo), já na escala que `StarRating`/
   * `ShareCardExport` esperam — SEM conversão adicional necessária no
   * chamador. `null` quando o usuário nunca avaliou essa obra (ou essa
   * temporada) — não desqualifica o destaque, só significa "sem
   * estrelas nesse card".
   */
  rating: number | null;
  /** Episódios assistidos nesta semana (série) ou 1 (filme). */
  activityCount: number;
  /** Início da semana de calendário (segunda 00:00 local), ISO. */
  weekStart: string;
  /** Fim EXCLUSIVO da semana (próxima segunda 00:00 local), ISO. */
  weekEnd: string;
}

/** Estatísticas agregadas da semana — mesmos 3 números que o card de compartilhar já exibe (`ShareCardExport`). */
export interface WeekStats {
  episodes: number;
  movies: number;
  series: number;
}

export interface WeekReviewData {
  highlight: WeekHighlight | null;
  stats: WeekStats;
}

/**
 * Segunda 00:00 (local) até a próxima segunda 00:00 (local, exclusivo),
 * pra semana de calendário que contém `referenceDate`.
 */
export function getCalendarWeekBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
  const day = referenceDate.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

type SeriesActivityRow = { series_id: number; season_number: number; watched_at: string };
type MovieActivityRow = { movie_id: number; updated_at: string };
type ReviewRow = { media_type: string; media_id: number; season_number: number | null; rating: number };

interface WeekCandidate {
  mediaType: WeekHighlightMediaType;
  mediaId: number;
  /** Só relevante pra série — temporada com mais atividade nesta semana. */
  topSeasonNumber: number | null;
  activityCount: number;
  /** Timestamp mais recente de atividade — usado só como desempate final determinístico (ver seleção abaixo). */
  lastActivityAt: string;
}

/**
 * Calcula o destaque da semana (calendário atual, ou a que contém
 * `referenceDate` se passado — útil pra testar semanas passadas) pro
 * usuário autenticado no `supabase` recebido.
 *
 * Retorna `highlight: null` quando não houve nenhuma atividade
 * (episódio assistido ou filme completado) na semana — não há o que
 * destacar.
 */
export async function computeWeekHighlight(supabase: SupabaseClient, userId: string, referenceDate: Date = new Date()): Promise<WeekReviewData> {
  const { start, end } = getCalendarWeekBounds(referenceDate);
  const weekStartIso = start.toISOString();
  const weekEndIso = end.toISOString();

  const [{ data: episodeRows }, { data: movieRows }] = await Promise.all([
    supabase
      .from("watched_episodes")
      .select("series_id, season_number, watched_at")
      .eq("user_id", userId)
      .eq("is_special", false)
      .gte("watched_at", weekStartIso)
      .lt("watched_at", weekEndIso),
    supabase
      .from("movie_status")
      .select("movie_id, updated_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("updated_at", weekStartIso)
      .lt("updated_at", weekEndIso),
  ]);

  const episodes = (episodeRows ?? []) as SeriesActivityRow[];
  const movies = (movieRows ?? []) as MovieActivityRow[];

  const stats: WeekStats = {
    episodes: episodes.length,
    movies: movies.length,
    series: new Set(episodes.map((row) => row.series_id)).size,
  };

  if (episodes.length === 0 && movies.length === 0) {
    return { highlight: null, stats };
  }

  // Candidatos-série: agrupa por series_id, e dentro de cada série
  // rastreia qual temporada teve mais episódios assistidos NESTA
  // semana (pode ser diferente da "temporada atual" da série).
  const seriesActivity = new Map<number, { total: number; bySeason: Map<number, number>; lastAt: string }>();
  for (const row of episodes) {
    const entry = seriesActivity.get(row.series_id) ?? { total: 0, bySeason: new Map<number, number>(), lastAt: row.watched_at };
    entry.total += 1;
    entry.bySeason.set(row.season_number, (entry.bySeason.get(row.season_number) ?? 0) + 1);
    if (row.watched_at > entry.lastAt) entry.lastAt = row.watched_at;
    seriesActivity.set(row.series_id, entry);
  }

  const seriesCandidates: WeekCandidate[] = [...seriesActivity.entries()].map(([seriesId, entry]) => {
    const topSeason = [...entry.bySeason.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { mediaType: "series", mediaId: seriesId, topSeasonNumber: topSeason, activityCount: entry.total, lastActivityAt: entry.lastAt };
  });

  // Candidatos-filme: cada filme completado na semana conta como 1
  // unidade de atividade — não dá pra comparar "duração assistida"
  // direto com episódios de série sem uma escala arbitrária, e a
  // decisão confirmada foi "atividade decide, nota desempata" sobre
  // CONTAGEM, não minutos; 1 filme = 1 evento de atividade, do mesmo
  // jeito que 1 episódio = 1 evento.
  const movieCandidates: WeekCandidate[] = movies.map((row) => ({
    mediaType: "movie",
    mediaId: row.movie_id,
    topSeasonNumber: null,
    activityCount: 1,
    lastActivityAt: row.updated_at,
  }));

  const allCandidates = [...seriesCandidates, ...movieCandidates];

  // Passo 1: atividade decide. Ordena por atividade desc; quem tem
  // estritamente mais atividade que o segundo colocado já vence, sem
  // precisar consultar nota nenhuma.
  const sortedByActivity = [...allCandidates].sort((a, b) => b.activityCount - a.activityCount);
  const topCandidate = sortedByActivity[0];
  if (!topCandidate) {
    // Defensivo — `noUncheckedIndexedAccess` exige tratar isso, mas
    // logicamente nunca acontece: `allCandidates` sempre tem pelo
    // menos 1 item aqui, porque o `if (episodes.length === 0 &&
    // movies.length === 0)` acima já retornou antes se não tivesse.
    return { highlight: null, stats };
  }
  const topActivityCount = topCandidate.activityCount;
  const tiedLeaders = sortedByActivity.filter((c) => c.activityCount === topActivityCount);

  let winner: WeekCandidate;
  if (tiedLeaders.length === 1) {
    winner = topCandidate;
  } else {
    // Passo 2: empate de atividade — nota desempata. Busca a nota de
    // cada empatado (ver `fetchRatingForCandidate` abaixo) e escolhe a
    // maior; candidato sem nota entra com -1 (perde pra qualquer nota
    // real, incluindo 0) só nesta comparação de desempate — decisão
    // confirmada foi que falta de nota não desqualifica o destaque
    // quando já é líder ÚNICO, mas aqui, EM EMPATE, um candidato com
    // nota real é uma informação melhor pra decidir do que um sem
    // nenhuma. Se todos os empatados também empatarem em nota (ou
    // nenhum tiver nota), desempate final determinístico: atividade
    // mais recente vence — evita qualquer resultado não-determinístico
    // (mesma entrada sempre dá o mesmo destaque).
    const ratings = await Promise.all(tiedLeaders.map((candidate) => fetchRatingForCandidate(supabase, userId, candidate)));
    let bestIndex = 0;
    for (let i = 1; i < tiedLeaders.length; i++) {
      const current = tiedLeaders[i];
      const best = tiedLeaders[bestIndex];
      if (!current || !best) continue; // defensivo — i e bestIndex sempre dentro do array na prática
      const currentRating = ratings[i] ?? -1;
      const bestRating = ratings[bestIndex] ?? -1;
      if (currentRating > bestRating || (currentRating === bestRating && current.lastActivityAt > best.lastActivityAt)) {
        bestIndex = i;
      }
    }
    const winnerCandidate = tiedLeaders[bestIndex];
    if (!winnerCandidate) {
      // Defensivo, mesmo motivo do topCandidate acima — nunca deveria acontecer.
      return { highlight: null, stats };
    }
    winner = winnerCandidate;
  }

  const winnerRating = await fetchRatingForCandidate(supabase, userId, winner);

  return {
    highlight: {
      mediaType: winner.mediaType,
      mediaId: winner.mediaId,
      seasonNumber: winner.topSeasonNumber,
      rating: winnerRating,
      activityCount: winner.activityCount,
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
    },
    stats,
  };
}

/**
 * Busca a nota do usuário pra um candidato. Pra série, prioriza a
 * review DA TEMPORADA que teve mais atividade na semana (mais
 * específica, mais relevante pro que a pessoa realmente assistiu);
 * se não existir, cai pra review da série inteira (`season_number`
 * nulo). Pra filme, só existe o nível "filme inteiro"
 * (`reviews_movie_has_no_episode` na migration já impede filme ter
 * season/episode preenchidos).
 */
async function fetchRatingForCandidate(supabase: SupabaseClient, userId: string, candidate: WeekCandidate): Promise<number | null> {
  if (candidate.mediaType === "movie") {
    const { data } = await supabase
      .from("reviews")
      .select("rating")
      .eq("user_id", userId)
      .eq("media_type", "movie")
      .eq("media_id", candidate.mediaId)
      .is("season_number", null)
      .is("deleted_at", null)
      .maybeSingle();
    return (data as ReviewRow | null)?.rating ?? null;
  }

  // Série: busca as duas reviews possíveis (temporada específica +
  // série inteira) numa query só, e escolhe no lado do app — mais
  // simples que duas queries sequenciais, e o volume de linhas aqui é
  // sempre 0, 1 ou 2. IMPORTANTE: `.in("season_number", [x, null])`
  // NÃO funciona no PostgREST — `IN` não casa com `NULL` em SQL padrão,
  // a linha da série inteira ficaria de fora silenciosamente. Por isso
  // `.or()` com `is.null` explícito em vez de `.in()`.
  const seasonFilter =
    candidate.topSeasonNumber != null ? `season_number.eq.${candidate.topSeasonNumber},season_number.is.null` : `season_number.is.null`;
  const { data } = await supabase
    .from("reviews")
    .select("season_number, rating")
    .eq("user_id", userId)
    .eq("media_type", "series")
    .eq("media_id", candidate.mediaId)
    .is("episode_number", null)
    .is("deleted_at", null)
    .or(seasonFilter);

  const rows = (data ?? []) as { season_number: number | null; rating: number }[];
  const seasonReview = rows.find((row) => row.season_number === candidate.topSeasonNumber);
  const seriesReview = rows.find((row) => row.season_number === null);
  return seasonReview?.rating ?? seriesReview?.rating ?? null;
}
