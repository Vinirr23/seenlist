import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { createClient } from "./client";

/**
 * Assina mudanças (`postgres_changes`) numa ou mais tabelas do
 * usuário logado e invalida uma query do React Query quando
 * qualquer uma delas muda — é o que faz "sem reload" acontecer de
 * verdade (não só entre abas da mesma tela, entre features
 * diferentes também: marcar um episódio assistido na Página da
 * Série invalida tanto a Biblioteca quanto o Perfil, cada um com sua
 * própria assinatura desta mesma função).
 *
 * Extraído de `useLibraryRealtimeSync` (TASK-007) na conexão do
 * fluxo principal (TASK-009) pra não duplicar a mesma assinatura
 * Supabase uma segunda vez no Perfil.
 */
export function useRealtimeInvalidate(tables: readonly string[], queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const tablesKey = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;

      let builder = supabase.channel(`realtime-${queryKey.join("-")}-${user.id}`);
      for (const table of tables) {
        builder = builder.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
          () => queryClient.invalidateQueries({ queryKey })
        );
      }
      channel = builder.subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tablesKey representa `tables` de forma estável
  }, [queryClient, tablesKey, queryKey.join("-")]);
}
