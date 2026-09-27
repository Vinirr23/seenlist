// supabase/functions/week-review-pregenerate/index.ts
//
// Pré-geração do "destaque da semana" (rodada 27, 2026-09-23) — resolve
// a latência real reportada na rodada 24 ("demora bastante", "precisa
// ser instantâneo"). Decisão do usuário naquela rodada: pré-gerar com
// antecedência via job agendado, em vez de calcular ao vivo toda vez
// que a tela real (`app/week-review.tsx`) abre. Os dois bloqueios
// (lógica de destaque, rodada 25; tela real, rodada 26) já estavam
// resolvidos quando esta function foi escrita.
//
// Mesmo padrão arquitetural de `daily-status-recalc` (Edge Function já
// existente): roda 1x por semana, passa por TODOS os usuários com
// atividade na semana, `EdgeRuntime.waitUntil` responde na hora e
// deixa o processamento de verdade rodar por trás, sem prazo imposto
// por quem chamou o cron.
//
// AVISO DE DUPLICAÇÃO (mesmo problema já documentado em
// `daily-status-recalc`, ver comentário lá) — a lógica de "qual obra é
// o destaque" abaixo (`pickWeekWinner`/`fetchRatingForCandidate`) é uma
// CÓPIA da lógica real em `apps/mobile/lib/weekHighlight.ts`
// (`computeWeekHighlight`). Edge Functions rodam em Deno e não
// conseguem importar código de dentro do app Expo/React Native — se
// as regras de "destaque da semana" mudarem no futuro (fórmula de
// pontuação, critério de desempate, etc.), esta cópia PRECISA ser
// atualizada junto, manualmente. Qualquer mudança futura na lógica de
// destaque: atualizar os dois lugares, não só um.
//
// FUSO HORÁRIO (decisão confirmada com o usuário via `AskUserQuestion`,
// rodada 27) — `computeWeekHighlight` usa a hora LOCAL do aparelho pra
// calcular a semana de calendário (segunda a domingo), porque roda no
// celular. Este job roda no SERVIDOR, que não tem como saber o fuso de
// cada usuário (não existe coluna de timezone no banco). Decisão:
// assumir Brasília (UTC-3, sem horário de verão — extinto no Brasil
// desde 2019) pra todo mundo. Se um usuário estiver em outro fuso, a
// semana pré-calculada pode ficar levemente diferente da que ele veria
// ao vivo no celular — risco pequeno, aceito conscientemente. Se isso
// um dia importar de verdade, a correção é guardar o fuso de cada
// usuário (coluna nova em `profiles`) — não assumir, perguntar antes.
// A conta de fuso em si (`getBrasiliaCalendarWeekBounds`) foi extraída
// pra `_shared/weekBounds.ts` na rodada 29, porque `week-review-notify`
// (nova function daquela rodada) precisa calcular EXATAMENTE a mesma
// janela de semana pra encontrar as linhas que esta function gravou —
// duas cópias da mesma conta de fuso divergirem silenciosamente no
// futuro seria pior do que compartilhar o código.
//
// FALLBACK, não fonte única de verdade — se este job falhar (por
// usuário, ou inteiro), a tela real continua funcionando exatamente
// como antes desta rodada: calcula tudo ao vivo (`computeWeekHighlight`)
// quando não encontra uma linha pré-gerada pra semana atual. Por isso,
// qualquer erro AQUI é logado e pulado (por usuário), nunca trava o job
// inteiro.
//
// COR DOMINANTE DO BACKDROP (pendência atacada logo depois da rodada
// 29) — decisão confirmada com o usuário via `AskUserQuestion`: calcular
// aqui, no servidor (Deno, decodificador JPEG puro-JS via `npm:jpeg-js`,
// sem nenhum módulo nativo), em vez de uma biblioteca nativa no app —
// que exigiria build de dev client novo, mesmo problema já vivido nas
// rodadas 19-20 com `react-native-view-shot`/`expo-sharing`. Guardamos
// só a cor "crua" (`extractDominantColorHex`, média de pixel filtrada)
// — o ajuste pra virar cor de GLOW de verdade (saturação/luminosidade,
// mais a cor secundária) fica no cliente (`apps/mobile/lib/glowBlobs.ts`,
// `buildWeekReviewGlowBlobs`), pra não duplicar essa conta em Deno E em
// React Native. Qualquer falha na extração (fetch, decode) é logada e
// vira `null` — nunca derruba o processamento do usuário; a tela real
// já trata `dominant_color: null` caindo pro glow fixo violeta/magenta.
// CONFIRMADO POR EXECUÇÃO REAL (rodada 30, teste manual via SQL Editor)
// — `npm:jpeg-js` funciona de verdade no Supabase Edge Runtime; um
// usuário de teste real recebeu `dominant_color = #657162`, hex
// plausível, confirmando fetch + decode + média de pixel ponta a ponta.
//
// GERAÇÃO DE FRASE POR IA — REMOVIDA POR COMPLETO (rodada 31,
// 2026-09-23) — a rodada 30 tinha corrigido um bug real (falha de
// geração de frase descartando a cor dominante já extraída com
// sucesso), mas o problema de fundo continuou: cota do Gemini
// esgotada (429) por causa dos próprios testes manuais desta sessão,
// e mesmo quando funcionava, latência alta e qualidade inconsistente
// ("sem graça", mesmo depois do prompt reforçado na rodada 27).
// Decisão do usuário: trocar a frase por um elemento 100%
// determinístico — sem chamada de rede nenhuma, sem custo de API, sem
// rate limit — calculado a partir de dados que este job já tem:
// "recorde pessoal" (quantos episódios/filmes da obra em destaque o
// usuário assistiu essa semana — já é `winner.activityCount`, não
// precisa de cálculo novo) + "selo de sequência" (quantas semanas
// seguidas a mesma obra foi o destaque, ver `computeStreakWeeks`
// abaixo). O módulo `_shared/weekReviewPhrases.ts` e a Edge Function
// `week-review-generate` não são mais usados em lugar nenhum do
// projeto e devem ser apagados do repositório (arquivo local, não
// alcançável a partir daqui) — ver instrução de remoção passada ao
// usuário junto com esta mudança.

