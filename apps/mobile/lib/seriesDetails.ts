import type { SeriesDetails, LibraryStatus, CastMember } from "@seenlist/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { todayLocalKey } from "@/lib/localDate";

const SITE_URL = "https://seenlist.app";

/** Idêntico a lib/queries/series.ts do web. */
/**
 * A PEDIDO (auditoria — velocidade percebida) — cache em memória do
 * detalhe de série, com pré-carregamento. Antes, tocar numa série
 * SEMPRE esperava a busca inteira acontecer do zero, mesmo sendo a
 * ação mais previsível do app (o primeiro item de "Continue
 * assistindo" é de longe o mais tocado).
 *
 * `prefetchSeriesDetails` é chamado em silêncio pela Home assim que
 * a lista carrega; quando a pessoa toca, o dado já está pronto e a
 * tela abre sem espera. Falha de rede aqui é ignorada de propósito
 * — é só uma antecipação: se der errado, a tela busca normalmente
 * depois, exatamente como fazia antes.
 */
const SERIES_DETAILS_TTL_MS = 5 * 60 * 1000;
const seriesDetailsCache = new Map<string, { data: SeriesDetails; expiresAt: number }>();

export async function fetchSeriesDetails(seriesId: string): Promise<SeriesDetails> {
  const cached = seriesDetailsCache.get(seriesId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${SITE_URL}/api/tmdb/series/${seriesId}`);
  if (!response.ok) throw new Error("series details fetch failed");
  const data = (await response.json()) as SeriesDetails;
  seriesDetailsCache.set(seriesId, { data, expiresAt: Date.now() + SERIES_DETAILS_TTL_MS });
  return data;
}

export function prefetchSeriesDetails(seriesId: string): void {
  const cached = seriesDetailsCache.get(seriesId);
  if (cached && cached.expiresAt > Date.now()) return;
  fetchSeriesDetails(seriesId).catch(() => {
    // Silencioso de propósito — ver comentário acima.
  });
}

export interface EpisodeContextEpisode {
  seasonNumber: number;
  episodeNumber: number;
}

export interface EpisodeContextSeason {
  seasonNumber: number;
  episodes: EpisodeContextEpisode[];
}

export interface EpisodeSeriesContext {
  title: string;
  matchTitle: string;
  firstAirDate: string | null;
  cast: CastMember[];
  seasons: EpisodeContextSeason[];
}

/**
 * ACHADO DE PERFORMANCE (a pedido — mesmo achado já corrigido na
 * tela de Episódio do web) — a tela de Episódio usava
 * `fetchSeriesDetails`, a MESMA busca pesada da página da série
 * inteira (elenco completo, trailer, galeria, títulos parecidos, e o
 * episódio de TODAS as temporadas) só pra achar "anterior/próximo" e
 * título/elenco pra personagem de anime. Chama a rota nova já criada
 * pro web (`/api/tmdb/series/[id]/season/[season]/episode-context`,
 * o mobile já busca tudo do mesmo backend web) — devolve só o
 * necessário, e busca no máximo 3 temporadas (atual + vizinhas), não
 * todas.
 *
 * Cache em memória por `[seriesId, season]` (não por episódio) —
 * maratonar dentro da mesma temporada não busca nada de novo; só
 * troca ao mudar de temporada. Mesmo espírito do cache de
 * `fetchDisplaySummariesCached` (`lib/library.ts`).
 */
const EPISODE_CONTEXT_TTL_MS = 5 * 60 * 1000;
const episodeContextCache = new Map<string, { data: EpisodeSeriesContext; expiresAt: number }>();

export async function fetchEpisodeSeriesContext(seriesId: string, season: number): Promise<EpisodeSeriesContext> {
  const key = `${seriesId}:${season}`;
  const cached = episodeContextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${SITE_URL}/api/tmdb/series/${seriesId}/season/${season}/episode-context`);
  if (!response.ok) throw new Error("episode series context fetch failed");
  const data = (await response.json()) as EpisodeSeriesContext;
  episodeContextCache.set(key, { data, expiresAt: Date.now() + EPISODE_CONTEXT_TTL_MS });
  return data;
}

export type WatchedEpisodeKey = `${number}-${number}`;

export function episodeKey(seasonNumber: number, episodeNumber: number): WatchedEpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

