import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { useToast } from "@/lib/toast/ToastProvider";

export interface UserList {
  id: string;
  name: string;
  createdAt: string;
}

const LISTS_KEY = ["lists"] as const;

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
      } = await supabase.auth.getUser();
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
