import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { useToast } from "@/lib/toast/ToastProvider";
import { fetchDisplaySummaries } from "./library-state";

export interface UserList {
  id: string;
  name: string;
  createdAt: string;
}

export interface ListItem {
  id: string;
  mediaType: "movie" | "series";
  mediaId: number;
  title: string;
  posterPath: string | null;
  addedAt: string;
}

const LISTS_KEY = ["lists"] as const;
const listItemsKey = (listId: string) => ["list-items", listId] as const;

export function useMyLists() {
  return useQuery({
    queryKey: LISTS_KEY,
    queryFn: async (): Promise<UserList[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lists")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[lists] Falha ao buscar listas", describeSupabaseError(error));
        throw error;
      }

      return (data ?? []).map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
    },
  });
}

export function useAddToList() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      listId,
      mediaType,
      mediaId,
    }: {
      listId: string;
      mediaType: "movie" | "series";
      mediaId: number;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("list_items")
        .upsert(
          { list_id: listId, media_type: mediaType, media_id: mediaId },
          { onConflict: "list_id,media_type,media_id", ignoreDuplicates: true }
        );
      if (error) {
        console.error("[lists] Falha ao adicionar item à lista", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-items"] });
      toast.success("Adicionado à lista");
    },
    onError: () => {
      toast.error("Não foi possível adicionar à lista agora");
    },
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("lists").insert({ user_id: user.id, name });
      if (error) {
        console.error("[lists] Falha ao criar lista", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success("Lista criada");
    },
    onError: () => {
      toast.error("Não foi possível criar a lista agora");
    },
  });
}

/**
 * TASK-172 (achado real — a lista existia só até a metade: dava pra
 * criar e adicionar item pelo menu "...", mas nunca dava pra ABRIR
 * uma lista e ver o que tinha dentro, nem remover nada — o clique no
 * nome nem estava ligado a rota nenhuma). Junta `list_items` com o
 * resumo do TMDB (título/pôster), mesma função que a Biblioteca usa
 * (`fetchDisplaySummaries`), reaproveitada em vez de duplicada.
 */
export function useListItems(listId: string | null) {
  return useQuery({
    queryKey: listItemsKey(listId ?? ""),
    enabled: Boolean(listId),
    queryFn: async (): Promise<ListItem[]> => {
      const supabase = createClient();
      const { data: rows, error } = await supabase
        .from("list_items")
        .select("id, media_type, media_id, added_at")
        .eq("list_id", listId as string)
        .order("added_at", { ascending: false });
      if (error) {
        console.error("[lists] Falha ao buscar itens da lista", describeSupabaseError(error));
        throw error;
      }
      if (!rows || rows.length === 0) return [];

      const movieIds = rows.filter((r) => r.media_type === "movie").map((r) => r.media_id);
      const seriesIds = rows.filter((r) => r.media_type === "series").map((r) => r.media_id);
      const summaries = await fetchDisplaySummaries(movieIds, seriesIds);

      return rows.map((row) => {
        const summary = row.media_type === "movie" ? summaries.movies[row.media_id] : summaries.series[row.media_id];
        return {
          id: row.id,
          mediaType: row.media_type as "movie" | "series",
          mediaId: row.media_id,
          title: summary?.title ?? (row.media_type === "movie" ? `Filme #${row.media_id}` : `Série #${row.media_id}`),
          posterPath: summary?.posterPath ?? null,
          addedAt: row.added_at,
        };
      });
    },
  });
}

export function useRemoveFromList(listId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("list_items").delete().eq("id", itemId);
      if (error) {
        console.error("[lists] Falha ao remover item da lista", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listItemsKey(listId) });
    },
    onError: () => {
      toast.error("Não foi possível remover agora");
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (listId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("lists").delete().eq("id", listId);
      if (error) {
        console.error("[lists] Falha ao apagar lista", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success("Lista apagada");
    },
    onError: () => {
      toast.error("Não foi possível apagar a lista agora");
    },
  });
}

export interface ListWithPreview extends UserList {
  previewPosters: (string | null)[];
  itemCount: number;
}

/**
 * TASK-178 — "Minhas listas" ganha prévia visual (pôsteres
 * empilhados dos itens mais recentes de cada lista), em vez de só
 * "0 >". Uma única consulta busca os itens de TODAS as listas de
 * uma vez (filtrando por `list_id in (...)`), já ordenados por mais
 * recente — dá pra separar por lista no próprio código, sem precisar
 * de uma consulta por lista.
 */
export function useMyListsWithPreview() {
  return useQuery({
    queryKey: [...LISTS_KEY, "with-preview"],
    queryFn: async (): Promise<ListWithPreview[]> => {
      const supabase = createClient();
      const { data: lists, error } = await supabase
        .from("lists")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!lists || lists.length === 0) return [];

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
      const { movies, series } = await fetchDisplaySummaries(movieIds, seriesIds);

      return lists.map((list) => {
        const items = previewItemsByList.get(list.id) ?? [];
        const previewPosters = items.map((item) => {
          const summary = item.media_type === "movie" ? movies[item.media_id] : series[item.media_id];
          return summary?.posterPath ?? null;
        });
        return {
          id: list.id,
          name: list.name,
          createdAt: list.created_at,
          previewPosters,
          itemCount: countByList.get(list.id) ?? 0,
        };
      });
    },
  });
}
