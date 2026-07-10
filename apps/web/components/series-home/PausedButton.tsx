import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PausedButton() {
  return (
    <Link
      href="/series/paused"
      className="mb-2 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-4 text-sm font-semibold text-text transition-colors hover:border-primary/50"
    >
      Ver todas as séries interrompidas
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
    </Link>
  );
}