import { createClient } from "jsr:@supabase/supabase-js@2";
import jpeg from "npm:jpeg-js@0.4.4";
import { getBrasiliaCalendarWeekBounds } from "../_shared/weekBounds.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Mesmo teto padrão do Supabase (1000 linhas por consulta) — mesma
// paginação (contagem primeiro, todas as páginas em paralelo, sempre
// com `.order()` implícito por não precisar de ordem nenhuma aqui) já
// usada em `daily-status-recalc`.
const PAGE_SIZE = 1000;

// Quantos usuários processar em paralelo (TMDB + upsert por usuário).
// Sem chamada ao Gemini mais (rodada 31), não há mais cota de IA pra
// proteger — mas mantido moderado (não subido pros 15 de
// `daily-status-recalc`) porque ainda existe uma chamada de rede por
// usuário pro TMDB (detalhes + backdrop pra extração de cor).
const USER_CONCURRENCY = 8;

async function tmdbGet<T>(path: string): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "pt-BR");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB respondeu ${response.status} em ${path}`);
  return (await response.json()) as T;
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

/** Busca TODAS as linhas de uma tabela que passam pelo filtro, paginando — mesmo padrão de `daily-status-recalc`. */
async function fetchAllPages<T>(
  supabase: SupabaseClientAny,
  table: string,
  applyFilter: (query: SupabaseClientAny) => SupabaseClientAny,
): Promise<T[]> {
  const { count, error: countError } = await applyFilter(supabase.from(table).select("*", { count: "exact", head: true }));
  if (countError) {
    console.error(`[week-review-pregenerate] Falha ao contar ${table}`, countError);
    return [];
  }
  const pageCount = Math.ceil((count ?? 0) / PAGE_SIZE);
  if (pageCount === 0) return [];

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      const from = i * PAGE_SIZE;
      return applyFilter(supabase.from(table).select("*")).range(from, from + PAGE_SIZE - 1);
    }),
  );

  const rows: T[] = [];
  for (const page of pages) {
    if (page.error) {
      console.error(`[week-review-pregenerate] Falha ao paginar ${table}`, page.error);
      continue;
    }
    rows.push(...((page.data ?? []) as T[]));
  }
  return rows;
}

type SeriesActivityRow = { user_id: string; series_id: number; season_number: number; watched_at: string };
type MovieActivityRow = { user_id: string; movie_id: number; updated_at: string };
type ReviewRow = { season_number: number | null; rating: number };

type MediaType = "series" | "movie";

interface WeekCandidate {
  mediaType: MediaType;
  mediaId: number;
  topSeasonNumber: number | null;
  activityCount: number;
  lastActivityAt: string;
}

/**
 * CÓPIA da lógica de seleção de vencedor de `computeWeekHighlight`
 * (`apps/mobile/lib/weekHighlight.ts`) — ver aviso de duplicação no
 * topo do arquivo. Mesmas 2 regras confirmadas com o usuário na rodada
 * 25: atividade decide, nota desempata; falta de nota não desqualifica.
 */
async function pickWeekWinner(
  supabase: SupabaseClientAny,
  userId: string,
  episodes: SeriesActivityRow[],
  movies: MovieActivityRow[],
): Promise<WeekCandidate | null> {
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

  const movieCandidates: WeekCandidate[] = movies.map((row) => ({
    mediaType: "movie",
    mediaId: row.movie_id,
    topSeasonNumber: null,
    activityCount: 1,
    lastActivityAt: row.updated_at,
  }));

  const allCandidates = [...seriesCandidates, ...movieCandidates];
  if (allCandidates.length === 0) return null;

  const sortedByActivity = [...allCandidates].sort((a, b) => b.activityCount - a.activityCount);
  const topCandidate = sortedByActivity[0];
  if (!topCandidate) return null;

  const topActivityCount = topCandidate.activityCount;
  const tiedLeaders = sortedByActivity.filter((c) => c.activityCount === topActivityCount);

  if (tiedLeaders.length === 1) return topCandidate;

  const ratings = await Promise.all(tiedLeaders.map((candidate) => fetchRatingForCandidate(supabase, userId, candidate)));
  let bestIndex = 0;
  for (let i = 1; i < tiedLeaders.length; i++) {
    const current = tiedLeaders[i];
    const best = tiedLeaders[bestIndex];
    if (!current || !best) continue;
    const currentRating = ratings[i] ?? -1;
    const bestRating = ratings[bestIndex] ?? -1;
    if (currentRating > bestRating || (currentRating === bestRating && current.lastActivityAt > best.lastActivityAt)) {
      bestIndex = i;
    }
  }
  return tiedLeaders[bestIndex] ?? topCandidate;
}

/** CÓPIA de `fetchRatingForCandidate` em `weekHighlight.ts` — mesmo aviso de duplicação. */
async function fetchRatingForCandidate(supabase: SupabaseClientAny, userId: string, candidate: WeekCandidate): Promise<number | null> {
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
    return (data as { rating: number } | null)?.rating ?? null;
  }

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

  const rows = (data ?? []) as ReviewRow[];
  const seasonReview = rows.find((row) => row.season_number === candidate.topSeasonNumber);
  const seriesReview = rows.find((row) => row.season_number === null);
  return seasonReview?.rating ?? seriesReview?.rating ?? null;
}

type TmdbMediaDetails = { title: string; backdropPath: string | null; posterPath: string | null };

async function fetchMediaDetailsFromTmdb(mediaType: MediaType, mediaId: number): Promise<TmdbMediaDetails | null> {
  try {
    if (mediaType === "movie") {
      const details = await tmdbGet<{ title: string; backdrop_path: string | null; poster_path: string | null }>(`/movie/${mediaId}`);
      return { title: details.title, backdropPath: details.backdrop_path, posterPath: details.poster_path };
    }
    const details = await tmdbGet<{ name: string; backdrop_path: string | null; poster_path: string | null }>(`/tv/${mediaId}`);
    return { title: details.name, backdropPath: details.backdrop_path, posterPath: details.poster_path };
  } catch (error) {
    console.error(`[week-review-pregenerate] Falha ao buscar detalhes no TMDB (${mediaType} ${mediaId})`, error);
    return null;
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Extração de cor dominante — ver comentário grande no topo do arquivo.
 * Amostra até ~4000 pixels (passo calculado pra imagens pequenas, w185
 * do TMDB já é ~185×104 ≈ 19k pixels no total — decodificar inteiro é
 * barato, amostrar só evita somar 19k pixels à toa), filtrando pixels
 * quase pretos/brancos (luma < 15 ou > 240) — bordas escuras de
 * letreiro ou áreas de céu estourado não deveriam dominar a média.
 * Se TODOS os pixels amostrados forem extremos (imagem quase toda
 * preta ou branca), usa a média sem filtro em vez de desistir.
 */
async function extractDominantColorHex(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    const decoded = jpeg.decode(buffer, { useTArray: true }) as { width: number; height: number; data: Uint8Array };

    const totalPixels = decoded.width * decoded.height;
    if (totalPixels === 0) return null;
    const stride = Math.max(1, Math.floor(totalPixels / 4000));

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    let rSumAll = 0, gSumAll = 0, bSumAll = 0, countAll = 0;

    for (let i = 0; i < totalPixels; i += stride) {
      const offset = i * 4;
      const r = decoded.data[offset]!;
      const g = decoded.data[offset + 1]!;
      const b = decoded.data[offset + 2]!;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      rSumAll += r;
      gSumAll += g;
      bSumAll += b;
      countAll += 1;
      if (luma > 15 && luma < 240) {
        rSum += r;
        gSum += g;
        bSum += b;
        count += 1;
      }
    }

    if (count === 0) {
      if (countAll === 0) return null;
      return rgbToHex(Math.round(rSumAll / countAll), Math.round(gSumAll / countAll), Math.round(bSumAll / countAll));
    }
    return rgbToHex(Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count));
  } catch (error) {
    console.error(`[week-review-pregenerate] Falha ao extrair cor dominante de ${imageUrl}`, error);
    return null;
  }
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Selo de sequência (rodada 31) — quantas semanas seguidas (incluindo
 * esta) a mesma obra (`mediaType`+`mediaId`) foi o destaque deste
 * usuário. Olha só as linhas que ESTE MESMO job já gravou em semanas
 * anteriores (`week_review_pregenerated`), andando pra trás a partir
 * da semana atual: cada passo espera encontrar uma linha com
 * `week_start` EXATAMENTE 7 dias antes da anterior (o job roda sempre
 * no mesmo horário semanal, então a diferença é sempre exatamente
 * 7 dias quando não há buraco) e a mesma obra — no primeiro `week_start`
 * que não bate ou obra diferente, a sequência para. Limitado a olhar
 * até 12 semanas pra trás (não tem sentido nenhum mostrar "53ª semana
 * seguida" na UI, e evita uma consulta sem limite).
 *
 * Se o job não rodou numa semana (buraco), ou se a linha daquela
 * semana nunca existiu (usuário só começou a ser processado depois),
 * a sequência simplesmente para ali — não tenta adivinhar nem
 * preencher lacuna nenhuma.
 */
async function computeStreakWeeks(
  supabase: SupabaseClientAny,
  userId: string,
  mediaType: MediaType,
  mediaId: number,
  currentWeekStartIso: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("week_review_pregenerated")
    .select("week_start, media_type, media_id")
    .eq("user_id", userId)
    .lt("week_start", currentWeekStartIso)
    .order("week_start", { ascending: false })
    .limit(12);

  if (error || !data) return 1;

  let streak = 1;
  let expectedWeekStart = new Date(currentWeekStartIso).getTime() - ONE_WEEK_MS;
  for (const row of data as { week_start: string; media_type: MediaType; media_id: number }[]) {
    const rowWeekStart = new Date(row.week_start).getTime();
    if (rowWeekStart !== expectedWeekStart) break; // buraco na sequência — semana pulada ou job não rodou naquela semana
    if (row.media_type !== mediaType || row.media_id !== mediaId) break; // obra diferente — sequência quebrada
    streak += 1;
    expectedWeekStart -= ONE_WEEK_MS;
  }
  return streak;
}

type ProcessResult = "processed" | "no_activity" | "skipped_no_title";

async function processUser(
  supabase: SupabaseClientAny,
  userId: string,
  activity: { episodes: SeriesActivityRow[]; movies: MovieActivityRow[] },
  weekStartIso: string,
  weekEndIso: string,
): Promise<ProcessResult> {
  const winner = await pickWeekWinner(supabase, userId, activity.episodes, activity.movies);
  if (!winner) return "no_activity"; // defensivo — não deveria acontecer (usuário só entra no mapa com atividade real)

  const details = await fetchMediaDetailsFromTmdb(winner.mediaType, winner.mediaId);
  const title = details?.title ?? null;
  if (!title) return "skipped_no_title";

  // Backdrop preferido, poster como fallback (mesma ordem de preferência
  // que a tela real já usa pra exibir a imagem) — usado só pra extrair a
  // cor dominante, nunca falha o processamento do usuário se der errado.
  const imagePath = details?.backdropPath ?? details?.posterPath ?? null;
  const dominantColor = imagePath ? await extractDominantColorHex(`https://image.tmdb.org/t/p/w185${imagePath}`) : null;

  const [rating, streakWeeks] = await Promise.all([
    fetchRatingForCandidate(supabase, userId, winner),
    computeStreakWeeks(supabase, userId, winner.mediaType, winner.mediaId, weekStartIso),
  ]);

  const { error: upsertError } = await supabase.from("week_review_pregenerated").upsert(
    {
      user_id: userId,
      week_start: weekStartIso,
      week_end: weekEndIso,
      media_type: winner.mediaType,
      media_id: winner.mediaId,
      season_number: winner.topSeasonNumber,
      // Título salvo aqui (rodada 29) pra `week-review-notify` conseguir
      // montar o texto da notificação sem precisar consultar o TMDB de
      // novo — já buscamos o título nesta função mesmo (linha acima),
      // reaproveitar evita uma segunda chamada de rede pro mesmo dado.
      title,
      // Cor dominante do backdrop (rodada 30) — ver comentário grande no
      // topo do arquivo. `null` quando a extração falha; a tela real
      // trata isso caindo pro glow fixo, nunca quebra.
      dominant_color: dominantColor,
      rating,
      activity_count: winner.activityCount,
      // Selo de sequência (rodada 31) — ver `computeStreakWeeks` acima.
      // `1` quando não há sequência real (valor neutro); a UI só mostra
      // o selo quando >= 2.
      streak_weeks: streakWeeks,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" },
  );

  if (upsertError) {
    console.error(`[week-review-pregenerate] Falha ao gravar linha pra usuário ${userId}`, upsertError);
    return "skipped_no_title";
  }

  return "processed";
}