/** Idêntico a watched-episodes-state.ts do web — mesmo filtro por user_id (RLS sozinha não bastava, história documentada no handoff). */
export async function fetchWatchedEpisodes(seriesId: number): Promise<Set<WatchedEpisodeKey>> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id);
  if (error) throw error;

  return new Set((data ?? []).map((row) => episodeKey(row.season_number, row.episode_number)));
}

/**
 * TASK-096 (detalhes de série) — porta fiel de
 * `seriesCategoryRecalc.ts` do web. Chamado depois de marcar/
 * desmarcar um episódio: decide se a série deve ser promovida pra
 * "Em dia" ou "Concluída" (ou rebaixada de volta), com base em
 * quantos episódios JÁ NO AR foram assistidos.
 *
 * MUDANÇA (a pedido, decisão revertida) — "paused" excluía o
 * recálculo de propósito até aqui. Na prática, isso bloqueava
 * alguém marcando/desmarcando episódio de propósito pra testar se a
 * série já estava em dia — ficava presa em "Interrompidas" pra
 * sempre até trocar o status manualmente. Agora "paused" também
 * participa do recálculo, igual às outras categorias — mesma
 * mudança já aplicada no web.
 */
/**
 * TASK-121 (correção — categoria presa em "Assistindo") — porta de
 * `airDateCategory.ts`. A versão anterior comparava contra o TOTAL
 * de episódios anunciados pelo TMDB (incluindo episódios FUTUROS,
 * ainda sem ir ao ar) — uma série com temporada em andamento (ex.:
 * A Casa do Dragão T3, com episódios de agosto/2026 já anunciados)
 * nunca conseguia sair de "Assistindo", mesmo assistindo tudo que já
 * tinha sido exibido. A comparação certa é só contra o que JÁ FOI AO
 * AR até hoje (`airDate <= hoje`).
 */
function decideWatchingVsUpToDate(
  mainEpisodesWatched: number,
  liveEpisodes: { seasonNumber: number; airDate: string | null }[]
): LibraryStatus {
  const today = todayLocalKey();
  /*
   * CORREÇÃO (bug real, achado investigando "Re:Zero com episódio
   * novo, mas preso em up_to_date há mais de um mês") — mesmo padrão
   * de bug já corrigido em TRÊS outros lugares nesta sessão
   * (`ContinueWatchingCard.tsx` web, `nextEpisodeToWatch.ts` mobile,
   * `check-new-releases`), só que esta função específica — a que
   * decide "watching" vs "up_to_date" pra série já catalogada — tinha
   * ficado de fora daquela rodada. `e.airDate !== null` excluía da
   * contagem qualquer episódio sem data conhecida, mesmo que já
   * tivesse saído de verdade (TMDB às vezes demora a preencher a
   * data do episódio mais recente). Resultado: a conta de "quantos
   * já saíram" ficava artificialmente baixa, a série nunca era
   * promovida de volta pra "watching" — o próprio card de "Continue
   * assistindo" (`nextEpisodeToWatch.ts`) já sabia mostrar o
   * episódio corretamente, só o STATUS da série é que nunca
   * acompanhava.
   *
   * CORREÇÃO 2 (bug NOVO, introduzido pela correção acima — reportado
   * "série com temporada nova confirmada mas SEM data de lançamento
   * foi pra Continue assistindo à toa") — tratar todo `airDate: null`
   * como "já saiu" também captura o caso OPOSTO: temporada anunciada
   * sem nenhuma previsão de estreia — que também tem `airDate: null`,
   * só que por não ter saído NADA ainda, não por atraso do TMDB.
   *
   * A distinção certa: um episódio sem data só conta como "já saiu"
   * se EXISTIR pelo menos um outro episódio da MESMA temporada com
   * data confirmada e já passada — sinal de que a temporada já
   * começou a ir ao ar de verdade, e é só ESSE episódio específico
   * que o TMDB ainda não atualizou. Temporada inteira sem nenhuma
   * data (especulação de futuro) não conta mais.
   */
  const seasonsWithConfirmedAiring = new Set(
    liveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today).map((e) => e.seasonNumber)
  );
  const airedByNow = liveEpisodes.filter(
    (e) => (e.airDate !== null && e.airDate <= today) || (e.airDate === null && seasonsWithConfirmedAiring.has(e.seasonNumber))
  );
  return mainEpisodesWatched < airedByNow.length ? "watching" : "up_to_date";
}

