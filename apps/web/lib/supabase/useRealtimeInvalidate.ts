import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "./client";

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

    /**
     * CORREÇÃO DE PERFORMANCE (achado real, auditoria) — usava
     * `supabase.auth.getUser()` (chamada de rede real ao servidor de
     * Auth) só pra pegar o id do usuário atual e montar o filtro do
     * canal. Esse hook monta em toda visita a Séries, Filmes,
     * Biblioteca e Perfil — cada montagem disparava essa chamada de
     * rede à toa. `getCurrentAuthUser()` (mesmo padrão já documentado
     * em `lib/supabase/client.ts` e usado no resto de `lib/queries/`)
     * lê a sessão do armazenamento local, sem rede — a segurança de
     * verdade continua sendo o RLS do Postgres por trás do filtro
     * `user_id=eq.*`, que roda de qualquer forma no servidor.
     */
    getCurrentAuthUser(supabase).then(({ data: { user } }) => {
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
