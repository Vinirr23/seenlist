import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { resolveSeriesCategory, shouldWriteSeriesCategory } from "./airDateCategory";

const TMDB_EPISODES_CHUNK_SIZE = 20; // mesmo limite de /api/tmdb/series-episodes-at-export (MAX_IDS_PER_REQUEST)
const WATCHED_EPISODES_PAGE_SIZE = 1000; // limite padrão de linhas por consulta do Supabase/PostgREST — ver `fetchWatchedEpisodeKeysBySeriesId` abaixo.

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const EPISODES_EXPORT_RETRY_DELAYS_MS = [800, 2000]; // até 2 tentativas extras, com pausa curta entre elas.

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-03, bug real reportado — "marquei
 * todos os episódios novos, mas 3 séries ficaram presas em Continue
 * assistindo, mesmo trocando de grade/lista") — `/api/tmdb/series-
 * episodes-at-export` já distingue "essa série genuinamente não tem
 * episódio nenhum" de "a busca falhou de verdade" através de
 * `failedIds` (ver o comentário grande na própria rota — o MESMO bug
 * já tinha sido corrigido uma vez, só que em `seriesEpisodesLight.ts`/
 * `ContinueWatchingCard.tsx`, que só decide o que MOSTRA na tela; este
 * arquivo, que decide o STATUS gravado no banco (o que faz a série
 * sumir de "Continue assistindo" de verdade), nunca tinha recebido a
 * mesma correção).
 *
 * Marcar várias séries seguidas (como "marcar todos os episódios
 * novos") dispara várias buscas simultâneas nesta mesma rota — uma
 * rajada bem mais propensa a esbarrar num rate-limit passageiro do
 * TMDB do que uma busca isolada. Antes, `data.series` sem aquele id
 * (por falha OU por "realmente não tem nada") virava a MESMA coisa:
 * `liveEpisodes = []` → a função desiste em silêncio, sem gravar
 * nada — a série ficava PRESA no status antigo até o próximo
 * recálculo automático (que só roda de novo depois de todo o
 * intervalo do throttle, até 2h) ou até a pessoa desmarcar/remarcar
 * manualmente pra forçar uma nova tentativa.
 *
 * Agora: até 2 tentativas extras, só pros ids que vierem em
 * `failedIds` (não refaz a rajada inteira, só o que realmente
 * falhou), com uma pausa curta entre elas — dá tempo pro rate-limit
 * passageiro aliviar sem fazer a pessoa esperar muito.
 */
async function fetchSeriesEpisodesAtExportWithRetry(
  seriesIds: number[]
): Promise<Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[]>> {
  const result = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[]>();
  let pending = seriesIds;

  for (let attempt = 0; attempt <= EPISODES_EXPORT_RETRY_DELAYS_MS.length && pending.length > 0; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, EPISODES_EXPORT_RETRY_DELAYS_MS[attempt - 1]));
    }
    let response: Response;
    try {
      response = await fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: pending }),
      });
    } catch (error) {
      console.error(`[fetchSeriesEpisodesAtExportWithRetry] Falha de rede na tentativa ${attempt + 1}.`, error);
      continue;
    }
    if (!response.ok) continue;
    // `episodeId` (2026-08-26, "motor resistente") — a rota já devolve, ver route.ts.
    const data = (await response.json()) as {
      series: {
        id: number;
        episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[];
      }[];
      failedIds?: number[];
    };
    for (const s of data.series) result.set(s.id, s.episodes);
    pending = data.failedIds ?? [];
  }

  if (pending.length > 0) {
    console.error(
      `[fetchSeriesEpisodesAtExportWithRetry] ${pending.length} série(s) continuaram falhando depois de todas as tentativas — status não recalculado desta vez pra elas:`,
      pending
    );
  }

  return result;
}

async function fetchLiveEpisodesBySeriesId(
  seriesIds: number[]
): Promise<Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[]>> {
  const result = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[]>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);
  const chunkResults = await Promise.all(chunks.map((idsChunk) => fetchSeriesEpisodesAtExportWithRetry(idsChunk)));
  for (const chunkResult of chunkResults) {
    for (const [id, episodes] of chunkResult) result.set(id, episodes);
  }
  return result;
}

/**
 * CORREÇÃO (bug real, reportado — "Corrigir status das séries" jogou
 * várias séries terminadas/em dia de volta pra "Assistindo") — busca,
 * pra cada série, o conjunto (temporada, episódio) que o usuário
 * marcou como ESPECIAL (`is_special = true` — vem do TV Time Out,
 * pode ser qualquer episódio dentro de uma temporada normal, não só
 * temporada 0). Sem isso, `decideWatchingVsUpToDate` (via
 * `specialEpisodeKeys`, que ficava sempre vazio) e o cálculo de
 * "assistiu tudo?" comparavam a contagem de assistidos (que já exclui
 * especiais) contra o total bruto do TMDB (que NÃO sabe quais
 * episódios o usuário marcou como especiais) — episódio especial
 * nunca "batia", série nunca conseguia ficar 100% em dia/completa. Ver
 * comentário grande em `airDateCategory.ts`.
 */
async function fetchSpecialEpisodeKeysBySeriesId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  seriesIds: number[]
): Promise<Map<number, Set<string>>> {
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
    return result; // não bloqueia o recálculo por causa disso — na pior das hipóteses, volta ao comportamento antigo (sem excluir especiais) só pra este lote.
  }

  for (const row of (data ?? []) as { series_id: number; season_number: number; episode_number: number }[]) {
    const set = result.get(row.series_id) ?? new Set<string>();
    set.add(`${row.season_number}-${row.episode_number}`);
    result.set(row.series_id, set);
  }
  return result;
}

/**
 * CORREÇÃO (investigação do Bleach, 2026-08-25 — ver comentário
 * grande em `airDateCategory.ts`) — antes, os dois lugares que gravam
 * `series_status` neste arquivo buscavam só um TOTAL de episódios
 * assistidos (`count: "exact", head: true`) e comparavam contra o
 * total de episódios do TMDB. Uma importação bagunçada podia inflar
 * esse total (linhas duplicadas/malformadas de uma reimportação) sem
 * que a série tivesse, de fato, os episódios certos marcados — o
 * total "batia e sobrava" mesmo com um episódio específico pendente
 * de verdade (achado real: Bleach tinha 769 linhas de episódio
 * assistido gravadas pra uma série de 366 episódios).
 *
 * Busca a lista real de (temporada, episódio) assistidos — não só a
 * contagem — pra decidir por IDENTIDADE, igual a
 * `fetchSpecialEpisodeKeysBySeriesId` logo abaixo. Paginada de 1000
 * em 1000 (mesmo padrão já usado em
 * `app/api/admin/repair-series-categories/route.ts` — achado real
 * documentado lá: sem paginação, contas com muito histórico perdiam
 * linhas silenciosamente acima do teto padrão do Supabase).
 */
interface WatchedEpisodesLookup {
  keysBySeriesId: Map<number, Set<string>>;
  /** CORREÇÃO (2026-08-26 — "motor resistente") — ver `episodeIsWatched` em airDateCategory.ts. */
  idsBySeriesId: Map<number, Set<number>>;
}

async function fetchWatchedEpisodeKeysBySeriesId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  seriesIds: number[]
): Promise<WatchedEpisodesLookup> {
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
   * CORREÇÃO (bug real, reportado — várias séries sem relação nenhuma
   * entre si, incluindo terminadas, voltando pra "Assistindo"/"Em dia"
   * ao mesmo tempo) — as páginas acima eram buscadas em PARALELO
   * (`Promise.all`) sem nenhuma ordenação (`.order()`) explícita. Sem
   * isso, o Postgres/PostgREST não garante que a página 2 comece
   * exatamente onde a página 1 parou — pra uma conta com muitas linhas
   * (aqui, 16.020 no total, 17 páginas de uma vez só), isso podia
   * deixar buracos: linhas de uma série específica que não apareciam
   * em NENHUMA página, fazendo esta função devolver um Set incompleto
   * pra ela — episódio de verdade assistido, mas fora do Set, então
   * `decideWatchingVsUpToDate` concluía (errado) que tinha episódio
   * pendente. Confirmado com dado real: Reacher e Bleach, duas séries
   * sem nada em comum, mudaram de categoria no MESMO milissegundo (o
   * mesmo lote de recálculo) — sinal de um problema na busca em lote,
   * não em cada série isoladamente.
   *
   * Ordenar por `(series_id, season_number, episode_number)` — mesma
   * ordem das colunas que sobram da chave primária da tabela depois de
   * `user_id` (fixo pelo filtro acima) — torna a paginação
   * determinística: cada página sempre devolve o mesmo pedaço,
   * consistente entre chamadas paralelas, sem depender da ordem física
   * "por acaso" que o Postgres escolher.
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

async function fetchEndedBySeriesId(seriesIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);
  const responses = await Promise.all(
    chunks.map((idsChunk) =>
      fetch("/api/tmdb/library-summaries", {
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

/**
 * CORREÇÃO (bug real, reportado — "série assistindo, mas não aparece
 * na Home") — porta fiel de `recalculateUpToDateSeriesCategories`
 * (`apps/mobile/lib/seriesDetails.ts`), que só existia no app nativo
 * (chamada toda vez que a aba Séries ganha foco). O web nunca teve
 * essa peça: uma série que virava "Em dia" ficava PRESA nesse status
 * pra sempre, mesmo depois de sair episódio novo — só era promovida
 * de volta pra "Assistindo" se o usuário marcasse manualmente um
 * episódio (o que dispara `recalculateSeriesCategoryAfterEpisodeChange`,
 * mas só DEPOIS da marcação, não antes — ninguém recalculava
 * PROATIVAMENTE). Chamada ao carregar a Central de Séries
 * (`MinhaListaSection.tsx`), mesmo espírito do "toda vez que a tela
 * abre" do app nativo, adaptado pro web (sem conceito de "foco de
 * aba" persistente).
 *
 * ATUALIZAÇÃO (bug real, reportado — Tanya the Evil presa em
 * "Assistindo") — ampliado pra bidirecional: antes só promovia
 * "Em dia" → "Assistindo"/"Concluída"; séries "Assistindo" nunca
 * eram reavaliadas pra baixo. Uma série que ficasse genuinamente em
 * dia (assistiu tudo que já saiu, falta só o episódio que ainda vai
 * sair) ficava presa em "Assistindo" pra sempre, a não ser que o
 * usuário marcasse/desmarcasse algum episódio manualmente (o que
 * dispara `recalculateSeriesCategoryAfterEpisodeChange`). Agora
 * busca "up_to_date" E "watching" juntas, e a mesma lógica de
 * decisão (`decideWatchingVsUpToDate`) resolve os dois sentidos.
 */
const RECALC_STORAGE_KEY = "seenlist:series-recalc-last-run";
/**
 * CORREÇÃO (bug real, causa raiz encontrada e confirmada com dado real,
 * 2026-09-02 — "Tomb Raider King, Clevatess, Re:ZERO sumidas da Home,
 * só aparecem em 'Ver tudo'") — era 24h. Diagnóstico (log temporário,
 * removido depois de confirmado) mostrou exatamente o problema: o
 * usuário tem 100 séries "Em dia" na Biblioteca; a Home só reavalia as
 * 8 com `updated_at` mais recente (ver `continueWatchingSeries.ts`) —
 * uma série só sobe pra essa janela quando ESTA rotina a promove de
 * volta pra "Assistindo" (o que atualiza `updated_at`). Com 24h de
 * intervalo, uma série podia ficar até um dia inteiro (ou mais, já que
 * o carimbo de "já rodei" fica no `localStorage` do NAVEGADOR, não na
 * conta — trocar de aparelho/navegador ou limpar dados reinicia a
 * espera) sem ninguém verificar se ela ganhou episódio novo, mesmo com
 * o episódio já disponível há dias na TMDB. Forçar esta rotina a rodar
 * de novo (limpando o carimbo manualmente) promoveu as 3 séries na
 * hora — confirma que a lógica de promoção em si está correta, só o
 * INTERVALO era grande demais. Reduzido pra 2h: mesma rotina, mesmo
 * custo por execução, só rodando bem mais vezes — o pior caso de
 * atraso cai de "até 24h+" pra "até ~2h". `check-new-releases` (Edge
 * Function, push) continua rodando 1x/dia, sem relação com isto — é
 * uma notificação, não afeta o que a Home decide mostrar.
 */
const RECALC_MIN_INTERVAL_MS = 2 * 60 * 60 * 1000;

/**
 * A PEDIDO (achado de performance real, confirmado — "Home lenta") —
 * `recalculateUpToDateSeriesCategories` (abaixo) é cara: pra cada
 * série "watching"/"up_to_date" faz 1 chamada TMDB de temporadas +
 * 1 por temporada, e ainda rebusca todo o histórico de episódios
 * assistidos da conta — tudo isso repetia do zero a CADA vez que a
 * Home montava (bastava trocar de aba e voltar). `useEffect([])` não
 * tem noção de "já rodei isso há pouco".
 *
 * Guarda em `localStorage` (mesmo padrão do `LocaleProvider`) o
 * horário da última execução BEM-SUCEDIDA — se rodou há menos de 24h,
 * pula inteiramente, sem nenhuma chamada de rede. Escolha de 24h
 * combinada com o usuário: consistente com o `check-new-releases`
 * (Edge Function que já roda só 1x/dia pra detectar episódio novo pro
 * push) e não afeta a aba "Em breve" (busca independente, sempre
 * fresca). O que fica "atrasado" até 24h é só o selo NOVO/promoção
 * automática de volta pra "Assistindo" numa série que o usuário não
 * mexeu manualmente — marcar um episódio à mão continua instantâneo
 * via `recalculateSeriesCategoryAfterEpisodeChange`, que não passa
 * por aqui.
 *
 * Só grava o carimbo em caso de SUCESSO — se a checagem falhar
 * (rede, TMDB fora do ar), tenta de novo na próxima visita em vez de
 * esperar 24h por causa de uma falha passageira.
 *
 * CORREÇÃO (achado real de performance — auditoria de instrumentação
 * do TMDB, ver `library-state.ts`/`api/tmdb/library-summaries`): o
 * retorno era `void`, então quem chama (`MinhaListaSection.tsx`) não
 * tinha como saber se a recalculação REALMENTE rodou (1x/dia) ou foi
 * pulada pelo throttle — e chamava `refetch()` da Biblioteca inteira
 * de qualquer jeito, TODA VEZ que a tela montava. Um teste real de
 * celular mostrou mais de 40 chamadas à rota de resumos do TMDB em
 * ~5 segundos, só de trocar de aba repetidamente — o cache novo já
 * deixou cada uma rápida, mas a rebusca em si continuava
 * desnecessária quase sempre (o throttle só permite 1 recalculação
 * de verdade por dia). Agora devolve `true`/`false` — quem chama
 * decide se vale a pena atualizar a lista.
 */
export async function recalculateUpToDateSeriesCategoriesThrottled(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const lastRun = window.localStorage.getItem(RECALC_STORAGE_KEY);
  if (lastRun && Date.now() - Number(lastRun) < RECALC_MIN_INTERVAL_MS) {
    return false;
  }

  /*
   * CORREÇÃO (bug real, reportado — "várias séries terminadas
   * (Money Heist, Elite, Castlevania, etc.) presas em 'Em dia' em vez
   * de 'Assistidas'") — causa raiz encontrada: enquanto
   * `SUPABASE_SERVICE_ROLE_KEY` esteve ausente do `.env.local`
   * (mesmo problema já identificado antes nesta sessão, que também
   * quebrava os pôsteres do Perfil e "Para você" da Explorar), TODA
   * chamada a `/api/tmdb/library-summaries` falhava — inclusive a
   * usada aqui (`fetchEndedBySeriesId`) pra saber se cada série já
   * TERMINOU no TMDB. `getAllEpisodesWithAirDates` (a OUTRA busca
   * feita aqui, `/api/tmdb/series-episodes-at-export`) não depende
   * dessa chave — não falhava. Resultado: a lista de episódios vinha
   * certa (então a série era corretamente avaliada como "assistiu
   * tudo que já saiu"), mas `endedBySeriesId` vinha VAZIO — o código
   * assumia `ended = false` por padrão pra quem faltava no mapa (linha
   * abaixo, "?? false"), então NENHUMA série era promovida pra
   * "completed", mesmo já tendo terminado de verdade no TMDB.
   *
   * O agravante: esta função antes sempre devolvia sucesso (só
   * lançava exceção em falha de REDE, não quando os dados vinham
   * incompletos) — então o `Throttled` acima gravava o carimbo de "já
   * rodei hoje" mesmo com o resultado errado, TRAVANDO esse erro por
   * 24h a cada dia que a chave continuasse faltando. Agora
   * `recalculateUpToDateSeriesCategories` devolve `false` (em vez de
   * só logar e seguir) quando não conseguiu de verdade avaliar
   * "terminou ou não" pra nenhuma série pendente — e SÓ NESSE CASO o
   * carimbo de 24h não é gravado, então a próxima visita tenta nsão
   * de novo, em vez de esperar o dia inteiro com o dado errado
   * fixado.
   */
  const succeeded = await recalculateUpToDateSeriesCategories();
  if (succeeded) {
    window.localStorage.setItem(RECALC_STORAGE_KEY, String(Date.now()));
  }
  return succeeded;
}

/**
 * Devolve `true` quando conseguiu avaliar os dados de verdade (mesmo
 * que não tenha havido nenhuma mudança de categoria — "nada pra
 * mudar" também é sucesso) e `false` quando teve que desistir por
 * falta de dado confiável (rede, TMDB fora do ar, ou — o bug real já
 * documentado acima — `SUPABASE_SERVICE_ROLE_KEY` ausente quebrando
 * `/api/tmdb/library-summaries`). O valor de retorno é o que permite
 * ao `Throttled` acima decidir se pode gravar o carimbo de "rodou
 * hoje" com segurança.
 */
export async function recalculateUpToDateSeriesCategories(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return false;

  /*
   * CORREÇÃO (bug real, reportado — Re:Zero, Tanya the Evil e Tomb
   * Raider King com episódio novo saindo, mas nunca voltando a
   * aparecer em "Continue assistindo") — mesmo bug corrigido no
   * mobile (`apps/mobile/lib/seriesDetails.ts`): esta consulta nunca
   * incluía `"completed"` — uma vez que a série entra nesse status
   * (usuário assistiu tudo que existia até então), ela ficava PRESA
   * lá pra sempre, mesmo com episódio novo saindo depois (comum em
   * anime semanal). A lógica de decisão abaixo já está preparada pra
   * reconsiderar — só faltava incluir o status na busca.
   */
  const { data: statusRows, error: statusError } = await supabase
    .from("series_status")
    .select("series_id, status")
    .eq("user_id", user.id)
    .in("status", ["up_to_date", "watching", "completed"]);
  if (statusError) return false; // falha real de rede/consulta — não confunde com "sucesso, nada pra fazer".
  if (!statusRows || statusRows.length === 0) return true; // conta sem nenhuma série watching/up_to_date/completed — nada pra recalcular, mas não é falha.

  // CORREÇÃO (typecheck real reportado pelo usuário — "Argument of
  // type 'unknown' is not assignable to parameter of type 'string'"
  // na chamada de `shouldWriteSeriesCategory` mais abaixo) — generics
  // explícitos no `Map<K, V>` eliminam qualquer ambiguidade de
  // inferência na fonte — `.get()` agora sempre devolve
  // `"up_to_date" | "watching" | "completed" | undefined`, nunca
  // `unknown`.
  const currentStatusBySeriesId = new Map<number, "up_to_date" | "watching" | "completed">(
    statusRows.map((row) => [row.series_id as number, row.status as "up_to_date" | "watching" | "completed"])
  );
  const seriesIds = statusRows.map((row) => row.series_id as number);

  let watchedEpisodeKeysBySeriesId: Map<number, Set<string>>;
  let watchedEpisodeIdsBySeriesId: Map<number, Set<number>>;
  let episodesBySeriesId: Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[]>;
  let endedBySeriesId: Map<number, boolean>;
  let specialKeysBySeriesId: Map<number, Set<string>>;
  try {
    const [watchedLookup, episodesMap, endedMap, specialKeysMap] = await Promise.all([
      fetchWatchedEpisodeKeysBySeriesId(supabase, user.id, seriesIds),
      fetchLiveEpisodesBySeriesId(seriesIds),
      fetchEndedBySeriesId(seriesIds),
      fetchSpecialEpisodeKeysBySeriesId(supabase, user.id, seriesIds),
    ]);
    watchedEpisodeKeysBySeriesId = watchedLookup.keysBySeriesId;
    watchedEpisodeIdsBySeriesId = watchedLookup.idsBySeriesId;
    episodesBySeriesId = episodesMap;
    endedBySeriesId = endedMap;
    specialKeysBySeriesId = specialKeysMap;
  } catch (error) {
    console.error(
      "[recalculateUpToDateSeriesCategories] Falha ao buscar dados em lote — categorias não recalculadas desta vez.",
      error
    );
    return false;
  }

  /*
   * CORREÇÃO (o bug em si, causa raiz — "várias séries terminadas
   * presas em 'Em dia'") — `fetchEndedBySeriesId` não lança exceção
   * quando TODAS as chamadas a `/api/tmdb/library-summaries` falham
   * (ex.: `SUPABASE_SERVICE_ROLE_KEY` ausente) — ela só ignora
   * (`if (!response.ok) continue`) e devolve o mapa vazio como se
   * fosse um resultado válido "nenhuma série terminou". Antes, isso
   * seguia em frente e gravava `ended = false` pra TODAS as séries,
   * travando errado por 24h (ver comentário grande acima, no
   * `Throttled`). Agora: mapa vazio + havia série pra checar = trata
   * como falha (mesmo não tendo lançado exceção), não como "nenhuma
   * terminou".
   */
  if (endedBySeriesId.size === 0 && seriesIds.length > 0) {
    console.error(
      "[recalculateUpToDateSeriesCategories] '/api/tmdb/library-summaries' não devolveu dado de 'ended' pra nenhuma série — tratando como falha para não travar categoria errada por 24h."
    );
    return false;
  }

  const updates: { user_id: string; series_id: number; status: "watching" | "up_to_date" | "completed"; updated_at: string }[] = [];
  // UNIFICAÇÃO (ver airDateCategory.ts) — `resolveSeriesCategory` é a
  // ÚNICA função que decide "watching"/"up_to_date"/"completed" pra
  // qualquer um dos 3 lugares que gravam series_status no web.
  const categoryBySeriesId = new Map<number, "watching" | "up_to_date" | "completed">();
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
   * separado da lista de temporadas — achado real: catálogo desse
   * anime específico numera de forma inconsistente entre "temporada
   * oficial" e "número absoluto", confirmado numa discussão pública
   * no próprio TMDB. A lista completa (`/tv/{id}/season/{n}`) ainda
   * não tinha esse episódio; o campo `next_episode_to_air`
   * (`/tv/{id}` raiz) já sabia.
   *
   * Checagem extra, só pras séries que a lista completa concluiu "em
   * dia" (não gasta chamada à toa pras que já sabem que tem
   * pendência) — reaproveita `/api/tmdb/upcoming`, a MESMA rota que
   * "Em breve" já usa, em vez de duplicar a lógica de
   * `getNextEpisodeToAir`. Se essa fonte separada indica um episódio
   * com data confirmada e já passada pra uma série que a lista
   * completa achou "sem pendência", a lista completa está incompleta
   * — promove pra "watching" sem precisar casar número de
   * temporada/episódio entre as duas fontes (a numeração pode
   * divergir, mas "existe episódio confirmado, ainda não contado" é
   * suficiente pra decidir).
   */
  const upToDateSeriesIds = seriesIds.filter((id) => categoryBySeriesId.get(id) === "up_to_date");
  if (upToDateSeriesIds.length > 0) {
    try {
      const response = await fetch("/api/tmdb/upcoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: upToDateSeriesIds }),
      });
      if (response.ok) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
     * UNIFICAÇÃO (ver airDateCategory.ts) — `shouldWriteSeriesCategory`
     * é a ÚNICA função que decide se uma categoria recém-calculada
     * deve ser gravada, pra qualquer um dos 3 lugares. Cobre as duas
     * regras que antes viviam duplicadas: nunca deixa "paused" virar
     * "watching" sozinho (não afeta esta função específica hoje, já
     * que "paused" nem entra na busca acima — mas protege
     * automaticamente se isso mudar no futuro), e sempre regrava
     * "watching" mesmo sem mudança de categoria (achado real —
     * "Tanya the Evil, Tomb Raider King sem aparecer em Continue
     * assistindo": o corte de 8 em "Continue assistindo" ordena por
     * `updated_at`, que só era tocado quando a categoria mudava —
     * série já corretamente "watching" podia afundar no ranking e
     * sair das vagas visíveis sem essa regra).
     */
    // Defesa extra no limite da função (belt-and-suspenders) — mesmo
    // que a origem de `currentStatus` mude no futuro, `String(...)`
    // garante um `string` de verdade, nunca `unknown`/`any` vazando
    // pra dentro de `shouldWriteSeriesCategory`.
    if (shouldWriteSeriesCategory(String(currentStatus ?? ""), newCategory)) {
      updates.push({ user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() });
    }
  }

  if (updates.length === 0) return true; // avaliou tudo certinho, só que nada mudou de categoria — sucesso.

  // NOTA (2026-08-26 — "rede de segurança de 3 partes", parte B) —
  // este `.upsert()` em LOTE continua direto, sem passar pela RPC
  // `set_series_status_with_history` (ver correção equivalente logo
  // abaixo, em `recalculateSeriesCategoryAfterEpisodeChange`): a RPC
  // grava uma linha por vez, e trocar por N chamadas sequenciais aqui
  // arriscaria deixar a Central de Séries mais lenta pra abrir numa
  // conta com muitas séries. O gatilho em `series_status`
  // (`trg_log_series_status_change`) continua capturando toda mudança
  // gravada aqui — só sem um rótulo preciso de origem (`source =
  // 'unknown'` em vez de `'auto_recalc'`). Nenhuma mudança de status
  // fica sem registro; só nesta rajada específica o registro não sabe
  // dizer QUAL rotina fez.
  const { error: upsertError } = await supabase.from("series_status").upsert(updates, { onConflict: "user_id,series_id" });
  if (upsertError) {
    console.error("[recalculateUpToDateSeriesCategories] Falha ao gravar categorias recalculadas", upsertError);
    return false; // os dados foram avaliados certo, mas não foi possível salvar — não grava o carimbo de "rodou hoje" com a gravação pendente.
  }
  return true;
}