/**
 * TASK-143 (a pedido — série "Em dia" não volta sozinha pra
 * "Assistindo" quando sai episódio novo) — antes, a categoria só era
 * recalculada em resposta a marcar/desmarcar um episódio; passar o
 * tempo e um episódio novo ir ao ar não disparava nada sozinho (nem
 * no web isso existe hoje — decisão nova, só pro nativo, confirmada
 * com o usuário).
 *
 * Chamada toda vez que a aba Séries ganha foco (ver
 * `app/(tabs)/series/index.tsx`). Em LOTE — nunca uma chamada de TMDB
 * por série: busca todas as séries "Em dia" de uma vez, os episódios
 * de todas elas numa chamada só (a rota já aceita lista), e grava as
 * mudanças num único upsert. Só series "Em dia" entram aqui —
 * "Assistindo" já aparece na home de qualquer jeito, "Pausada"/
 * "Assistir depois" continuam de fora de propósito (mesma regra do
 * recálculo individual, decisão explícita do usuário).
 */
const TMDB_EPISODES_CHUNK_SIZE = 20; // a rota /api/tmdb/series-episodes-at-export trunca silenciosamente acima de 20 ids por chamada — precisa dividir.
const WATCHED_EPISODES_PAGE_SIZE = 1000; // limite padrão de linhas por consulta do Supabase/PostgREST — sem paginação, contagens em lote de usuários com muito histórico vinham incompletas.

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * TASK-143 (correção — várias séries "Em dia" viraram "Assistindo" à
 * toa) — causa real encontrada: a busca de episódios no TMDB
 * (`series-episodes-at-export`) trunca silenciosamente acima de 20
 * séries por chamada (limite da própria rota, `MAX_IDS_PER_REQUEST`);
 * E a contagem de episódios assistidos, buscando TODAS as séries "Em
 * dia" de uma vez sem paginação, podia esbarrar no limite padrão de
 * 1000 linhas por consulta do Supabase — series que apareciam DEPOIS
 * desse limite na resposta ficavam com contagem ZERADA, parecendo
 * "nunca comecei a assistir" e virando "Assistindo" à toa, mesmo
 * 100% em dia de verdade.
 */
async function fetchWatchedEpisodeCountsBySeriesId(userId: string, seriesIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();

  const { count, error: countError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_special", false)
    .in("series_id", seriesIds);
  if (countError) throw countError;

  const total = count ?? 0;
  if (total === 0) return counts;

  const pageCount = Math.ceil(total / WATCHED_EPISODES_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * WATCHED_EPISODES_PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id")
        .eq("user_id", userId)
        .eq("is_special", false)
        .in("series_id", seriesIds)
        .range(from, from + WATCHED_EPISODES_PAGE_SIZE - 1);
    })
  );

  for (const page of pages) {
    if (page.error) throw page.error;
    for (const row of page.data ?? []) {
      counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function fetchLiveEpisodesBySeriesId(seriesIds: number[]): Promise<Map<number, { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null }[]>> {
  const result = new Map<number, { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null }[]>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);

  const responses = await Promise.all(
    chunks.map((idsChunk) =>
      fetch(`${SITE_URL}/api/tmdb/series-episodes-at-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: idsChunk }),
      })
    )
  );

  for (const response of responses) {
    if (!response.ok) continue;
    const data = (await response.json()) as {
      series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null }[] }[];
    };
    for (const s of data.series) result.set(s.id, s.episodes);
  }
  return result;
}

async function fetchEndedBySeriesId(seriesIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);

  const responses = await Promise.all(
    chunks.map((idsChunk) =>
      fetch(`${SITE_URL}/api/tmdb/library-summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: idsChunk }),
      })
    )
  );

  for (const response of responses) {
    if (!response.ok) continue;
    const data = (await response.json()) as { series: { id: number; ended: boolean }[] };
    for (const s of data.series) result.set(s.id, s.ended);
  }
  return result;
}

const RECALC_STORAGE_KEY = "seenlist:series-recalc-last-run";
const RECALC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1x por dia — mesma decisão já aplicada no web.

