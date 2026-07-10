import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * TASK-023 (ajuste), item 3: em vez de mostrar todos os pôsteres de
 * "Assistir depois" na Home, um botão único que leva pra tela
 * dedicada (`/series/watchlist`).
 */
export function WatchlistButton() {
  return (
    <Link
      href="/series/watchlist"
      className="mb-2 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-4 text-sm font-semibold text-text transition-colors hover:border-primary/50"
    >
      Ver todas as séries da lista &quot;Assistir Depois&quot;
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
    </Link>
  );
}
