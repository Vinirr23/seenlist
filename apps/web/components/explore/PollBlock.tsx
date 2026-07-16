"use client";

import { CheckCircle2 } from "lucide-react";
import { usePollData, useVotePoll } from "@/lib/queries/social/polls";
import { cn } from "@seenlist/utils";

/**
 * TASK-163 (porta pro web) — mesmo comportamento do `PollBlock`
 * mobile: antes de votar, só as opções (sem números — resultado só
 * aparece pra quem já votou, decisão confirmada com o usuário). Voto
 * é definitivo, sem caminho de volta pra tela de opções nesta UI.
 */
export function PollBlock({ postId }: { postId: string }) {
  const { data, isLoading } = usePollData(postId, true);
  const vote = useVotePoll(postId);

  if (isLoading || !data || data.options.length === 0) return null;

  const hasVoted = !!data.votedOptionId;

  function handleVote(optionId: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (vote.isPending || hasVoted) return;
    vote.mutate(optionId);
  }

  return (
    <div className="mt-2.5 space-y-2">
      {data.options.map((option) => {
        const percent = hasVoted && data.totalVotes > 0 ? Math.round((option.voteCount / data.totalVotes) * 100) : 0;
        const isChosen = option.id === data.votedOptionId;

        if (!hasVoted) {
          return (
            <button
              key={option.id}
              type="button"
              onClick={(e) => handleVote(option.id, e)}
              disabled={vote.isPending}
              className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-text hover:border-primary disabled:opacity-60"
            >
              {option.text}
            </button>
          );
        }

        return (
          <div key={option.id} className="relative overflow-hidden rounded-lg border border-border bg-background">
            <div
              className={cn("absolute inset-y-0 left-0", isChosen ? "bg-primary/25" : "bg-border")}
              style={{ width: `${percent}%` }}
            />
            <div className="relative flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {isChosen && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />}
                <span className={cn("truncate text-sm", isChosen ? "font-bold text-primary" : "text-text")}>{option.text}</span>
              </div>
              <span className="shrink-0 text-xs font-bold text-muted">{percent}%</span>
            </div>
          </div>
        );
      })}

      {hasVoted && (
        <p className="text-[11px] text-muted">
          {data.totalVotes} {data.totalVotes === 1 ? "voto" : "votos"}
        </p>
      )}
    </div>
  );
}