/**
 * ACHADO DE PERFORMANCE (a pedido — mesmo achado já corrigido no
 * web, "Home lenta") — `recalculateUpToDateSeriesCategories`
 * (abaixo) é cara: pra cada série "up_to_date" faz 1 chamada TMDB de
 * temporadas + 1 por temporada, e ainda soma o histórico de episódios
 * assistidos. No mobile isso rodava a CADA foco da aba Séries
 * (`useFocusEffect`), ainda mais frequente que o "toda montagem" do
 * web (trocar de aba e voltar já disparava de novo).
 *
 * Guarda em `AsyncStorage` (equivalente ao `localStorage` do web) o
 * horário da última execução BEM-SUCEDIDA — se rodou há menos de
 * 24h, pula inteiramente. Só grava o carimbo em caso de SUCESSO — se
 * falhar (rede, TMDB fora do ar), tenta de novo no próximo foco em
 * vez de esperar 24h por causa de uma falha passageira.
 */
export async function recalculateUpToDateSeriesCategoriesThrottled(): Promise<void> {
  const lastRun = await AsyncStorage.getItem(RECALC_STORAGE_KEY);
  if (lastRun && Date.now() - Number(lastRun) < RECALC_MIN_INTERVAL_MS) {
    return;
  }

  await recalculateUpToDateSeriesCategories();
  await AsyncStorage.setItem(RECALC_STORAGE_KEY, String(Date.now()));
}

export async function recalculateUpToDateSeriesCategories(): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  /*
   * CORREÇÃO (bug real, reportado — Re:Zero, Tanya the Evil e Tomb
   * Raider King com episódio novo saindo, mas nunca voltando a
   * aparecer em "Continue assistindo") — esta função só reconsiderava
   * série já em `"up_to_date"`. Uma vez que o usuário assiste tudo
   * que existe até então e a série entra em `"completed"` (comum:
   * anime semanal onde a pessoa fica em dia, aí a série "acaba" — só
   * que volta com temporada/episódio novo depois), ela ficava PRESA
   * em completed pra sempre — nada nunca reconsiderava esse status de
   * novo, mesmo o TMDB reportando episódio novo disponível.
   *
   * Agora busca as duas: `up_to_date` E `completed`. A lógica de
   * decisão em si (linha ~334) já estava preparada pra isso — ela
   * calcula a categoria certa do zero a cada vez, a partir do
   * episódio/assistido de verdade, não presume nada do status atual.
   * Só faltava DAR a chance dela reconsiderar série completed.
   */
  const { data: statusRows, error: statusError } = await supabase
    .from("series_status")
    .select("series_id, status")
    .eq("user_id", user.id)
    .in("status", ["up_to_date", "completed"]);
  if (statusError || !statusRows || statusRows.length === 0) return;

  const seriesIds = statusRows.map((row) => row.series_id);
  const currentStatusBySeriesId = new Map(statusRows.map((row) => [row.series_id, row.status as LibraryStatus]));

  let watchedCountBySeriesId: Map<number, number>;
  let episodesBySeriesId: Map<number, { seasonNumber: number; airDate: string | null }[]>;
  let endedBySeriesId: Map<number, boolean>;
  try {
    [watchedCountBySeriesId, episodesBySeriesId, endedBySeriesId] = await Promise.all([
      fetchWatchedEpisodeCountsBySeriesId(user.id, seriesIds),
      fetchLiveEpisodesBySeriesId(seriesIds),
      fetchEndedBySeriesId(seriesIds),
    ]);
  } catch (error) {
    console.error("[recalculateUpToDateSeriesCategories] Falha ao buscar dados em lote — categorias não recalculadas desta vez.", error);
    return;
  }

  const updates: { user_id: string; series_id: number; status: LibraryStatus; updated_at: string }[] = [];
  for (const seriesId of seriesIds) {
    const liveEpisodes = episodesBySeriesId.get(seriesId) ?? [];
    if (liveEpisodes.length === 0) continue; // TMDB não devolveu nada pra essa série desta vez — não mexe, mais seguro do que arriscar errado.

    const watched = watchedCountBySeriesId.get(seriesId) ?? 0;
    const ended = endedBySeriesId.get(seriesId) ?? false;
    const allEpisodesWatched = watched >= liveEpisodes.length;
    const newCategory: LibraryStatus = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes);
    const currentStatus = currentStatusBySeriesId.get(seriesId);

    /*
     * CORREÇÃO (bug real, achado reanalisando "Re:Zero, Tanya the
     * Evil, Tomb Raider King sem aparecer em Continue assistindo" —
     * Tanya e Tomb Raider King NÃO estavam presas em completed, já
     * estavam corretamente em "watching"/"up_to_date". A causa real
     * dessas duas é OUTRA: "Continue assistindo" corta em
     * `CONTINUE_LIMIT` (8) séries, ordenadas por `updated_at` — e
     * esse campo só era tocado quando a CATEGORIA mudava. Uma série
     * que já estava certa (sem mudança de categoria) nunca tinha
     * `updated_at` atualizado, mesmo ganhando episódio novo de
     * verdade — podia afundar no ranking, perdida pra outras séries
     * "mexidas" por qualquer outro motivo, e sair das 8 vagas.
     *
     * Agora, sempre que a categoria calculada é "watching" (existe
     * episódio pendente de verdade — "up_to_date"/"completed" não
     * têm nada pendente, não faz sentido subir no ranking à toa),
     * grava mesmo que a categoria não tenha mudado — só pra
     * atualizar `updated_at`, refletindo "esta série tem conteúdo
     * pendente confirmado agora". Essa função já é limitada por
     * throttle (não roda a cada render), então não vira escrita
     * excessiva.
     */
    if (newCategory !== currentStatus || newCategory === "watching") {
      updates.push({ user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() });
    }
  }

  if (updates.length === 0) return;

  const { error: upsertError } = await supabase.from("series_status").upsert(updates, { onConflict: "user_id,series_id" });
  if (upsertError) {
    console.error("[recalculateUpToDateSeriesCategories] Falha ao gravar categorias recalculadas", upsertError);
  }
}


