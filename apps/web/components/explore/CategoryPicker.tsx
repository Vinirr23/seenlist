"use client";

import { cn } from "@seenlist/utils";
import { FEED_CATEGORIES, type FeedCategoryKey } from "@/lib/queries/feed-categories";

export interface CategoryPickerProps {
  selected: FeedCategoryKey[];
  onToggle: (key: FeedCategoryKey) => void;
}

export function CategoryPicker({ selected, onToggle }: CategoryPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FEED_CATEGORIES.map((category) => {
        const isSelected = selected.includes(category.key);
        return (
          <button
            key={category.key}
            type="button"
            onClick={() => onToggle(category.key)}
            aria-pressed={isSelected}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isSelected ? "border-primary bg-primary text-background" : "border-border bg-surface text-text"
            )}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
