export function HomeSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando sua biblioteca">
      <div className="mb-2 h-4 w-32 rounded bg-border" />
      <div className="flex gap-1.5 overflow-hidden pb-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="w-36 shrink-0 space-y-2">
            <div className="aspect-[2/3] w-full rounded-lg bg-surface" />
            <div className="h-3 w-3/4 rounded bg-border" />
            <div className="h-2.5 w-1/3 rounded bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