/**
 * TASK-043 — achado real (Rancho Dutton, Demolidor, Dexter): marcar
 * episódio direto na tela nunca recalculava categoria nenhuma, só a
 * importação tinha essa regra. Chamado depois de qualquer mutation
 * que muda `watched_episodes` — só entra em ação quando o status
 * ATUAL já é "watching" ou "up_to_date" (nunca mexe em "paused"/
 * "want_to_watch" — isso continua sendo decisão explícita do
 * usuário, igual na importação).
 *
 * Limitação real, documentada: aqui não há como saber quais
 * (temporada, episódio) o TV Time chamaria de "especiais" fora do
 * momento da importação (essa informação não fica guardada em
 * lugar nenhum além do próprio `watched_episodes.is_special`, que só
 * cobre episódios JÁ assistidos, não os que faltam). Por isso a
 * exclusão de especiais aqui é só do lado assistido (via
 * `is_special = false` na contagem); do lado do TMDB, todo episódio
 * de temporada >= 1 conta como "principal" — pode gerar uma pequena
 * divergência em séries com muitos especiais internos (ex.: Lost),
 * mas é o melhor que dá pra fazer sem repetir a importação inteira.
 */
/**
 * TASK-046 (correção) — achado real: Dexter (2006), 96/96 episódios
 * marcados assistidos DIRETO NA TELA (não reimportação), TMDB
 * confirma `ended=true`, mas a série continuava em "Em dia" em vez
 * de "Assistidas". Causa: esta função nunca verificava a promoção
 * pra "completed" — só decidia entre "watching"/"up_to_date", e nem
 * buscava o `ended` do TMDB pra começo de conversa. Agora busca
 * `ended` também (mesma rota que o importador já usa) e checa a
 * MESMA regra de promoção da importação antes de cair pra
 * decideWatchingVsUpToDate.
 */
