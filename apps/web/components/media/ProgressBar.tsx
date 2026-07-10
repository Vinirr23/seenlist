export function ProgressBar({ percentage, colorClass = "bg-primary" }: { percentage: number; colorClass?: string }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
