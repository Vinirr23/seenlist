import { useQuery } from "@tanstack/react-query";
import type { LibraryStatus } from "@seenlist/types";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";

export function seriesStatusQueryKey(seriesId: number) {
  return ["series-status", seriesId] as const;
}

/**
 * CORREÇÃO — RLS deixou de restringir sozinha a uma linha só desde
 * que a política de biblioteca pública foi criada (permite ver
 * status de OUTROS usuários com perfil público/seguido). Sem filtrar
 * por user_id aqui, esta consulta (usada pra ver o PRÓPRIO status)
 * podia trazer 2+ linhas quando a mesma série também está na
 * biblioteca pública de outra pessoa — exatamente o erro relatado
 * ("JSON object requested, multiple (or no) rows returned").
 */
async function fetchSeriesStatus(seriesId: number): Promise<LibraryStatus | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("series_status")
    .select("status")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(
      `[series-status] Falha ao buscar status para series_id=${seriesId}: ${error.message ?? "sem mensagem"} ${error.details ?? ""} ${error.hint ?? ""} (código ${error.code ?? "?"})`,
      error
    );
    throw error;
  }
  const status = data?.status as LibraryStatus | "removed" | undefined;
  return status && status !== "removed" ? status : null;
}

export function useSeriesStatus(seriesId: number) {
  return useQuery({
    queryKey: seriesStatusQueryKey(seriesId),
    queryFn: () => fetchSeriesStatus(seriesId),
  });
}