/**
 * TASK-061 (correção real, comprovada) — achado: séries adicionadas
 * pelo botão "+" (Explorar, ou qualquer outro "adicionar à
 * biblioteca") entram com status "want_to_watch". Esta função só
 * verificava `currentStatus === "watching" || "up_to_date"` — uma
 * série em "want_to_watch" que passava a ter episódios marcados
 * NUNCA era promovida pra "watching", ficando presa em
 * "want_to_watch" pra sempre, mesmo com 100% dos episódios
 * assistidos (porque a checagem de "completed" só rodava DEPOIS de
 * passar por esse guard). Isso reproduzia exatamente os dois bugs
 * relatados: contagem de "assistindo"/stats zerada mesmo com
 * episódios registrados, e série nunca migrando pra "Assistidas".
 *
 * MUDANÇA (a pedido, decisão revertida) — "paused" excluía o
 * recálculo de propósito até aqui: a ideia original era que marcar
 * um episódio ANTIGO numa série pausada (navegando pelo histórico)
 * não deveria "reviver" ela sozinha. Na prática, isso também
 * bloqueava o caso oposto — alguém marcando/desmarcando episódio de
 * propósito, testando se a série já está em dia, nunca via a
 * categoria mudar, ficando presa em "Interrompidas" pra sempre até
 * trocar o status manualmente. Decisão: o benefício de recalcular
 * de verdade (série pausada que já está em dia/assistida sendo
 * corretamente promovida) pesa mais que o risco de "reviver" sozinha
 * ao marcar um episódio antigo — igual como já funciona pras outras
 * categorias.
 */
