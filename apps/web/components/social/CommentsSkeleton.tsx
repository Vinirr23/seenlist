export function CommentsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando comentários">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-28 animate-pulse rounded bg-surface" />
            <div className="h-3 w-10 animate-pulse rounded bg-surface" />
          </div>
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
