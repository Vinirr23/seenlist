import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchLiveEpisodesBySeriesId } from "@/lib/seriesDetails";

/**
 * PROGRESSO COMPARTILHADO (2026-10-14, a pedido — mockup aprovado,
 * "Progresso compartilhado": https://claude.ai/artifact/2EoarKtBiGa5gCgDxGLxCq).
 * Ver comentário grande na migration (`20261014000000_list_watch_progress.sql`)
 * pro raciocínio completo.
 *
 * REGRA NÃO-NEGOCIÁVEL DO USUÁRIO: isto NUNCA lê nem escreve em
 * `watched_episodes` (histórico individual) — os dois sistemas são
 * independentes de propósito. O progresso daqui só pode ser alterado
 * pelo botão "Marcar próximo episódio" DENTRO da lista compartilhada
 * (`markNextEpisode`, abaixo) — nunca pelos checks verdes individuais
 * da página da série (`toggleEpisodeWatched`, em `seriesDetails.ts`,
 * continua intocado por este arquivo).
 */
export interface ListWatchProgress {
  listId: string;
  mediaType: "movie" | "series";
  mediaId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  status: "in_progress" | "completed";
  updatedAt: string;
}

interface RawProgressRow {
  list_id: string;
  media_type: "movie" | "series";
  media_id: number;
  season_number: number | null;
  episode_number: number | null;
  status: "in_progress" | "completed";
  updated_at: string;
}

function progressKey(mediaType: "movie" | "series", mediaId: number): string {
  return `${mediaType}-${mediaId}`;
}

