import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtext?: string;
}

/** Raio 16px (`rounded-2xl`), padding 16px (`p-4`), largura fixa — exatamente como pedido. */
export function StatCard({ icon: Icon, title, value, subtext }: StatCardProps) {
  return (
    <div className="w-40 shrink-0 snap-start rounded-2xl border border-border bg-surface p-4">
      <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
      <p className="mt-3 text-xl font-bold leading-tight text-text">{value}</p>
      {subtext && <p className="text-xs text-muted">{subtext}</p>}
      <p className="mt-2 text-xs text-muted">{title}</p>
    </div>
  );
}
