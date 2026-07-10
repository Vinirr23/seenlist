import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { MediaShelf } from "./MediaShelf";

export interface WatchingSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

export const WatchingSection = memo(function WatchingSection({ items, isLoading }: WatchingSectionProps) {
  return <MediaShelf title="Assistindo" items={items} isLoading={isLoading} emptyMessage="Nenhuma série adicionada." />;
});