export async function recalculateSeriesCategoryAfterEpisodeChange(seriesId: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  const { data: statusRow, error: statusError } = await supabase
    .from("series_status")
    .select("status")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (statusError) return;

  const currentStatus = statusRow?.status ?? "watching";
  /*
   * CORREÇÃO (a pedido — Re:Zero/Tanya the Evil/Tomb Raider King
   * presos em "completed" mesmo com episódio novo saindo) — mesmo
   * bug corrigido no web (`seriesCategoryRecalc.ts`) e na função em
   * lote logo acima (`recalculateUpToDateSeriesCategories`):
   * "completed" nunca era elegível pra reconsideração aqui.
   */
  const eligible =
    currentStatus === "watching" ||
    currentStatus === "up_to_date" ||
    currentStatus === "want_to_watch" ||
    currentStatus === "paused" ||
    currentStatus === "completed";

  if (!eligible) return;

  const { count: watchedCount } = await supabase
    .from("watched_episodes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("is_special", false);

  let liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] = [];
  let ended = false;
  try {
    const [episodesResponse, summaryResponse] = await Promise.all([
      fetch(`${SITE_URL}/api/tmdb/series-episodes-at-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: [seriesId] }),
      }),
      fetch(`${SITE_URL}/api/tmdb/library-summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: [seriesId] }),
      }),
    ]);
    if (episodesResponse.ok) {
      const data = (await episodesResponse.json()) as {
        series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] }[];
      };
      liveEpisodes = data.series.find((s) => s.id === seriesId)?.episodes ?? [];
    }
    if (summaryResponse.ok) {
      const data = (await summaryResponse.json()) as { series: { id: number; ended: boolean }[] };
      ended = data.series.find((s) => s.id === seriesId)?.ended ?? false;
    }
  } catch (error) {
    console.error("[series-category-recalc] Falha ao buscar dados do TMDB — categoria não recalculada desta vez.", error);
    return;
  }

  if (liveEpisodes.length === 0) {
    return;
  }

  const watched = watchedCount ?? 0;
  const allEpisodesWatched = watched >= liveEpisodes.length;
  const newCategory: LibraryStatus = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes);

  /*
   * CORREÇÃO (mesma auditoria — consistência com
   * `recalculateUpToDateSeriesCategories`, mesmo arquivo) — antes,
   * categoria sem mudança = SEM gravar nada, nem quando o usuário
   * tinha acabado de marcar episódio (interação real, agora mesmo).
   * "watching" sem mudança de categoria ainda assim atualiza
   * `updated_at` — é o campo que decide a ordem de "Continue
   * assistindo" (corte de `CONTINUE_LIMIT`), e essa série tem
   * episódio pendente de verdade, merece refletir isso na ordenação.
   */
  if (newCategory === currentStatus && newCategory !== "watching") return;

  const { error: updateError } = await supabase
    .from("series_status")
    .upsert(
      { user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() },
      { onConflict: "user_id,series_id" }
    );
  if (updateError) {
    console.error("[series-category-recalc] Falha ao atualizar categoria depois de marcar episódio.", updateError);
  }
}

