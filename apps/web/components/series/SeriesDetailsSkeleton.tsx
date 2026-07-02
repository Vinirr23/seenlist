export function SeriesDetailsSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando série">
      <div className="h-56 w-full bg-surface" />
      <div className="-mt-16 flex gap-4 px-4">
        <div className="h-36 w-24 shrink-0 rounded-lg bg-border" />
        <div className="flex flex-1 flex-col justify-end gap-2 pb-1">
          <div className="h-4 w-2/3 rounded bg-border" />
          <div className="h-3 w-1/3 rounded bg-border" />
          <div className="h-3 w-1/2 rounded bg-border" />
        </div>
      </div>
      <div className="mt-6 space-y-3 px-4">
        <div className="h-3 w-full rounded bg-border" />
        <div className="h-3 w-5/6 rounded bg-border" />
        <div className="h-3 w-2/3 rounded bg-border" />
      </div>
    </div>
  );
}
