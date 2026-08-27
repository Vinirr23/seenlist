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

export async function fetchSeriesDetails(seriesId: string, language = "pt-BR"): Promise<SeriesDetails> {
  const cacheKey = `${seriesId}:${language}`;
  const cached = seriesDetailsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${SITE_URL}/api/tmdb/series/${seriesId}?language=${language}`);
  if (!response.ok) throw new Error("series details fetch failed");
  const data = (await response.json()) as SeriesDetails;
  seriesDetailsCache.set(cacheKey, { data, expiresAt: Date.now() + SERIES_DETAILS_TTL_MS });
  return data;
}

export function prefetchSeriesDetails(seriesId: string, language = "pt-BR"): void {
  const cached = seriesDetailsCache.get(`${seriesId}:${language}`);
  if (cached && cached.expiresAt > Date.now()) return;
  fetchSeriesDetails(seriesId, language).catch(() => {
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

export async function fetchEpisodeSeriesContext(seriesId: string, season: number, language = "pt-BR"): Promise<EpisodeSeriesContext> {
  const key = `${seriesId}:${season}:${language}`;
  const cached = episodeContextCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${SITE_URL}/api/tmdb/series/${seriesId}/season/${season}/episode-context?language=${language}`);
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
 * CORREÇÃO (2026-08-26 — "motor resistente a fusão de temporadas pela
 * TMDB") — companheiro de `fetchWatchedEpisodes`, mesmo raciocínio do
 * web (`watched-episodes-state.ts`): Set com o ID FIXO da TMDB de
 * cada episódio (não-especial) já assistido — sobrevive a uma futura
 * reestruturação de temporadas pela própria TMDB, diferente da chave
 * (temporada-episódio), que ela pode mudar por baixo dos panos (já
 * mudou, pra várias séries — ver migração
 * 20260907000000_watched_episodes_tmdb_episode_id.sql).
 */
export async function fetchWatchedEpisodeIds(seriesId: number): Promise<Set<number>> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("tmdb_episode_id")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .eq("is_special", false)
    .not("tmdb_episode_id", "is", null);
  if (error) throw error;

  return new Set((data ?? []).map((row) => row.tmdb_episode_id as number));
}

/**
 * CORREÇÃO (2026-08-26 — "motor resistente") — idêntico a
 * `isEpisodeWatched` (watched-episodes-state.ts do web), com outro
 * nome aqui porque este arquivo já exporta um `isEpisodeWatched`
 * diferente (checagem ASSÍNCRONA direto no banco, um episódio só —
 * mais abaixo). Este é síncrono, pra checar contra os Sets já
 * carregados em memória (`watched`/`watchedEpisodeIds`, ambos vindos
 * de `useWatchedEpisodes`). Bate por ID FIXO da TMDB primeiro; sem
 * esses dois argumentos (chamador antigo, ou dado ainda sem
 * backfill), cai pro comportamento de sempre.
 */
