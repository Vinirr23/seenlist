import Link from "next/link";

export interface EmptyShelfProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

/** TASK-022, item 5 — "card elegante", nunca deixa a seção em branco. */
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
