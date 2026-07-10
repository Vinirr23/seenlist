export interface BigStatCardProps {
  title: string;
  value: string;
  subtext?: string;
  children?: React.ReactNode;
}

export function BigStatCard({ title, value, subtext, children }: BigStatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="text-2xl font-bold text-text">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-muted">{subtext}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