function toProgress(row: RawProgressRow): ListWatchProgress {
  return {
    listId: row.list_id,
    mediaType: row.media_type,
    mediaId: row.media_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

/**
 * Todo progresso compartilhado de UMA lista — usada pela tela de
 * detalhe da lista (`app/lists/[id].tsx`) pra desenhar o card de cada
 * item com acompanhamento ativo. A RLS (ver migration) já garante que
 * só retorna linhas de listas que o usuário vê (dono ou co-dono aceito).
 */
export async function fetchListWatchProgress(listId: string): Promise<Map<string, ListWatchProgress>> {
  const { data, error } = await supabase
    .from("list_watch_progress")
    .select("list_id, media_type, media_id, season_number, episode_number, status, updated_at")
    .eq("list_id", listId);
  if (error) throw error;

  const result = new Map<string, ListWatchProgress>();
  for (const row of data ?? []) {
    result.set(progressKey(row.media_type, row.media_id), toProgress(row as RawProgressRow));
  }
  return result;
}

/**
 * Progresso compartilhado de um TÍTULO, em qualquer lista compartilhada
 * de que o usuário participa — usada pela página da série
 * (`app/series/[id].tsx`) pro card secundário "Assistir juntos ❤️". Um
 * título pode, em teoria, estar em mais de uma lista compartilhada com
 * progresso ativo; v1 mostra só a mais recentemente atualizada (sem UI
 * pra escolher entre várias — não foi pedido, e é um caso raro).
 */
export async function fetchWatchProgressForTitle(
  mediaType: "movie" | "series",
  mediaId: number
): Promise<{ listId: string; listName: string; progress: ListWatchProgress } | null> {
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-10-14, reportado em teste real — o
   * cartão nunca aparecia na página da série, mesmo com a lista já
   * compartilhada e aceita e o progresso já marcado). A 1ª versão
   * filtrava pelo recurso embutido (`lists!inner(...)` + `.eq("lists.
   * co_owner_status", ...)`) numa única consulta — sintaxe que o
   * PostgREST aceita em teoria, mas que não voltou nenhuma linha aqui
   * na prática (não dava pra confirmar a causa exata sem acesso ao
   * log de rede do app rodando). Trocado por DUAS consultas simples,
   * sem embed nenhum — mesmo padrão que o resto do projeto já usa
   * quando duas tabelas puderem ser juntadas via PostgREST mas a
   * confiabilidade pesa mais que 1 consulta a menos (ver
   * `attachParticipantProfiles` em `lib/lists.ts`, mesmo raciocínio).
   */
  const { data: rows, error } = await supabase
    .from("list_watch_progress")
    .select("list_id, media_type, media_id, season_number, episode_number, status, updated_at")
    .eq("media_type", mediaType)
    .eq("media_id", mediaId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return null;

  const listIds = rows.map((r) => r.list_id);
  const { data: lists, error: listsError } = await supabase
    .from("lists")
    .select("id, name, co_owner_status")
    .in("id", listIds);
  if (listsError) throw listsError;

  // Só conta como "compartilhado" com o convite já ACEITO — mesma
  // regra de `isSharedAccepted` em `app/lists/[id].tsx`. Uma lista sem
  // co-dono (ou convite ainda pendente) não deveria ter ganhado uma
  // linha de progresso (a UI só oferece o botão numa lista já
  // compartilhada e aceita), mas o filtro fica explícito mesmo assim —
  // nunca assumir que os dados upstream já garantem isso.
  const acceptedListById = new Map((lists ?? []).filter((l) => l.co_owner_status === "accepted").map((l) => [l.id, l]));

  const row = rows.find((r) => acceptedListById.has(r.list_id));
  if (!row) return null;
  const list = acceptedListById.get(row.list_id)!;
  return { listId: row.list_id, listName: list.name, progress: toProgress(row as RawProgressRow) };
}

/** Episódio atual (nome real) + episódios restantes na temporada — ver `fetchSharedEpisodeInfo`, abaixo. */
export interface SharedEpisodeInfo {
  /** Nome real do episódio (T0x·Epy marcado) — vem do TMDB via `fetchLiveEpisodesBySeriesId`, nunca inventado. `null` só se o episódio não for encontrado na lista ao vivo (caso raro, ex. dado desatualizado). */
  episodeName: string | null;
  /** Episódios restantes NA TEMPORADA ATUAL, a partir do episódio marcado. */
  remainingInSeason: number;
}

/**
 * NOME DO EPISÓDIO + SELO "+N" DO CARTÃO GRANDE (2026-10-14, mockup
 * aprovado — "mesma estética": pílula do título, código T0x|E0y, NOME
 * do episódio (igual à Home, que mostra `display.name` — antes este
 * card só tinha o texto genérico "Temporada X · Ep. Y") e a tag de
 * status por último. O "+N" é MESMO visual da Home, mas com dado do
 * PRÓPRIO progresso compartilhado — nunca o histórico individual, que
 * é o que o "+N" da Home de fato conta (decisão do usuário, mantida:
 * aqui o selo é só informativo, sem seta/sheet — ver comentário em
 * `SharedProgressRow`).
 *
 * Batched (uma chamada só pra N séries, reaproveita o cache de
 * `fetchLiveEpisodesBySeriesId`) pra não repetir o mesmo N+1 já
 * corrigido antes noutras telas deste app.
 */
export async function fetchSharedEpisodeInfo(
  entries: { mediaId: number; seasonNumber: number; episodeNumber: number }[]
): Promise<Map<number, SharedEpisodeInfo>> {
  const result = new Map<number, SharedEpisodeInfo>();
  if (entries.length === 0) return result;

  const liveEpisodesBySeriesId = await fetchLiveEpisodesBySeriesId(entries.map((e) => e.mediaId));
  for (const entry of entries) {
    const episodes = liveEpisodesBySeriesId.get(entry.mediaId) ?? [];
    const current = episodes.find((e) => e.seasonNumber === entry.seasonNumber && e.episodeNumber === entry.episodeNumber);
    const remaining = episodes.filter((e) => e.seasonNumber === entry.seasonNumber && e.episodeNumber > entry.episodeNumber).length;
    result.set(entry.mediaId, { episodeName: current?.name ?? null, remainingInSeason: remaining });
  }
  return result;
}

/**
 * Avança o progresso compartilhado pro PRÓXIMO episódio pendente da
 * série (ordem temporada→episódio, temporada 0/especiais ignorada —
 * mesmo critério de exclusão que `watched_episodes`/`is_special` usa
 * pro histórico individual, aplicado aqui só pra ordenar, nunca lendo
 * aquela tabela). Sem posição atual ainda (1ª vez) — começa do
 * primeiro episódio da série. Se a posição atual já é o último
 * episódio existente, não avança: marca `status: "completed"` em vez
 * disso ("Concluída juntos" na UI).
 */
export async function markNextEpisode(listId: string, seriesId: number, current: ListWatchProgress | undefined): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const liveEpisodesBySeriesId = await fetchLiveEpisodesBySeriesId([seriesId]);
  const episodes = (liveEpisodesBySeriesId.get(seriesId) ?? [])
    .filter((e) => e.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  if (episodes.length === 0) throw new Error("Nenhum episódio encontrado pra esta série.");

  const currentIndex =
    current?.seasonNumber != null && current?.episodeNumber != null
      ? episodes.findIndex((e) => e.seasonNumber === current.seasonNumber && e.episodeNumber === current.episodeNumber)
      : -1;

  const next = episodes[currentIndex + 1];
  const isLastAlready = current?.status === "completed" || (currentIndex >= 0 && currentIndex === episodes.length - 1);
  if (!next || isLastAlready) {
    // Já estava no último episódio (ou passou dele) — só confirma "completed", sem mudar a posição.
    // `episodes.length === 0` já lançou erro acima, então sempre existe um último — só o TS não sabe.
    const last = episodes[episodes.length - 1]!;
    const { error } = await supabase.from("list_watch_progress").upsert(
      {
        list_id: listId,
        media_type: "series",
        media_id: seriesId,
        season_number: current?.seasonNumber ?? last.seasonNumber,
        episode_number: current?.episodeNumber ?? last.episodeNumber,
        status: "completed",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "list_id,media_type,media_id" }
    );
    if (error) throw error;
    return;
  }

  const isNowLast = currentIndex + 1 === episodes.length - 1;
  const { error } = await supabase.from("list_watch_progress").upsert(
    {
      list_id: listId,
      media_type: "series",
      media_id: seriesId,
      season_number: next.seasonNumber,
      episode_number: next.episodeNumber,
      status: isNowLast ? "completed" : "in_progress",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "list_id,media_type,media_id" }
  );
  if (error) throw error;
}

/**
 * TOQUE E SEGURE — "voltar 1 episódio" / "assistir de novo" (2026-10-14,
 * a pedido — "não tem como desmarcar um episódio e nem conta como
 * reassistido também", opção escolhida via `AskUserQuestion`, mockup
 * aprovado: https://claude.ai/artifact/ThspcdLkpmnrQvVQd41MMp). Espelha
 * `markNextEpisode` na direção contrária, mesma fonte de episódios
 * (TMDB via `fetchLiveEpisodesBySeriesId`, mesmo filtro/ordenação):
 *
 * - Série CONCLUÍDA: reinicia do episódio 1 (ou, no caso raro de uma
 *   série com um único episódio no total, o próprio episódio 1 já é o
 *   último — fica "completed" de novo, mesmo critério de `isNowLast`
 *   usado em `markNextEpisode`). A UI confirma com o usuário antes de
 *   chamar esta função (perde-se o "concluída junto") — ver `Alert` em
 *   `SharedProgressRow.handleRewind`, `app/lists/[id].tsx`.
 * - Em andamento, não no 1º episódio: volta 1 posição.
 * - Em andamento, já no 1º episódio da série (temporada 1, episódio 1
 *   de verdade — não um valor padrão): APAGA a linha, mesma convenção
 *   de "nunca foi marcado" que `toggleMovieWatched` usa pro filme —
 *   sem um 3º estado fantasma que a UI não desenha.
 * - Sem progresso ainda (`current` undefined): nada pra voltar, não
 *   escreve nada — defensivo, a UI não oferece o gesto nesse caso
 *   (`hasStarted` em `SharedProgressRow`).
 */
export async function rewindEpisode(listId: string, seriesId: number, current: ListWatchProgress | undefined): Promise<void> {
  if (!current) return;

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const liveEpisodesBySeriesId = await fetchLiveEpisodesBySeriesId([seriesId]);
  const episodes = (liveEpisodesBySeriesId.get(seriesId) ?? [])
    .filter((e) => e.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  if (episodes.length === 0) throw new Error("Nenhum episódio encontrado pra esta série.");

  if (current.status === "completed") {
    const first = episodes[0]!;
    const isAlsoLast = episodes.length === 1;
    const { error } = await supabase.from("list_watch_progress").upsert(
      {
        list_id: listId,
        media_type: "series",
        media_id: seriesId,
        season_number: first.seasonNumber,
        episode_number: first.episodeNumber,
        status: isAlsoLast ? "completed" : "in_progress",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "list_id,media_type,media_id" }
    );
    if (error) throw error;
    return;
  }

  const currentIndex = episodes.findIndex((e) => e.seasonNumber === current.seasonNumber && e.episodeNumber === current.episodeNumber);
  if (currentIndex <= 0) {
    // Já no 1º episódio (ou posição não encontrada na lista ao vivo, caso raro de dado desatualizado) — desmarca tudo.
    const { error } = await supabase
      .from("list_watch_progress")
      .delete()
      .match({ list_id: listId, media_type: "series", media_id: seriesId });
    if (error) throw error;
    return;
  }

  const previous = episodes[currentIndex - 1]!;
  const { error } = await supabase.from("list_watch_progress").upsert(
    {
      list_id: listId,
      media_type: "series",
      media_id: seriesId,
      season_number: previous.seasonNumber,
      episode_number: previous.episodeNumber,
      status: "in_progress",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "list_id,media_type,media_id" }
  );
  if (error) throw error;
}

/**
 * PRATELEIRA DE FILMES (2026-10-15, a pedido — "lista de filmes que
 * desliza pro lado, igual as bibliotecas", mockup Opção D aprovado:
 * https://claude.ai/artifact/MJ5sSF1aeAVguYsuabZoVf) — progresso
 * compartilhado de FILME é binário (assistido junto / ainda não),
 * sempre `season_number`/`episode_number` nulos — filme não tem
 * temporada/episódio, diferente de série (`markNextEpisode`, acima).
 * MESMA tabela/regra de sempre: nunca lê nem escreve em `movie_status`
 * (histórico individual).
 *
 * "Desmarcar" APAGA a linha (em vez de voltar pra `in_progress`, que
 * não faz sentido pra filme — não existe um "meio do caminho" binário)
 * — deixa `fetchListWatchProgress` devolver exatamente o mesmo estado
 * de "nunca foi marcado" (sem entrada no mapa), sem um 3º estado
 * fantasma que a UI não desenha.
 */
export async function toggleMovieWatched(listId: string, movieId: number, currentlyWatched: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyWatched) {
    const { error } = await supabase
      .from("list_watch_progress")
      .delete()
      .match({ list_id: listId, media_type: "movie", media_id: movieId });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("list_watch_progress").upsert(
    {
      list_id: listId,
      media_type: "movie",
      media_id: movieId,
      season_number: null,
      episode_number: null,
      status: "completed",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "list_id,media_type,media_id" }
  );
  if (error) throw error;
}
