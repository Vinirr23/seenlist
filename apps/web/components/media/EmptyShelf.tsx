import Link from "next/link";

export interface EmptyShelfProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * TASK-022, item 5 — "card elegante", nunca deixa a seção em branco.
 *
 * UNIFICAÇÃO (achado real, auditoria de UX) — existia um segundo
 * componente (`HomeEmptyState.tsx`) fazendo exatamente a mesma
 * coisa (mesmas props, mesmo botão de ação), só que com um visual
 * diferente (borda sólida em vez de tracejada, cantos menos
 * arredondados, sem opacidade no fundo) — resultado: trocar de aba
 * "Minha Lista" pra "Em breve" na Central de Séries mudava o estilo
 * do card vazio no meio do caminho, sem motivo. Movido pra `media/`
 * (mesmo raciocínio de `HomeTabs.tsx` — vira o componente
 * compartilhado entre Séries e Filmes) e todo mundo que usava
 * `HomeEmptyState` passou a usar este.
 */
export function EmptyShelf({ message, actionLabel, actionHref }: EmptyShelfProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
      <p className="text-sm text-muted">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
