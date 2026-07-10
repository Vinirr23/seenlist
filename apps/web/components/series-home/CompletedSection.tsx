import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { MediaShelf } from "./MediaShelf";

export interface CompletedSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

/** TASK-022, item 4 — nova seção (a versão anterior já tinha "Concluídas", mantida/organizada aqui). */
export const CompletedSection = memo(function CompletedSection({ items, isLoading }: CompletedSectionProps) {
  return (
    <MediaShelf title="Concluídas" items={items} isLoading={isLoading} emptyMessage="Nenhuma série concluída ainda." />
  );
});
