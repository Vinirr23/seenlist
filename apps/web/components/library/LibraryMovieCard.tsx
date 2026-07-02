import type { LibraryItem } from "@seenlist/types";
import { LibraryCard } from "./LibraryCard";

export function LibraryMovieCard({ item }: { item: LibraryItem }) {
  return <LibraryCard item={item} />;
}
