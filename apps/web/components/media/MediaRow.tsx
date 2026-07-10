import type { ReactNode } from "react";
import { SectionTitle } from "./SectionTitle";
import { MediaCard } from "./MediaCard";
import type { LibraryItem } from "@seenlist/types";

export interface MediaRowProps {
  title: string;
  items: LibraryItem[];
  cardSize?: "default" | "large";
  showMeta?: boolean;
  /** TASK-017: seção vazia continua visível, com uma mensagem — não soma mais como `return null`. */
  emptyState: ReactNode;
}

export function MediaRow({ title, items, cardSize = "default", showMeta = false, emptyState }: MediaRowProps) {
  return (
    <section className="mb-5">
      <SectionTitle>{title}</SectionTitle>
      {items.length === 0 ? (
        emptyState
      ) : (
        <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} size={cardSize} showMeta={showMeta} />
          ))}
        </div>
      )}
    </section>
  );
}