async function weekReviewPregenerate(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY) as SupabaseClientAny;

  const { start, end } = getBrasiliaCalendarWeekBounds();
  const weekStartIso = start.toISOString();
  const weekEndIso = end.toISOString();

  const [episodeRows, movieRows] = await Promise.all([
    fetchAllPages<SeriesActivityRow>(supabase, "watched_episodes", (q) =>
      q.select("user_id, series_id, season_number, watched_at").eq("is_special", false).gte("watched_at", weekStartIso).lt("watched_at", weekEndIso),
    ),
    fetchAllPages<MovieActivityRow>(supabase, "movie_status", (q) =>
      q.select("user_id, movie_id, updated_at").eq("status", "completed").gte("updated_at", weekStartIso).lt("updated_at", weekEndIso),
    ),
  ]);

  const byUser = new Map<string, { episodes: SeriesActivityRow[]; movies: MovieActivityRow[] }>();
  for (const row of episodeRows) {
    const entry = byUser.get(row.user_id) ?? { episodes: [], movies: [] };
    entry.episodes.push(row);
    byUser.set(row.user_id, entry);
  }
  for (const row of movieRows) {
    const entry = byUser.get(row.user_id) ?? { episodes: [], movies: [] };
    entry.movies.push(row);
    byUser.set(row.user_id, entry);
  }

  console.log(`[week-review-pregenerate] semana ${weekStartIso}..${weekEndIso} — ${byUser.size} usuários com atividade`);

  const userIds = [...byUser.keys()];
  const counts: Record<ProcessResult, number> = { processed: 0, no_activity: 0, skipped_no_title: 0 };
  let errors = 0;

  for (let i = 0; i < userIds.length; i += USER_CONCURRENCY) {
    const batch = userIds.slice(i, i + USER_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((userId) => processUser(supabase, userId, byUser.get(userId)!, weekStartIso, weekEndIso)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        counts[result.value]++;
      } else {
        errors++;
        console.error("[week-review-pregenerate] Falha inesperada ao processar usuário", result.reason);
      }
    }
  }

  console.log(
    `[week-review-pregenerate] concluído — processados=${counts.processed} sem-atividade=${counts.no_activity} sem-titulo=${counts.skipped_no_title} erros=${errors}`,
  );
}

Deno.serve(() => {
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(weekReviewPregenerate());
  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
