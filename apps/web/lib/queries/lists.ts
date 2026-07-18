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