/** Idêntico a useToggleEpisodeWatched do web, sem otimismo de cache (o hook em useWatchedEpisodes.ts cuida disso). */
export async function toggleEpisodeWatched(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number,
  currentlyWatched: boolean
): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyWatched) {
    const { error } = await supabase
      .from("watched_episodes")
      .delete()
      .match({ series_id: seriesId, season_number: seasonNumber, episode_number: episodeNumber, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("watched_episodes").insert({
      user_id: user.id,
      series_id: seriesId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    });
    if (error) throw error;
  }

  await recalculateSeriesCategoryAfterEpisodeChange(seriesId);
}

/**
 * TASK-113 (retoques de Séries) — porta de useMarkEpisodesWatched:
 * marca vários episódios de uma vez (um UPSERT só, não um insert por
 * episódio) — usado tanto por "marcar episódios anteriores?" quanto
 * por "marcar temporada inteira".
 */
export async function markEpisodesWatched(seriesId: number, episodes: { seasonNumber: number; episodeNumber: number }[]): Promise<void> {
  if (episodes.length === 0) return;
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const rows = episodes.map((e) => ({
    user_id: user.id,
    series_id: seriesId,
    season_number: e.seasonNumber,
    episode_number: e.episodeNumber,
  }));

  const { error } = await supabase
    .from("watched_episodes")
    .upsert(rows, { onConflict: "user_id,series_id,season_number,episode_number", ignoreDuplicates: true });
  if (error) throw error;

  await recalculateSeriesCategoryAfterEpisodeChange(seriesId);
}

/** Idêntico a useUnmarkSeasonWatched do web — um DELETE só (por series_id + season_number), não um por episódio. */
export async function unmarkSeasonWatched(seriesId: number, seasonNumber: number): Promise<void> {
  const { error } = await supabase.from("watched_episodes").delete().match({ series_id: seriesId, season_number: seasonNumber });
  if (error) throw error;

  await recalculateSeriesCategoryAfterEpisodeChange(seriesId);
}

/**
 * Idêntico a useIncrementEpisodeRewatch do web — incrementa
 * `rewatch_count` na MESMA linha (nunca cria outra) e
 * `total_watch_events` em `series_status`. Não mexe no conjunto de
 * episódios assistidos nem recalcula categoria — reassistir não muda
 * progresso nem status, só estatística de consumo.
 */
export async function incrementEpisodeRewatch(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { data: episodeRow, error: readError } = await supabase
    .from("watched_episodes")
    .select("rewatch_count")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber)
    .maybeSingle();
  if (readError) throw readError;
  if (!episodeRow) throw new Error("Episódio não está marcado como assistido — não dá pra reassistir.");

  const { error: updateError } = await supabase
    .from("watched_episodes")
    .update({ rewatch_count: (episodeRow.rewatch_count ?? 0) + 1 })
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber);
  if (updateError) throw updateError;

  const { data: statusRow, error: statusReadError } = await supabase
    .from("series_status")
    .select("total_watch_events")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (statusReadError) throw statusReadError;
  if (statusRow) {
    const { error: statusUpdateError } = await supabase
      .from("series_status")
      .update({ total_watch_events: (statusRow.total_watch_events ?? 0) + 1 })
      .eq("user_id", user.id)
      .eq("series_id", seriesId);
    if (statusUpdateError) throw statusUpdateError;
  }
}

