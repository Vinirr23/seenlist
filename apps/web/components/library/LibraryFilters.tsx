import { cn } from "@seenlist/utils";

export type LibraryTypeFilter = "all" | "movie" | "series";
export type LibrarySort = "updated" | "name" | "added";

const TYPE_LABELS: Record<LibraryTypeFilter, string> = {
  all: "Todos",
  movie: "Filmes",
  series: "Séries",
};

const SORT_LABELS: Record<LibrarySort, string> = {
  updated: "Atualizados recentemente",
  name: "Nome",
  added: "Data adicionada",
};

export interface LibraryFiltersProps {
  typeFilter: LibraryTypeFilter;
  onTypeFilterChange: (filter: LibraryTypeFilter) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
}

export function LibraryFilters({
  typeFilter,
  onTypeFilterChange,
  sort,
  onSortChange,
}: LibraryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2">
        {(Object.keys(TYPE_LABELS) as LibraryTypeFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onTypeFilterChange(filter)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              typeFilter === filter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-text"
            )}
          >
            {TYPE_LABELS[filter]}
          </button>
        ))}
      </div>

      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as LibrarySort)}
        aria-label="Ordenar biblioteca"
        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text focus:outline-none"
      >
        {(Object.keys(SORT_LABELS) as LibrarySort[]).map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