export function isEpisodeWatchedSync(
  watched: Set<WatchedEpisodeKey> | undefined,
  seasonNumber: number,
  episodeNumber: number,
  episodeId?: number,
  watchedEpisodeIds?: Set<number>
): boolean {
  if (episodeId !== undefined && watchedEpisodeIds?.has(episodeId)) return true;
  return watched?.has(episodeKey(seasonNumber, episodeNumber)) ?? false;
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
/**
 * CORREÇÃO (bug real, reportado — Riverdale/Mayfair Witches/Tomb
 * Raider com temporadas aparentando "não assistidas" mesmo tendo
 * visto tudo, e séries "Interrompidas" voltando sozinhas pra
 * "Assistindo") — causa raiz idêntica ao mesmo bug já corrigido no
 * web (`airDateCategory.ts`/`seriesCategoryRecalc.ts`): episódio
 * marcado como ESPECIAL pelo TV Time (`is_special = true`, pode estar
 * DENTRO de uma temporada normal, não só temporada 0) é excluído da
 * contagem de assistidos, mas o mobile nunca excluía o mesmo episódio
 * do lado do TMDB — essa versão nem tinha o conceito de
 * `specialEpisodeKeys` (diferente do web, onde pelo menos existia um
 * parâmetro morto). Série com qualquer episódio especial nunca
 * "batia a conta", ficava presa em "Assistindo" pra sempre.
 */
export interface AirDateDecision {
  category: LibraryStatus;
  nonSpecialEpisodeCount: number;
  allNonSpecialEpisodesWatched: boolean;
}

/**
 * CORREÇÃO (investigação do Bleach, 2026-08-25 — ver comentário
 * grande em `airDateCategory.ts` do web, mesma causa raiz, agora
 * corrigida também no mobile) — achado real: Bleach (366 episódios)
 * tinha 769 linhas gravadas em `watched_episodes` por causa de uma
 * importação bagunçada (numeração absoluta do anime inteiro
 * despejada como se fosse "temporada 1", junto com uma importação
 * separada, certa, cobrindo as temporadas reais do TMDB). Antes,
 * este parâmetro era só `mainEpisodesWatched: number` — um TOTAL
 * agregado, comparado contra `airedByNow.length`. Um total inflado
 * "batia e sobrava" mesmo com episódios de verdade nunca marcados,
 * porque a comparação nunca checava QUAIS episódios foram
 * assistidos, só QUANTOS. Agora recebe o conjunto de chaves
 * "temporada-episódio" de fato assistidas — cada episódio já no ar é
 * conferido por IDENTIDADE contra esse Set, imune a duplicação/
 * inflação do total.
 */
/**
 * CORREÇÃO (2026-08-26 — "motor resistente") — mesmo raciocínio do
 * web (`airDateCategory.ts`): um episódio conta como assistido se o
 * ID FIXO da TMDB estiver entre os assistidos (`watchedEpisodeIds`)
 * OU, quando esse ID ainda não foi gravado pra aquela linha (dado
 * antigo, de antes desta correção, ainda sem backfill), pela chave
 * (temporada-episódio) de sempre.
 */
function episodeIsWatched(
  episode: { seasonNumber: number; episodeNumber: number; episodeId?: number },
  watchedEpisodeKeys: Set<string>,
  watchedEpisodeIds: Set<number>
): boolean {
  if (episode.episodeId !== undefined && watchedEpisodeIds.has(episode.episodeId)) return true;
  return watchedEpisodeKeys.has(`${episode.seasonNumber}-${episode.episodeNumber}`);
}

function decideWatchingVsUpToDate(
  watchedEpisodeKeys: Set<string>,
  liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId?: number }[],
  specialEpisodeKeys: Set<string> = new Set(),
  watchedEpisodeIds: Set<number> = new Set()
): AirDateDecision {
  const nonSpecialLiveEpisodes = liveEpisodes.filter(
    (e) => !specialEpisodeKeys.has(`${e.seasonNumber}-${e.episodeNumber}`)
  );
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
    nonSpecialLiveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today).map((e) => e.seasonNumber)
  );
  const airedByNow = nonSpecialLiveEpisodes.filter(
    (e) => (e.airDate !== null && e.airDate <= today) || (e.airDate === null && seasonsWithConfirmedAiring.has(e.seasonNumber))
  );
  // CORREÇÃO (Bleach, 2026-08-25) — por identidade, não por total: cada
  // episódio já no ar precisa estar no Set de assistidos, um por um.
  // CORREÇÃO (2026-08-26 — "motor resistente") — `episodeIsWatched` bate por ID FIXO da TMDB primeiro, ver comentário acima.
  const hasUnwatchedAiredEpisode = airedByNow.some((e) => !episodeIsWatched(e, watchedEpisodeKeys, watchedEpisodeIds));
  const allNonSpecialEpisodesWatched = nonSpecialLiveEpisodes.every((e) =>
    episodeIsWatched(e, watchedEpisodeKeys, watchedEpisodeIds)
  );
  return {
    category: hasUnwatchedAiredEpisode ? "watching" : "up_to_date",
    nonSpecialEpisodeCount: nonSpecialLiveEpisodes.length,
    allNonSpecialEpisodesWatched,
  };
}