/** TASK-115 (episódio) — checagem leve, um episódio só (a tela de detalhes do episódio não precisa da lista inteira de watched_episodes da série). */
export async function isEpisodeWatched(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("series_id")
    .eq("series_id", seriesId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function fetchIsFavorite(seriesId: number): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("media_type", "series")
    .eq("media_id", seriesId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Idêntico a useToggleFavorite do web. */
export async function toggleFavorite(seriesId: number, currentlyFavorite: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyFavorite) {
    const { error } = await supabase.from("favorites").delete().match({ user_id: user.id, media_type: "series", media_id: seriesId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("favorites").insert({ user_id: user.id, media_type: "series", media_id: seriesId });
    if (error) throw error;
  }
}

/** Idêntico a useRemoveLibraryItem do web (ramo série): apaga episódios assistidos E o status — reset completo, não soft-delete. */
export async function removeSeriesFromLibrary(seriesId: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error: episodesError } = await supabase.from("watched_episodes").delete().match({ series_id: seriesId, user_id: user.id });
  if (episodesError) throw episodesError;

  const { error: statusError } = await supabase.from("series_status").delete().match({ series_id: seriesId, user_id: user.id });
  if (statusError) throw statusError;
}

// ---------------------------------------------------------------
// Carrossel de "próximos episódios" (topo da aba Episódios)
// ---------------------------------------------------------------

export interface EpisodeRef {
  seasonNumber: number;
  episode: SeriesDetails["seasons"][number]["episodes"][number];
}

function isAired(episode: EpisodeRef["episode"], today: Date): boolean {
  if (!episode.airDate) return false;
  return new Date(`${episode.airDate}T00:00:00`) <= today;
}

/**
 * Pedido explícito do usuário (diferente do web neste ponto
 * específico): o carrossel deve mostrar episódios já lançados EM
 * ORDEM, estejam assistidos ou não — não só os pendentes. O web
 * escondia os já assistidos (`getPendingEpisodes`); aqui não.
 */
function getPendingEpisodes(seasons: SeriesDetails["seasons"], _watched: Set<WatchedEpisodeKey>): EpisodeRef[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: EpisodeRef[] = [];

  for (const season of [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
    for (const episode of [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      if (!isAired(episode, today)) continue;
      result.push({ seasonNumber: season.seasonNumber, episode });
    }
  }
  return result;
}

/** Idêntico a getNextUpcomingEpisode do web. */
function getNextUpcomingEpisode(seasons: SeriesDetails["seasons"]): EpisodeRef | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let best: EpisodeRef | null = null;

  for (const season of seasons) {
    for (const episode of season.episodes) {
      if (!episode.airDate) continue;
      const airDate = new Date(`${episode.airDate}T00:00:00`);
      if (airDate <= today) continue;
      if (!best || !best.episode.airDate || airDate < new Date(`${best.episode.airDate}T00:00:00`)) {
        best = { seasonNumber: season.seasonNumber, episode };
      }
    }
  }
  return best;
}

/**
 * Idêntico a resolveCarouselEpisodes do web, com divergência
 * proposital (achado real, TASK-170, ajustado duas vezes a pedido)
 * — não depende mais da categoria pra decidir o que mostrar. Sempre
 * mostra todos os episódios já lançados em ordem (assistidos ou
 * não), pra qualquer status de biblioteca, inclusive "Concluída"/
 * "Assistir depois"/sem status nenhum — antes disso ficava vazio
 * bem na hora que a série virava "Em dia" ou "Concluída", que era
 * exatamente quando um histórico completo fazia mais sentido de
 * ver. `category` continua no parâmetro só pra não quebrar quem já
 * chama esta função — não é mais usado no corpo.
 */
export function resolveCarouselEpisodes(
  _category: LibraryStatus | null | undefined,
  seasons: SeriesDetails["seasons"],
  watched: Set<WatchedEpisodeKey>
): EpisodeRef[] {
  return getPendingEpisodes(seasons, watched);
}
export async function fetchSeriesStatus(seriesId: number): Promise<LibraryStatus | null> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("series_status")
    .select("status")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const status = data?.status as LibraryStatus | "removed" | undefined;
  return status && status !== "removed" ? status : null;
}

/** Idêntico a useSetSeriesStatus do web: tocar no status já ativo remove (volta pro derivado); tocar em outro substitui. */
export async function setSeriesStatus(seriesId: number, status: LibraryStatus, currentStatus: LibraryStatus | null): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentStatus === status) {
    const { error } = await supabase.from("series_status").delete().match({ series_id: seriesId, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("series_status").upsert({
      user_id: user.id,
      series_id: seriesId,
      status,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}
