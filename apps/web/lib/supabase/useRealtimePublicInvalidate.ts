import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { createClient } from "./client";

/**
 * A PEDIDO — "Feed mais vivo": variante de `useRealtimeInvalidate.ts`
 * pensada pra dado PÚBLICO/social (curtida, comentário, post novo de
 * qualquer pessoa), não só o do usuário logado. O hook original tem
 * `filter: user_id=eq.{meu_id}` embutido de propósito — funciona
 * certo pra "minha biblioteca" (só eu marco meus próprios
 * episódios), mas bloquearia completamente as mudanças de QUALQUER
 * outra pessoa, que é exatamente o oposto do que o Feed precisa.
 *
 * `queryKey` aqui pode ser um PREFIXO (`exact: false`) — os hooks em
 * lote do Feed (`useLikeInfoBatch`, `useCommentCountsBatch`) têm a
 * lista de ids concatenada dentro da própria chave, que muda toda
 * vez que a lista de posts é diferente; invalidar por prefixo evita
 * ter que sincronizar a chave exata aqui.
 */
export function useRealtimePublicInvalidate(
  tables: readonly string[],
  queryKey: QueryKey,
  options?: { filter?: string; exact?: boolean; enabled?: boolean }
) {
  const queryClient = useQueryClient();
  const tablesKey = tables.join(",");
  const filterKey = options?.filter ?? "";
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    /*
     * A PEDIDO — `enabled` (novo). `LikeButton.tsx` passa `false`
     * quando está dentro de uma lista com lote próprio (Feed,
     * comentários, avaliações — cada um já tem SUA PRÓPRIA inscrição,
     * uma só pra tela inteira) — sem isso, cada instância do botão
     * criaria uma conexão de Realtime própria: numa tela com 50
     * comentários, 50 conexões abertas ao mesmo tempo, só pra
     * cobrir o mesmo dado que a inscrição do pai já cobre sozinha.
     */
    if (!enabled) return;

    const supabase = createClient();
    let builder = supabase.channel(`realtime-public-${queryKey.join("-")}`);
    for (const table of tables) {
      builder = builder.on(
        "postgres_changes",
        options?.filter ? { event: "*", schema: "public", table, filter: options.filter } : { event: "*", schema: "public", table },
        () => queryClient.invalidateQueries({ queryKey, exact: options?.exact ?? true })
      );
    }
    const channel = builder.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tablesKey/filterKey representam tables/options.filter de forma estável
  }, [queryClient, tablesKey, filterKey, queryKey.join("-"), enabled]);
}
