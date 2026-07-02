const PLACEHOLDER_COUNT = 6;

export function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando resultados">
      {Array.from({ length: PLACEHOLDER_COUNT }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse gap-3 rounded-lg border border-border bg-surface p-2"
        >
          <div className="h-24 w-16 shrink-0 rounded-md bg-border" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className="h-3 w-12 rounded bg-border" />
            <div className="h-3.5 w-3/4 rounded bg-border" />
            <div className="h-3 w-10 rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