/**
 * UNIFICAÇÃO (a pedido explícito — "unifique agora por app, não quero
 * voltar a isso mais") — até aqui, a sequência "decide watching/
 * up_to_date, então promove pra completed se a série terminou e
 * bateu a conta, então decide se deve gravar (protegendo 'paused' de
 * virar 'watching' sozinho, e sempre regravando 'watching' pro
 * ranking de Continue assistindo)" estava copiada, à mão, nos 2
 * lugares deste arquivo que gravam `series_status`
 * (`recalculateUpToDateSeriesCategories` e
 * `recalculateSeriesCategoryAfterEpisodeChange`). Mesmo padrão do web
 * (`airDateCategory.ts`) — `resolveSeriesCategory` e
 * `shouldWriteSeriesCategory` são agora as ÚNICAS funções que esses 2
 * lugares chamam pra essa decisão, nada mais recalcula por conta
 * própria.
 */
function resolveSeriesCategory(input: {
  watchedEpisodeKeys: Set<string>;
  liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId?: number }[];
  ended: boolean;
  specialEpisodeKeys?: Set<string>;
  /** Ver comentário em `episodeIsWatched`/"motor resistente" (2026-08-26). */
  watchedEpisodeIds?: Set<number>;
}): { category: "watching" | "up_to_date" | "completed"; nonSpecialEpisodeCount: number } {
  const decision = decideWatchingVsUpToDate(
    input.watchedEpisodeKeys,
    input.liveEpisodes,
    input.specialEpisodeKeys ?? new Set(),
    input.watchedEpisodeIds ?? new Set()
  );
  // CORREÇÃO (Bleach, 2026-08-25) — por identidade (mesmo Set já
  // conferido episódio por episódio dentro de decideWatchingVsUpToDate),
  // não mais por `input.watched >= decision.nonSpecialEpisodeCount`
  // (total agregado, o mesmo defeito que causou o bug do Bleach).
  const allEpisodesWatched = decision.allNonSpecialEpisodesWatched;

  if (input.ended && allEpisodesWatched) {
    return { category: "completed", nonSpecialEpisodeCount: decision.nonSpecialEpisodeCount };
  }
  return {
    category: decision.category as "watching" | "up_to_date",
    nonSpecialEpisodeCount: decision.nonSpecialEpisodeCount,
  };
}

/**
 * Mesmas regras do web (`shouldWriteSeriesCategory`,
 * `airDateCategory.ts`): nunca deixa "paused" virar "watching"
 * sozinho (retomar é decisão manual do usuário), e sempre regrava
 * "watching" mesmo sem mudança de categoria (atualiza `updated_at`,
 * usado pra ordenar "Continue assistindo").
 *
 * CORREÇÃO (2026-08-26, mesmo bug real corrigido no web — Primal
 * marcado manualmente como "Assistir depois" voltando sozinho pra
 * "Assistindo" quando saiu episódio novo) — "want_to_watch" agora
 * recebe a MESMA proteção que "paused" já tinha.
 */
