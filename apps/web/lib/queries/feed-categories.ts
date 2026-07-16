import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

/** Mesmo vocabulário fixo do CHECK da migration — mudar aqui sem mudar lá (ou vice-versa) quebra o insert. */
export const FEED_CATEGORIES = [
  { key: "series", label: "Séries" },
  { key: "filmes", label: "Filmes" },
  { key: "anime", label: "Anime" },
  { key: "kdrama", label: "K-Drama" },
  { key: "marvel", label: "Marvel" },
  { key: "dc", label: "DC" },
  { key: "star_wars", label: "Star Wars" },
  { key: "harry_potter", label: "Harry Potter" },
  { key: "scifi", label: "Sci-Fi" },
  { key: "terror", label: "Terror" },
  { key: "romance", label: "Romance" },
  { key: "comedia", label: "Comédia" },
  { key: "suspense", label: "Suspense" },
  { key: "misterio", label: "Mistério" },
  { key: "drama", label: "Drama" },
  { key: "documentarios", label: "Documentários" },
  { key: "reality", label: "Reality Shows" },
  { key: "animacoes", label: "Animações" },
  { key: "fantasia", label: "Fantasia" },
] as const;

export type FeedCategoryKey = (typeof FEED_CATEGORIES)[number]["key"];

function queryKey() {
  return ["feed-categories"] as const;
}

/**
 * TASK-059 — categorias escolhidas na tela de boas-vindas do Feed
 * (ou depois, nas configurações). `undefined` enquanto carrega,
 * array vazio genuinamente significa "ainda não escolheu nenhuma" —
 * é esse array vazio que decide se mostra o onboarding ou o feed.
 */
export function useMyFeedCategories() {
  return useQuery({
    queryKey: queryKey(),
    queryFn: async (): Promise<FeedCategoryKey[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { data, error } = await supabase.from("user_feed_categories").select("category").eq("user_id", user.id);

      if (error) {
        console.error("[feed-categories] Falha ao buscar categorias", describeSupabaseError(error));
        throw error;
      }
      return (data ?? []).map((r) => r.category as FeedCategoryKey);
    },
  });
}

/**
 * Substitui o conjunto inteiro de categorias (mais simples e sem
 * risco de inconsistência do que calcular diff de inserção/remoção
 * a cada mudança na tela — o picker sempre manda a seleção completa).
 */
export function useSetFeedCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categories: FeedCategoryKey[]) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error: deleteError } = await supabase.from("user_feed_categories").delete().eq("user_id", user.id);
      if (deleteError) throw deleteError;

      if (categories.length > 0) {
        const { error: insertError } = await supabase
          .from("user_feed_categories")
          .insert(categories.map((category) => ({ user_id: user.id, category })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey() });
    },
  });
}
