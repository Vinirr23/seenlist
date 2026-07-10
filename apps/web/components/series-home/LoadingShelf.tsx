/**
 * TASK-022, item 7: "não utilizar spinner... mostrar placeholders do
 * tamanho real dos cards". Dimensões batendo com `ShelfCard`
 * (compact: w-32/36/28, poster 2:3 + 2 linhas de texto).
 */
export function LoadingShelf({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-hidden pb-1" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-36 shrink-0 space-y-2 sm:w-40 md:w-44">
          <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