export async function recalculateSeriesCategoryAfterEpisodeChange(seriesId: number): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return;

  const { data: statusRow, error: statusError } = await supabase
    .from("series_status")
    .select("status")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (statusError) return;

  /**
   * TASK-062 (correção real, comprovada) — achado: série adicionada
   * só marcando episódios (nunca passou por `useMoveLibraryItem`)
   * nunca ganha linha em `series_status` — o "Assistindo" que
   * aparece na tela é só o fallback derivado de
   * `buildLibraryItemsFromRows` (`isDerived: !explicit` → status
   * "watching"), nunca gravado. Antes, `!statusRow` cortava a função
   * aqui mesmo — ou seja, uma série "derivada" NUNCA podia ser
   * promovida pra "Em dia"/"Concluído", não importa quantos
   * episódios fossem marcados (reproduzido com Frieren e a Jornada
   * para o Além, 38/38 episódios, presa em "Assistindo"). Sem linha
   * = trata como "watching" (o mesmo fallback que a tela já assume)
   * e segue o fluxo normal — se a categoria mudar, o UPDATE abaixo
   * vira um UPSERT (cria a linha que nunca existiu, com a categoria
   * já correta).
   */
  const currentStatus = statusRow?.status ?? "watching";
  /*
   * CORREÇÃO (a pedido — mesma auditoria de Re:Zero/Tanya/Tomb Raider
   * King) — `"completed"` também estava fora daqui. Mesmo raciocínio
   * da função em lote (`recalculateUpToDateSeriesCategories`, logo
   * acima): série completed que ganha episódio novo precisa poder
   * ser reconsiderada, não ficar presa.
   */
  const eligibleForRecalc =
    currentStatus === "watching" ||
    currentStatus === "up_to_date" ||
    currentStatus === "want_to_watch" ||
    currentStatus === "paused" ||
    currentStatus === "completed";
  if (!eligibleForRecalc) return;

  let liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null; episodeId: number }[] = [];
  let ended = false;
  let watchedEpisodeKeys: Set<string> = new Set();
  let watchedEpisodeIds: Set<number> = new Set();
  let specialKeys: Set<string> = new Set();
  try {
    const [watchedLookup, specialKeysBySeriesId, episodesBySeriesId, summaryResponse] = await Promise.all([
      // CORREÇÃO (investigação do Bleach — ver comentário grande em
      // `fetchWatchedEpisodeKeysBySeriesId`, acima) — antes buscava só
      // um TOTAL (`count: "exact", head: true`); agora busca a
      // identidade real dos episódios assistidos, pro mesmo motivo.
      fetchWatchedEpisodeKeysBySeriesId(supabase, user.id, [seriesId]),
      fetchSpecialEpisodeKeysBySeriesId(supabase, user.id, [seriesId]),
      // CORREÇÃO (2026-09-03 — "3 séries presas em Continue
      // assistindo", ver comentário grande em
      // `fetchSeriesEpisodesAtExportWithRetry` acima) — era um `fetch`
      // cru aqui, que tratava "a busca falhou" e "série sem episódio
      // nenhum" como a MESMA coisa. Agora tenta de novo sozinho quando
      // a rota sinaliza falha de verdade (`failedIds`).
      fetchSeriesEpisodesAtExportWithRetry([seriesId]),
      fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: [seriesId] }),
      }),
    ]);
    watchedEpisodeKeys = watchedLookup.keysBySeriesId.get(seriesId) ?? new Set<string>();
    watchedEpisodeIds = watchedLookup.idsBySeriesId.get(seriesId) ?? new Set<number>();
    specialKeys = specialKeysBySeriesId.get(seriesId) ?? new Set<string>();
    liveEpisodes = episodesBySeriesId.get(seriesId) ?? [];
    if (summaryResponse.ok) {
      const data = (await summaryResponse.json()) as { series: { id: number; ended: boolean }[] };
      ended = data.series.find((s) => s.id === seriesId)?.ended ?? false;
    }
  } catch (error) {
    console.error(
      "[series-category-recalc] Falha ao buscar dados — categoria não recalculada desta vez.",
      error
    );
    return;
  }

  if (liveEpisodes.length === 0) return;

  // UNIFICAÇÃO (ver airDateCategory.ts) — mesma função usada pelo
  // recálculo em lote logo acima e pela rota admin: decide a
  // categoria (`resolveSeriesCategory`) e se ela deve ser gravada
  // (`shouldWriteSeriesCategory`, que protege "paused" de virar
  // "watching" sozinho e regrava "watching" mesmo sem mudança, pro
  // ranking de "Continue assistindo") — nenhuma dessas regras é
  // reimplementada aqui.
  const { category: newCategory } = resolveSeriesCategory({
    watchedEpisodeKeys,
    liveEpisodes,
    ended,
    specialEpisodeKeys: specialKeys,
    watchedEpisodeIds,
  });
  /**
   * BUG REAL CORRIGIDO (2026-09-03, ver comentário completo em
   * `shouldWriteSeriesCategory`, `airDateCategory.ts`) —
   * `allowWantToWatchPromotion: true` só AQUI, nunca no recálculo em
   * lote logo acima: esta função só roda quando o USUÁRIO marcou/
   * desmarcou um episódio NESTA série, de propósito — é exatamente o
   * caso que a TASK-061 (comentário no topo desta função) sempre quis
   * permitir. Sem isso, uma série "Assistir depois" nunca saía desse
   * status, mesmo com 100% dos episódios marcados — e por tabela nunca
   * aparecia em "Continue assistindo" pra poder "retomar".
   */
  if (!shouldWriteSeriesCategory(currentStatus, newCategory, { allowWantToWatchPromotion: true })) return;

  /**
   * TASK-062 — `upsert` em vez de `update`: séries sem linha prévia
   * (o caso "derivado" corrigido acima) precisam que a linha seja
   * CRIADA agora, com a categoria já correta — um `update` sozinho
   * não faz nada quando a linha não existe (0 rows affected, sem
   * erro nenhum), o que reproduziria o mesmo bug de um jeito
   * diferente (a função "decide" a categoria certa mas nunca grava).
   *
   * CORREÇÃO (2026-08-26 — "rede de segurança de 3 partes", parte B)
   * — trocado o `.upsert()` direto pela RPC
   * `set_series_status_with_history` (migration
   * `20260908000000_series_status_safety_net.sql`): grava o status E
   * uma linha em `series_status_history` na MESMA transação, já com
   * `source = 'auto_recalc'` — qualquer investigação futura (mesmo
   * padrão da que achou as 13 linhas fantasma do Solo Leveling)
   * consegue distinguir "o recálculo automático corrigiu isso" de
   * outras origens, sem precisar adivinhar pelo timestamp.
   */
  const { error: updateError } = await supabase.rpc("set_series_status_with_history", {
    p_user_id: user.id,
    p_series_id: seriesId,
    p_status: newCategory,
    p_source: "auto_recalc",
  });
  if (updateError) {
    console.error("[series-category-recalc] Falha ao atualizar categoria depois de marcar episódio.", updateError);
  }
}