import Link from "next/link";

export interface HomeEmptyStateProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export function HomeEmptyState({ message, actionLabel, actionHref }: HomeEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-4 py-8 text-center">
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