function shouldWriteSeriesCategory(currentStatus: string, newCategory: "watching" | "up_to_date" | "completed"): boolean {
  if ((currentStatus === "paused" || currentStatus === "want_to_watch") && newCategory === "watching") return false;
  return newCategory !== currentStatus || newCategory === "watching";
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
 * mudanças num único upsert. "Pausada"/"Assistir depois" continuam de
 * fora de propósito (mesma regra do recálculo individual, decisão
 * explícita do usuário).
 *
 * CORREÇÃO (a pedido, auditoria "verifique toda a lógica de status")
 * — "Assistindo" também passou a entrar aqui, igual ao site
 * (`seriesCategoryRecalc.ts`, mesma correção aplicada por lá por
 * causa do bug real "Reacher/Senhor dos Anéis presos em Assistindo").
 * Antes só entravam "Em dia"/"Concluída" — o motivo documentado era
 * "Assistindo já aparece na home de qualquer jeito", mas isso deixava
 * uma série genuinamente em dia (assistiu tudo que já saiu, só falta
 * o que ainda vai sair) presa em "Assistindo" até o usuário marcar/
 * desmarcar algum episódio manualmente — exatamente o mesmo bug já
 * corrigido no site.
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
/**
 * CORREÇÃO (Bleach, 2026-08-25 — ver comentário grande em
 * `decideWatchingVsUpToDate` acima) — antes devolvia só um TOTAL
 * (`Map<number, number>`) por série. Agora devolve o conjunto real de
 * chaves "temporada-episódio" assistidas por série — decisão por
 * identidade, não por total. Mesma paginação de sempre (Supabase
 * limita a 1000 linhas por consulta por padrão).
 */
/** CORREÇÃO (2026-08-26 — "motor resistente") — ver `WatchedEpisodesLookup` em seriesCategoryRecalc.ts do web, mesmo formato. */
interface WatchedEpisodesLookup {
  keysBySeriesId: Map<number, Set<string>>;
  idsBySeriesId: Map<number, Set<number>>;
}

async function fetchWatchedEpisodeKeysBySeriesId(userId: string, seriesIds: number[]): Promise<WatchedEpisodesLookup> {
  const keysBySeriesId = new Map<number, Set<string>>();
  const idsBySeriesId = new Map<number, Set<number>>();
  const result: WatchedEpisodesLookup = { keysBySeriesId, idsBySeriesId };
  if (seriesIds.length === 0) return result;

  const { count, error: countError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_special", false)
    .in("series_id", seriesIds);
  if (countError) throw countError;

  const total = count ?? 0;
  if (total === 0) return result;

  /*
   * CORREÇÃO (bug real, reportado no web — várias séries sem relação
   * nenhuma entre si, incluindo terminadas, mudando de categoria ao
   * mesmo tempo) — as páginas abaixo eram buscadas em PARALELO sem
   * nenhuma ordenação (`.order()`) explícita. Sem isso, o
   * Postgres/PostgREST não garante que a página 2 comece exatamente
   * onde a página 1 parou — numa conta com muitas linhas (achado real
   * no web: 16.020 no total, 17 páginas de uma vez), isso podia deixar
   * buracos: linhas de uma série específica que não apareciam em
   * NENHUMA página, gerando um Set incompleto pra ela. Mesma correção
   * aplicada em `seriesCategoryRecalc.ts` do web (ver comentário
   * grande lá, com a evidência real que confirmou a causa). Ordenar
   * por `(series_id, season_number, episode_number)` — mesma ordem das
   * colunas que sobram da chave primária depois de `user_id` (fixo
   * pelo filtro) — torna a paginação determinística.
   */
  const pageCount = Math.ceil(total / WATCHED_EPISODES_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * WATCHED_EPISODES_PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id, season_number, episode_number, tmdb_episode_id")
        .eq("user_id", userId)
        .eq("is_special", false)
        .in("series_id", seriesIds)
        .order("series_id", { ascending: true })
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true })
        .range(from, from + WATCHED_EPISODES_PAGE_SIZE - 1);
    })
  );

  for (const page of pages) {
    if (page.error) throw page.error;
    for (const row of (page.data ?? []) as {
      series_id: number;
      season_number: number;
      episode_number: number;
      tmdb_episode_id: number | null;
    }[]) {
      const keySet = keysBySeriesId.get(row.series_id) ?? new Set<string>();
      keySet.add(`${row.season_number}-${row.episode_number}`);
      keysBySeriesId.set(row.series_id, keySet);

      if (row.tmdb_episode_id !== null) {
        const idSet = idsBySeriesId.get(row.series_id) ?? new Set<number>();
        idSet.add(row.tmdb_episode_id);
        idsBySeriesId.set(row.series_id, idSet);
      }
    }
  }
  return result;
}

