import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { decideWatchingVsUpToDate } from "./airDateCategory";
import { fetchWatchedEpisodeStats } from "./library-state";

const TMDB_EPISODES_CHUNK_SIZE = 20; // mesmo limite de /api/tmdb/series-episodes-at-export (MAX_IDS_PER_REQUEST)

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchLiveEpisodesBySeriesId(
  seriesIds: number[]
): Promise<Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>> {
  const result = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>();
  const chunks = chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE);
  const responses = await Promise.all(
    chunks.map((idsChunk) =>
      fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: idsChunk }),
      })
    )
  );
  for (const response of responses) {
    if (!response.ok) continue;
    const data = (await response.json()) as {
      series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] }[];
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
const RECALC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1x por dia — combinado com o usuário (ver PR/conversa de performance da Home).

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
 */
export async function recalculateUpToDateSeriesCategoriesThrottled(): Promise<void> {
  if (typeof window === "undefined") return;

  const lastRun = window.localStorage.getItem(RECALC_STORAGE_KEY);
  if (lastRun && Date.now() - Number(lastRun) < RECALC_MIN_INTERVAL_MS) {
    return;
  }

  await recalculateUpToDateSeriesCategories();
  window.localStorage.setItem(RECALC_STORAGE_KEY, String(Date.now()));
}

export async function recalculateUpToDateSeriesCategories(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return;

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
  if (statusError || !statusRows || statusRows.length === 0) return;

  const currentStatusBySeriesId = new Map(
    statusRows.map((row) => [row.series_id as number, row.status as "up_to_date" | "watching" | "completed"])
  );
  const seriesIds = statusRows.map((row) => row.series_id as number);

  let watchedCountBySeriesId: Map<number, number>;
  let episodesBySeriesId: Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>;
  let endedBySeriesId: Map<number, boolean>;
  try {
    const [watchedStats, episodesMap, endedMap] = await Promise.all([
      fetchWatchedEpisodeStats(supabase, user.id),
      fetchLiveEpisodesBySeriesId(seriesIds),
      fetchEndedBySeriesId(seriesIds),
    ]);
    watchedCountBySeriesId = new Map(watchedStats.map((stat) => [stat.series_id, stat.watched_count]));
    episodesBySeriesId = episodesMap;
    endedBySeriesId = endedMap;
  } catch (error) {
    console.error(
      "[recalculateUpToDateSeriesCategories] Falha ao buscar dados em lote — categorias não recalculadas desta vez.",
      error
    );
    return;
  }

  const updates: { user_id: string; series_id: number; status: "watching" | "up_to_date" | "completed"; updated_at: string }[] = [];
  const categoryBySeriesId = new Map<number, "watching" | "up_to_date" | "completed">();
  for (const seriesId of seriesIds) {
    const liveEpisodes = episodesBySeriesId.get(seriesId) ?? [];
    if (liveEpisodes.length === 0) continue; // TMDB não devolveu nada pra essa série desta vez — não mexe, mais seguro do que arriscar errado.

    const watched = watchedCountBySeriesId.get(seriesId) ?? 0;
    const ended = endedBySeriesId.get(seriesId) ?? false;
    const allEpisodesWatched = watched >= liveEpisodes.length;
    const newCategory = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes).category;
    categoryBySeriesId.set(seriesId, newCategory);
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
     * CORREÇÃO (bug real, achado reanalisando "Tanya the Evil, Tomb
     * Raider King sem aparecer em Continue assistindo" — mesmo bug do
     * mobile, `apps/mobile/lib/seriesDetails.ts`) — "Continue
     * assistindo" corta em `CONTINUE_ASSISTINDO_LIMIT` (8), ordenado
     * por `updated_at` — campo que só era tocado quando a CATEGORIA
     * mudava. Série já corretamente em "watching" (sem mudança de
     * categoria) nunca tinha `updated_at` atualizado, mesmo ganhando
     * episódio novo de verdade — podia afundar no ranking, perdida
     * pra outra série "mexida" por qualquer motivo, e sair das 8
     * vagas visíveis.
     *
     * Agora grava (bate `updated_at`) sempre que a categoria
     * calculada é "watching" — existe episódio pendente de verdade —
     * mesmo sem mudança de categoria. "up_to_date"/"completed" não
     * têm nada pendente, não sobem no ranking à toa.
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
      fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: [seriesId] }),
      }),
      fetch("/api/tmdb/library-summaries", {
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
    console.error(
      "[series-category-recalc] Falha ao buscar dados do TMDB — categoria não recalculada desta vez.",
      error
    );
    return;
  }

  if (liveEpisodes.length === 0) return;

  const watched = watchedCount ?? 0;
  const allEpisodesWatched = watched >= liveEpisodes.length;
  const newCategory =
    ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes).category;

  /*
   * CORREÇÃO (mesma auditoria — consistência com
   * `recalculateUpToDateSeriesCategories`, logo acima) — antes,
   * categoria sem mudança = SEM gravar nada, nem quando o usuário
   * tinha acabado de marcar episódio (interação real, agora mesmo).
   * "watching" sem mudança de categoria ainda assim atualiza
   * `updated_at` — é o campo que decide a ordem de "Continue
   * assistindo" (corte de 8), e essa série tem episódio pendente de
   * verdade, merece refletir isso na ordenação.
   */
  if (newCategory === currentStatus && newCategory !== "watching") return;

  /**
   * TASK-062 — `upsert` em vez de `update`: séries sem linha prévia
   * (o caso "derivado" corrigido acima) precisam que a linha seja
   * CRIADA agora, com a categoria já correta — um `update` sozinho
   * não faz nada quando a linha não existe (0 rows affected, sem
   * erro nenhum), o que reproduziria o mesmo bug de um jeito
   * diferente (a função "decide" a categoria certa mas nunca grava).
   */
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