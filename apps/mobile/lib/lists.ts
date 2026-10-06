import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";
import type { VerifiedTier } from "./publicProfile";

/**
 * LISTA COMPARTILHADA (2026-10-06) — retomada do zero, ver
 * `claude/SEENLIST-FEATURE-2026-10-06-lista-compartilhada.md` no
 * projeto pra todo o histórico de decisões. Sempre no máximo 1
 * co-dono por lista (nunca um grupo) — por isso 2 colunas na própria
 * tabela `lists` (migration `20261006000000_lists_co_owner.sql`), não
 * uma tabela de colaboradores.
 *
 * Co-dono tem direito IGUAL só sobre os ITENS da lista (adicionar/
 * remover) — nome e exclusão da lista continuam exclusivos de quem
 * criou (`ownerId`). Isso é reforçado no banco (RLS + trigger), não só
 * escondido na UI.
 */
export interface ListCoOwner {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  verifiedTier: VerifiedTier;
  status: "pending" | "accepted";
}

export interface UserList {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
  coOwner: ListCoOwner | null;
  /** Lista onde EU sou o co-dono (não o dono original) — controla o que a UI deixa eu fazer (não posso renomear/apagar). */
  isCoOwnedByMe: boolean;
}

/**
 * CACHE DE MÓDULO (2026-09-27, Etapa 3 — bug real reportado: "quando
 * entro nas bibliotecas... minhas listas... recarrega") — `app/lists/
 * index.tsx` é uma rota de PRIMEIRO NÍVEL (fora de `(tabs)`), então
 * desmonta de verdade sempre que você sai e volta — sem cache nenhum,
 * `useMyLists` refazia a busca do zero (com esqueleto) toda vez.
 *
 * Mesmo padrão já validado nesta auditoria pra `movieDetails.ts`/
 * `seriesDetails.ts` (`peekCachedMovieDetails`/`peekCachedSeriesDetails`):
 * TTL curto (5 min — as próprias listas mudam pouco, e criar/remover
 * lista já chama `refetch()` explicitamente, então não depende do TTL
 * pra ficar em dia), e o hook consumidor decide ANTES de mostrar
 * esqueleto se já tem algo em cache pra mostrar na hora.
 *
 * Chave por `userId` (não é dado global como `useDiscoverList` — é a
 * lista de UMA pessoa) — sem isso, trocar de conta no mesmo aparelho
 * sem reiniciar o app poderia mostrar as listas da conta anterior.
 */
const MY_LISTS_CACHE_TTL_MS = 5 * 60 * 1000;
let myListsCache: { userId: string; data: UserList[]; expiresAt: number } | null = null;

export function peekCachedMyLists(userId: string): UserList[] | null {
  return myListsCache && myListsCache.userId === userId && myListsCache.expiresAt > Date.now()
    ? myListsCache.data
    : null;
}

export interface ListItem {
  id: string;
  mediaType: "movie" | "series";
  mediaId: number;
  title: string;
  posterPath: string | null;
}

export interface ListWithPreview extends UserList {
  previewPosters: (string | null)[];
  itemCount: number;
}

/**
 * Idêntico a useMyLists do web, + co-dono (2026-10-06). A consulta
 * agora traz tanto as listas que EU criei quanto as que fui convidado
 * pra co-dono de (a RLS já permite SELECT nos dois casos — ver a
 * migration de co-dono) — sem isso, o client ia continuar assumindo
 * "toda linha que voltou é minha lista", o que não é mais verdade.
 */
export async function fetchMyLists(): Promise<UserList[]> {
  const {
    data: { user },
  } = await getCurrentAuthUser();

  const { data, error } = await supabase
    .from("lists")
    .select("id, name, created_at, user_id, co_owner_id, co_owner_status")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const result = await attachCoOwnerProfiles(data ?? [], user?.id ?? null);

  if (user) {
    myListsCache = { userId: user.id, data: result, expiresAt: Date.now() + MY_LISTS_CACHE_TTL_MS };
  }

  return result;
}

interface RawListRow {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  co_owner_id: string | null;
  co_owner_status: "pending" | "accepted" | null;
}

/**
 * `lists.co_owner_id` referencia `auth.users`, não `public.profiles`
 * direto — não dá pra embutir num só `select` do PostgREST (mesmo
 * motivo pelo qual `fetchNotifications` busca `actor_id` separado).
 * Uma única consulta em lote busca o perfil de todos os co-donos
 * distintos de uma vez (nunca uma consulta por lista).
 */
