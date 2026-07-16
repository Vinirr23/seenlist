import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface PollOptionResult {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollData {
  options: PollOptionResult[];
  totalVotes: number;
  /** null enquanto o usuário não votou — voto é definitivo (TASK-163), nunca volta a null depois de votado. */
  votedOptionId: string | null;
}

function pollDataKey(postId: string) {
  return ["poll-data", postId] as const;
}

/**
 * TASK-163 (porta pro web — mobile continua sendo o único lugar que
 * CRIA enquete; aqui só ver e votar). Coluna real em `poll_options` é
 * `label`, não `option_text` — achado via consulta direta no banco
 * (a tabela já existia em produção antes desta tarefa, criada fora de
 * controle de versão, mesma situação de `posts`/`post_reports`; ver
 * SEENLIST-HANDOFF.md e a migration 20260817000000_polls.sql).
 *
 * Diferente do mobile (que busca em lote pra evitar N+1 no Feed), o
 * web segue o padrão já estabelecido em `social/likes.ts` — uma
 * consulta por post, via `useQuery` isolado por `PostCard`. Se o Feed
 * do web também ficar lento com muitas enquetes na tela, isso vira
 * uma tarefa de performance à parte (mesmo raciocínio do N+1
 * documentado no handoff mobile), não antecipado aqui sem necessidade
 * real.
 */
export function usePollData(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: pollDataKey(postId),
    queryFn: async (): Promise<PollData> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);

      const [optionsRes, votesRes] = await Promise.all([
        supabase.from("poll_options").select("id, label, position").eq("post_id", postId).order("position", { ascending: true }),
        supabase.from("poll_votes").select("option_id, user_id").eq("post_id", postId),
      ]);
      if (optionsRes.error) {
        console.error("[social/polls] Falha ao buscar opções da enquete", describeSupabaseError(optionsRes.error));
        throw optionsRes.error;
      }
      if (votesRes.error) {
        console.error("[social/polls] Falha ao buscar votos da enquete", describeSupabaseError(votesRes.error));
        throw votesRes.error;
      }

      const votes = votesRes.data ?? [];
      const countByOption = new Map<string, number>();
      for (const vote of votes) {
        countByOption.set(vote.option_id, (countByOption.get(vote.option_id) ?? 0) + 1);
      }
      const votedOptionId = user ? (votes.find((v) => v.user_id === user.id)?.option_id ?? null) : null;

      return {
        options: (optionsRes.data ?? []).map((o) => ({ id: o.id, text: o.label, voteCount: countByOption.get(o.id) ?? 0 })),
        totalVotes: votes.length,
        votedOptionId,
      };
    },
    enabled,
  });
}

/** Voto definitivo — a chave primária composta (post_id, user_id) em `poll_votes` barra segunda tentativa no banco; tratado aqui como não-erro, mesmo padrão de useReportPost/useToggleSavePost. */
export function useVotePoll(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optionId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("poll_votes").insert({ post_id: postId, option_id: optionId, user_id: user.id });
      if (error && error.code !== "23505") {
        console.error("[social/polls] Falha ao votar", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pollDataKey(postId) });
    },
  });
}
