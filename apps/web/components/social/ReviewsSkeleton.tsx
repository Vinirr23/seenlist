export function ReviewsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando avaliações">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-24 animate-pulse rounded bg-background" />
              <div className="h-3 w-10 animate-pulse rounded bg-background" />
            </div>
            <div className="h-3.5 w-20 animate-pulse rounded bg-background" />
          </div>
          <div className="h-3 w-full animate-pulse rounded bg-background" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-background" />
        </div>
      ))}
    </div>
  );
}