export async function fetchLiveEpisodesBySeriesId(
  seriesIds: number[],
  language = "pt-BR"
): Promise<Map<number, { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null; episodeId: number }[]>> {
  const result = new Map<number, { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null; episodeId: number }[]>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);

  const responses = await Promise.all(
    chunks.map((idsChunk) =>
      fetch(`${SITE_URL}/api/tmdb/series-episodes-at-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: idsChunk, language }),
      })
    )
  );

  for (const response of responses) {
    if (!response.ok) continue;
    // `episodeId` (2026-08-26, "motor resistente") — a rota já devolve, ver route.ts.
    const data = (await response.json()) as {
      series: {
        id: number;
        episodes: { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null; episodeId: number }[];
      }[];
    };
    for (const s of data.series) result.set(s.id, s.episodes);
  }
  return result;
}

/**
 * CORREÇÃO (ver comentário grande em `decideWatchingVsUpToDate`
 * acima) — busca, pra cada série, o conjunto (temporada, episódio)
 * marcado como ESPECIAL (`is_special = true`) pelo usuário atual.
 * Idêntico a `fetchSpecialEpisodeKeysBySeriesId` do web
 * (`seriesCategoryRecalc.ts`).
 */
async function fetchSpecialEpisodeKeysBySeriesId(userId: string, seriesIds: number[]): Promise<Map<number, Set<string>>> {
  const result = new Map<number, Set<string>>();
  if (seriesIds.length === 0) return result;

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("series_id, season_number, episode_number")
    .eq("user_id", userId)
    .eq("is_special", true)
    .in("series_id", seriesIds);
  if (error) {
    console.error("[fetchSpecialEpisodeKeysBySeriesId] Falha ao buscar episódios especiais.", error);
    return result; // não bloqueia o recálculo por causa disso — na pior das hipóteses, volta ao comportamento antigo só pra este lote.
  }

  for (const row of (data ?? []) as { series_id: number; season_number: number; episode_number: number }[]) {
    const set = result.get(row.series_id) ?? new Set<string>();
    set.add(`${row.season_number}-${row.episode_number}`);
    result.set(row.series_id, set);
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
    .in("status", ["up_to_date", "watching", "completed"]);
  if (statusError || !statusRows || statusRows.length === 0) return;

  const seriesIds = statusRows.map((row) => row.series_id as number);
  // CORREÇÃO (typecheck real reportado pelo usuário — "Argument of
  // type 'unknown' is not assignable to parameter of type 'string'"
  // na chamada de `shouldWriteSeriesCategory` mais abaixo) — antes,
  // só `row.status` tinha `as LibraryStatus`; `row.series_id` ficava
  // sem cast, e o `Map` construído a partir de `.map(...)` inferia o
  // tipo da chave/valor sem garantia nenhuma. Generics explícitos no
  // `Map<K, V>` eliminam essa inferência ambígua na fonte — `.get()`
  // agora sempre devolve `LibraryStatus | undefined`, nunca `unknown`.
  const currentStatusBySeriesId = new Map<number, LibraryStatus>(
    statusRows.map((row) => [row.series_id as number, row.status as LibraryStatus])
  );

  let watchedEpisodeKeysBySeriesId: Map<number, Set<string>>;
  let watchedEpisodeIdsBySeriesId: Map<number, Set<number>>;
  let episodesBySeriesId: Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[]>;
  let endedBySeriesId: Map<number, boolean>;
  let specialKeysBySeriesId: Map<number, Set<string>>;
  try {
    const [watchedLookup, episodesMap, endedMap, specialKeysMap] = await Promise.all([
      fetchWatchedEpisodeKeysBySeriesId(user.id, seriesIds),
      fetchLiveEpisodesBySeriesId(seriesIds),
      fetchEndedBySeriesId(seriesIds),
      fetchSpecialEpisodeKeysBySeriesId(user.id, seriesIds),
    ]);
    watchedEpisodeKeysBySeriesId = watchedLookup.keysBySeriesId;
    watchedEpisodeIdsBySeriesId = watchedLookup.idsBySeriesId;
    episodesBySeriesId = episodesMap;
    endedBySeriesId = endedMap;
    specialKeysBySeriesId = specialKeysMap;
  } catch (error) {
    console.error("[recalculateUpToDateSeriesCategories] Falha ao buscar dados em lote — categorias não recalculadas desta vez.", error);
    return;
  }

  const updates: { user_id: string; series_id: number; status: LibraryStatus; updated_at: string }[] = [];
  const categoryBySeriesId = new Map<number, LibraryStatus>();
  for (const seriesId of seriesIds) {
    const liveEpisodes = episodesBySeriesId.get(seriesId) ?? [];
    if (liveEpisodes.length === 0) continue; // TMDB não devolveu nada pra essa série desta vez — não mexe, mais seguro do que arriscar errado.

    const watchedEpisodeKeys = watchedEpisodeKeysBySeriesId.get(seriesId) ?? new Set<string>();
    const watchedEpisodeIds = watchedEpisodeIdsBySeriesId.get(seriesId) ?? new Set<number>();
    const ended = endedBySeriesId.get(seriesId) ?? false;
    const specialEpisodeKeys = specialKeysBySeriesId.get(seriesId) ?? new Set<string>();
    const { category } = resolveSeriesCategory({ watchedEpisodeKeys, liveEpisodes, ended, specialEpisodeKeys, watchedEpisodeIds });
    categoryBySeriesId.set(seriesId, category);
  }

  /*
   * CORREÇÃO (bug real, específico — Re:Zero "em dia" segundo a lista
   * completa por temporada, mas com episódio novo de verdade
   * (S01E78) que o TMDB só expõe via `next_episode_to_air`, campo
   * separado da lista de temporadas — mesma correção aplicada no web
   * (`seriesCategoryRecalc.ts`). Catálogo desse anime específico
   * numera de forma inconsistente entre "temporada oficial" e
   * "número absoluto", confirmado numa discussão pública no próprio
   * TMDB — a lista completa ainda não tinha esse episódio; o campo
   * `next_episode_to_air` já sabia.
   *
   * Checagem extra, só pras séries que a lista completa concluiu "em
   * dia" — reaproveita `/api/tmdb/upcoming`, a MESMA rota que "Em
   * breve" já usa (`lib/upcomingEpisodes.ts`). Se essa fonte separada
   * indica episódio com data confirmada e já passada pra uma série
   * que a lista completa achou "sem pendência", promove pra
   * "watching" — sem precisar casar número de temporada/episódio
   * entre as duas fontes.
   */
  const upToDateSeriesIds = seriesIds.filter((id) => categoryBySeriesId.get(id) === "up_to_date");
  if (upToDateSeriesIds.length > 0) {
    try {
      const response = await fetch(`${SITE_URL}/api/tmdb/upcoming`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: upToDateSeriesIds }),
      });
      if (response.ok) {
        const today = todayLocalKey();
        const data = (await response.json()) as { episodes: { seriesId: number; airDate: string | null }[] };
        for (const ep of data.episodes) {
          if (ep.airDate && ep.airDate <= today) {
            categoryBySeriesId.set(ep.seriesId, "watching");
          }
        }
      }
    } catch (error) {
      // Não bloqueia a recalculação principal por causa dessa checagem extra — é um refinamento, não a base.
      console.error("[recalculateUpToDateSeriesCategories] Falha na checagem extra via next_episode_to_air", error);
    }
  }

  for (const seriesId of seriesIds) {
    const newCategory = categoryBySeriesId.get(seriesId);
    if (!newCategory) continue;
    const currentStatus = currentStatusBySeriesId.get(seriesId);

    /*
     * UNIFICAÇÃO (ver `shouldWriteSeriesCategory` acima, mesmo padrão
     * do web em `airDateCategory.ts`) — cobre as duas regras que
     * antes viviam duplicadas aqui: nunca deixa "paused" virar
     * "watching" sozinho (não afeta esta função hoje, já que "paused"
     * nem entra na busca acima — mas protege automaticamente se isso
     * mudar), e sempre regrava "watching" mesmo sem mudança de
     * categoria (achado real — "Tanya the Evil, Tomb Raider King sem
     * aparecer em Continue assistindo": o corte de 8 em "Continue
     * assistindo" ordena por `updated_at`, que só era tocado quando a
     * categoria mudava).
     */
    // Defesa extra no limite da função (belt-and-suspenders) — mesmo
    // que a origem de `currentStatus` mude no futuro, `String(...)`
    // garante um `string` de verdade, nunca `unknown`/`any` vazando
    // pra dentro de `shouldWriteSeriesCategory`.
    if (shouldWriteSeriesCategory(String(currentStatus ?? ""), newCategory as "watching" | "up_to_date" | "completed")) {
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

  // CORREÇÃO (Bleach, 2026-08-25) — antes, a busca de episódios
  // assistidos era só um `{ count }` (agregado) e vivia FORA do
  // try/catch das chamadas ao TMDB logo abaixo — uma falha ali
  // silenciosamente virava `watched = 0` em vez de abortar o
  // recálculo. Agora busca a IDENTIDADE de fato assistida (mesma
  // função paginada usada pelo recálculo em lote acima) e entra no
  // MESMO Promise.all + try/catch das chamadas ao TMDB: qualquer
  // falha (banco ou TMDB) aborta o recálculo inteiro, sem gravar nada
  // com dado incompleto.
  let watchedEpisodeKeys = new Set<string>();
  let watchedEpisodeIds = new Set<number>();
  let specialKeys = new Set<string>();
  let liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[] = [];
  let ended = false;
  try {
    const [watchedLookup, specialKeysBySeriesId, episodesResponse, summaryResponse] = await Promise.all([
      fetchWatchedEpisodeKeysBySeriesId(user.id, [seriesId]),
      fetchSpecialEpisodeKeysBySeriesId(user.id, [seriesId]),
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
    watchedEpisodeKeys = watchedLookup.keysBySeriesId.get(seriesId) ?? new Set<string>();
    watchedEpisodeIds = watchedLookup.idsBySeriesId.get(seriesId) ?? new Set<number>();
    specialKeys = specialKeysBySeriesId.get(seriesId) ?? new Set<string>();
    if (episodesResponse.ok) {
      // `episodeId` (2026-08-26, "motor resistente") — a rota já devolve, ver route.ts.
      const data = (await episodesResponse.json()) as {
        series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[] }[];
      };
      liveEpisodes = data.series.find((s) => s.id === seriesId)?.episodes ?? [];
    }
    if (summaryResponse.ok) {
      const data = (await summaryResponse.json()) as { series: { id: number; ended: boolean }[] };
      ended = data.series.find((s) => s.id === seriesId)?.ended ?? false;
    }
  } catch (error) {
    console.error("[series-category-recalc] Falha ao buscar dados — categoria não recalculada desta vez.", error);
    return;
  }

  if (liveEpisodes.length === 0) {
    return;
  }

  // UNIFICAÇÃO (ver `resolveSeriesCategory`/`shouldWriteSeriesCategory`
  // acima, mesmo padrão do web) — nenhuma regra é reimplementada
  // aqui: decisão de categoria e decisão de gravação vêm das mesmas
  // duas funções usadas por `recalculateUpToDateSeriesCategories`,
  // logo acima neste arquivo.
  const { category: newCategory } = resolveSeriesCategory({
    watchedEpisodeKeys,
    liveEpisodes,
    ended,
    specialEpisodeKeys: specialKeys,
    watchedEpisodeIds,
  });
  if (!shouldWriteSeriesCategory(currentStatus, newCategory)) return;

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

/**
 * Idêntico a useToggleEpisodeWatched do web, sem otimismo de cache
 * (o hook em useWatchedEpisodes.ts cuida disso).
 *
 * CORREÇÃO (2026-08-26 — "motor resistente a fusão de temporadas
 * pela TMDB", ver migração 20260907000000_watched_episodes_tmdb_episode_id.sql
 * e o comentário idêntico em watched-episodes-mutations.ts do web)
 * — `episodeId` (opcional) é o ID PERMANENTE do episódio na TMDB.
 * Quando quem chama já tem esse valor à mão, ele é gravado junto —
 * usado depois pra bater "assistido?" por identidade estável, não só
 * por (season_number, episode_number), que pode mudar se a TMDB
 * reestruturar temporadas de novo no futuro.
 */
export async function toggleEpisodeWatched(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number,
  currentlyWatched: boolean,
  episodeId?: number
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
      tmdb_episode_id: episodeId ?? null,
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
 *
 * `episodeId` por item — ver comentário em `toggleEpisodeWatched` acima.
 */
export async function markEpisodesWatched(
  seriesId: number,
  episodes: { seasonNumber: number; episodeNumber: number; episodeId?: number }[]
): Promise<void> {
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
    tmdb_episode_id: e.episodeId ?? null,
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
/**
 * CORREÇÃO (2026-08-26 — "motor resistente") — `episodeId` (opcional)
 * é o ID FIXO da TMDB deste episódio, quando quem chama já tem esse
 * valor à mão (a tela de Detalhe do Episódio busca antes via
 * `fetchEpisodePage`). Checado PRIMEIRO — sobrevive a uma futura
 * reestruturação de temporadas pela TMDB, diferente de
 * (season_number, episode_number), que ela pode mudar sem aviso.
 * Sem esse argumento (chamador antigo), cai pro comportamento de
 * sempre.
 */
export async function isEpisodeWatched(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number,
  episodeId?: number
): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  if (episodeId !== undefined) {
    const { data: byId, error: byIdError } = await supabase
      .from("watched_episodes")
      .select("series_id")
      .eq("series_id", seriesId)
      .eq("user_id", user.id)
      .eq("tmdb_episode_id", episodeId)
      .maybeSingle();
    if (byIdError) throw byIdError;
    if (byId) return true;
  }

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
