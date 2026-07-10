import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { MediaShelf } from "./MediaShelf";

export interface PlanToWatchSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

export const PlanToWatchSection = memo(function PlanToWatchSection({ items, isLoading }: PlanToWatchSectionProps) {
  return <MediaShelf title="Assistir depois" items={items} isLoading={isLoading} emptyMessage="Sua lista está vazia." />;
});
