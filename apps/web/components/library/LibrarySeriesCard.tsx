import type { LibraryItem } from "@seenlist/types";
import { LibraryCard } from "./LibraryCard";
import { ProgressBar } from "../media/ProgressBar";

export function LibrarySeriesCard({ item }: { item: LibraryItem }) {
  const watched = item.progress?.watchedEpisodes ?? 0;
  const total = item.progress?.totalEpisodes ?? 0;
  const percentage = total > 0 ? Math.round((watched / total) * 100) : 0;

  return (
    <LibraryCard item={item}>
      <div className="space-y-1">
        <ProgressBar percentage={percentage} />
        <p className="text-[11px] text-muted">
          {watched} / {total} episódios
        </p>
      </div>
    </LibraryCard>
  );
}
