import { SectionTitle } from "../media/SectionTitle";
import { ShelfCard } from "./ShelfCard";
import { LoadingShelf } from "./LoadingShelf";
import { EmptyShelf } from "./EmptyShelf";
import type { LibraryItem } from "@seenlist/types";

export interface MediaShelfProps {
  title: string;
  items: LibraryItem[];
  isLoading?: boolean;
  variant?: "continue" | "compact";
  emptyMessage: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

/**
 * TASK-022, item 11: scroll horizontal suave, com snap, sem
 * scrollbar visível. `ShelfHeader` do enunciado é a `SectionTitle`
 * já existente (`components/media/`) — reaproveitada sem alteração
 * nenhuma, não precisava de uma versão nova só pra um rótulo de texto.
 */
export function MediaShelf({
  title,
  items,
  isLoading = false,
  variant = "compact",
  emptyMessage,
  emptyActionLabel,
  emptyActionHref,
}: MediaShelfProps) {
  return (
    <section className="mb-6">
      <SectionTitle>{title}</SectionTitle>

      {isLoading ? (
        <LoadingShelf />
      ) : items.length === 0 ? (
        <EmptyShelf message={emptyMessage} actionLabel={emptyActionLabel} actionHref={emptyActionHref} />
      ) : (
        <div
          className={
            "-mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-2 pb-1 " +
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          }
        >
          {items.map((item) => (
            <ShelfCard key={item.id} item={item} variant={variant} />
          ))}
        </div>
      )}
    </section>
  );
}
