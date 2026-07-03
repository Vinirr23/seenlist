import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

interface UseOptimisticMutationOptions<TVariables, TCache> {
  queryKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<void>;
  /** Recebe o valor atual do cache e as variáveis da mutation, devolve o novo valor otimista. */
  optimisticUpdate: (current: TCache | undefined, variables: TVariables) => TCache;
}

/**
 * Padrão repetido em várias mutations do app (episódio assistido,
 * status de filme, mover/remover da biblioteca): atualizar o cache
 * do React Query na hora do clique — "atualizar imediatamente a
 * interface" —, confirmar com o backend depois, e desfazer se der
 * erro. Extraído aqui (revisão de estabilização, TASK-007A) pra não
 * reimplementar cancelQueries/getQueryData/setQueryData/rollback/
 * invalidateQueries a cada mutation nova.
 */
export function useOptimisticMutation<TVariables, TCache>({
  queryKey,
  mutationFn,
  optimisticUpdate,
}: UseOptimisticMutationOptions<TVariables, TCache>) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, TVariables, { previous: TCache | undefined }>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TCache>(queryKey);
      queryClient.setQueryData<TCache>(queryKey, (current) => optimisticUpdate(current, variables));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
