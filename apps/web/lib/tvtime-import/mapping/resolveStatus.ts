/**
 * TASK-166 — "up_to_date" adicionado à união. `resolveStatus()` em
 * si continua nunca retornando esse valor (só decide entre os 3
 * originais, sem olhar pra data de exibição nenhuma) — quem promove
 * "watching" pra "up_to_date" é a correção de
 * `correctStatusWithLiveTmdb.ts`, chamada depois, em runImport.ts.
 * O tipo precisa incluir o quarto valor porque é o que
 * `correctStatusWithLiveTmdb` retorna, e o resto do pipeline
 * (diagnóstico, gravação no Supabase) usa este mesmo tipo pra tudo
 * que é "o status final decidido pra uma série".
 */
export type ResolvedStatus = "watching" | "want_to_watch" | "completed" | "up_to_date";

/**
 * TASK-027B — "nunca colocar todas as séries em Assistir depois".
 *
 * Assistir depois: status explícito "for_later" (user_show_special_status.csv)
 *   OU zero episódios ÚNICOS assistidos — em qualquer um dos dois casos.
 * Concluída: todos os episódios oficiais do TMDB já foram vistos.
 * Assistindo: tem episódio pendente (viu alguma coisa, mas não tudo).
 *
 * "Pausada" não existe mais como possibilidade aqui — a investigação
 * do arquivo real (TASK-027A.1) não encontrou nenhuma fonte confiável
 * pra esse status no GDPR. Ver /docs/tvtime-gdpr-spec.md.
 *
 * TASK-027J — assinatura mudou de propósito: recebe `uniqueEpisodesSeen`
 * (já calculado por reconstructProgress.ts como
 * `min(totalWatchEvents, totalKnownEpisodes)`), nunca mais o objeto
 * `ParsedShow` inteiro nem o campo bruto do GDPR. Isso não é só
 * estética — é o que fisicamente impede esta função de acidentalmente
 * misturar "quantas vezes assistiu" com "estado da biblioteca" de
 * novo no futuro: ela nem enxerga o campo de estatística, só recebe o
 * número já correto pra decidir status.
 */
export function resolveStatus(
  uniqueEpisodesSeen: number,
  isExplicitlyForLater: boolean,
  totalKnownEpisodes: number | null
): ResolvedStatus {
  if (isExplicitlyForLater || uniqueEpisodesSeen === 0) {
    return "want_to_watch";
  }

  if (totalKnownEpisodes !== null && totalKnownEpisodes > 0 && uniqueEpisodesSeen >= totalKnownEpisodes) {
    return "completed";
  }

  return "watching";
}