async function attachCoOwnerProfiles(rows: RawListRow[], viewerId: string | null): Promise<UserList[]> {
  const coOwnerIds = [...new Set(rows.map((r) => r.co_owner_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } =
    coOwnerIds.length > 0
      ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url, verified_tier").in("user_id", coOwnerIds)
      : { data: [] as { user_id: string; username: string; display_name: string | null; avatar_url: string | null; verified_tier: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return rows.map((row) => {
    const profile = row.co_owner_id ? profileById.get(row.co_owner_id) : null;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      ownerId: row.user_id,
      coOwner:
        profile && row.co_owner_status
          ? {
              userId: profile.user_id,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
              verifiedTier: (profile.verified_tier as VerifiedTier) ?? null,
              status: row.co_owner_status,
            }
          : null,
      isCoOwnedByMe: viewerId !== null && row.co_owner_id === viewerId,
    };
  });
}

/** Idêntico a useCreateList do web. */
export async function createList(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("lists").insert({ user_id: user.id, name: trimmed });
  if (error) throw error;
}

/** Idêntico a useAddToList do web — upsert ignora duplicata (mesmo item não entra duas vezes na mesma lista). */
export async function addToList(listId: string, mediaType: "movie" | "series", mediaId: number): Promise<void> {
  const { error } = await supabase
    .from("list_items")
    .upsert({ list_id: listId, media_type: mediaType, media_id: mediaId }, { onConflict: "list_id,media_type,media_id", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * TASK-172 (achado real — mesmo do web) — faltava desde sempre: dava
 * pra criar lista e adicionar item, mas nunca pra ver o que tinha
 * dentro. Junta `list_items` com o resumo do TMDB (título/pôster).
 */
export async function fetchListItems(listId: string, language = "pt-BR"): Promise<ListItem[]> {
  const { data: rows, error } = await supabase
    .from("list_items")
    .select("id, media_type, media_id, added_at")
    .eq("list_id", listId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const movieIds = rows.filter((r) => r.media_type === "movie").map((r) => r.media_id);
  const seriesIds = rows.filter((r) => r.media_type === "series").map((r) => r.media_id);
  const summaries = await fetchDisplaySummaries(movieIds, seriesIds, language);

  return rows.map((row) => {
    const summary = row.media_type === "movie" ? summaries.movies[row.media_id] : summaries.series[row.media_id];
    return {
      id: row.id,
      mediaType: row.media_type as "movie" | "series",
      mediaId: row.media_id,
      title: summary?.title ?? (row.media_type === "movie" ? `Filme #${row.media_id}` : `Série #${row.media_id}`),
      posterPath: summary?.posterPath ?? null,
    };
  });
}

export async function removeFromList(itemId: string): Promise<void> {
  const { error } = await supabase.from("list_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw error;
}

/**
 * Porta de `useMyListsWithPreview` do web — "Minhas listas" com
 * efeito baralho (até 4 pôsteres mais recentes por lista, o resto só
 * conta pra `itemCount`). Uma única consulta busca os itens de TODAS
 * as listas de uma vez (não uma consulta por lista), evitando N+1.
 */
export async function fetchMyListsWithPreview(language = "pt-BR"): Promise<ListWithPreview[]> {
  const {
    data: { user },
  } = await getCurrentAuthUser();

  const { data: rawLists, error } = await supabase
    .from("lists")
    .select("id, name, created_at, user_id, co_owner_id, co_owner_status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!rawLists || rawLists.length === 0) return [];

  const lists = await attachCoOwnerProfiles(rawLists, user?.id ?? null);

  const listIds = lists.map((l) => l.id);
  const { data: allItems, error: itemsError } = await supabase
    .from("list_items")
    .select("list_id, media_type, media_id, added_at")
    .in("list_id", listIds)
    .order("added_at", { ascending: false });
  if (itemsError) throw itemsError;

  const previewItemsByList = new Map<string, { media_type: "movie" | "series"; media_id: number }[]>();
  const countByList = new Map<string, number>();
  for (const item of allItems ?? []) {
    countByList.set(item.list_id, (countByList.get(item.list_id) ?? 0) + 1);
    const bucket = previewItemsByList.get(item.list_id) ?? [];
    if (bucket.length < 4) {
      bucket.push({ media_type: item.media_type as "movie" | "series", media_id: item.media_id });
      previewItemsByList.set(item.list_id, bucket);
    }
  }

  const movieIds: number[] = [];
  const seriesIds: number[] = [];
  for (const items of previewItemsByList.values()) {
    for (const item of items) {
      if (item.media_type === "movie") movieIds.push(item.media_id);
      else seriesIds.push(item.media_id);
    }
  }
  const { movies, series } = await fetchDisplaySummaries(movieIds, seriesIds, language);

  return lists.map((list) => {
    const items = previewItemsByList.get(list.id) ?? [];
    const previewPosters = items.map((item) => {
      const summary = item.media_type === "movie" ? movies[item.media_id] : series[item.media_id];
      return summary?.posterPath ?? null;
    });
    return {
      ...list,
      previewPosters,
      itemCount: countByList.get(list.id) ?? 0,
    };
  });
}

/**
 * Convida alguém pra co-dono da lista — busca por username (reaproveita
 * `fetchUserSearch`, o mesmo mecanismo de "Descobrir pessoas"). Só o
 * dono original pode convidar (reforçado pela RLS: `with check` da
 * policy de update exige `user_id = auth.uid()` OU `co_owner_id =
 * auth.uid()`, e o trigger bloqueia o co-dono de setar um convite —
 * ele só pode aceitar/recusar o próprio). Falha se a lista já tiver um
 * convite ativo (pending ou accepted) — só 1 co-dono por vez.
 */
export async function inviteCoOwner(listId: string, listName: string, targetUserId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  // `.is("co_owner_id", null)` garante atomicamente que não existe
  // convite ativo nenhum — sem o `.select()` pra checar `data.length`,
  // uma lista que já tem co-dono simplesmente não atualizaria nenhuma
  // linha e o erro passaria em branco (Supabase não trata "0 linhas
  // afetadas" como erro).
  const { data, error } = await supabase
    .from("lists")
    .update({ co_owner_id: targetUserId, co_owner_status: "pending" })
    .eq("id", listId)
    .is("co_owner_id", null)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Esta lista já tem um convite ativo.");

  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: targetUserId,
    actor_id: user.id,
    type: "list_coowner_invite",
    target_type: "list",
    target_id: listId,
    payload: { listName },
  });
  if (notifError) throw notifError;
}

/** O convidado aceita — o trigger no banco só deixa essa transição exata (pending -> accepted) passar pela mão do co-dono. */
export async function acceptCoOwnerInvite(listId: string, listName: string, ownerId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("lists").update({ co_owner_status: "accepted" }).eq("id", listId);
  if (error) throw error;

  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: ownerId,
    actor_id: user.id,
    type: "list_coowner_accepted",
    target_type: "list",
    target_id: listId,
    payload: { listName },
  });
  if (notifError) throw notifError;
}

/** O convidado recusa o convite — zera os dois campos (mesma transição que "saír", do ponto de vista do banco). */
export async function declineCoOwnerInvite(listId: string, listName: string, ownerId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("lists").update({ co_owner_id: null, co_owner_status: null }).eq("id", listId);
  if (error) throw error;

  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: ownerId,
    actor_id: user.id,
    type: "list_coowner_declined",
    target_type: "list",
    target_id: listId,
    payload: { listName },
  });
  if (notifError) throw notifError;
}

/**
 * O co-dono sai por conta própria (já aceito). Itens que ele adicionou
 * ficam na lista — decisão confirmada com o usuário. Tipo de
 * notificação PRÓPRIO (`list_coowner_left`, diferente de
 * `removeCoOwner` abaixo) porque quem recebe (o dono) precisa de um
 * texto diferente — "{co-dono} saiu" não é a mesma frase que "você
 * removeu {co-dono}".
 */
export async function leaveSharedList(listId: string, listName: string, ownerId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("lists").update({ co_owner_id: null, co_owner_status: null }).eq("id", listId);
  if (error) throw error;

  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: ownerId,
    actor_id: user.id,
    type: "list_coowner_left",
    target_type: "list",
    target_id: listId,
    payload: { listName },
  });
  if (notifError) throw notifError;
}

/** O dono original remove o co-dono (a qualquer momento, aceito ou não). Itens que o co-dono adicionou ficam na lista. */
export async function removeCoOwner(listId: string, listName: string, coOwnerId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("lists").update({ co_owner_id: null, co_owner_status: null }).eq("id", listId);
  if (error) throw error;

  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: coOwnerId,
    actor_id: user.id,
    type: "list_coowner_removed",
    target_type: "list",
    target_id: listId,
    payload: { listName },
  });
  if (notifError) throw notifError;
}
