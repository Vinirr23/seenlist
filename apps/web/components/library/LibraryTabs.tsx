"use client";

import { cn } from "@seenlist/utils";
import type { LibraryStatus } from "@seenlist/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const TAB_LABEL_KEYS: Record<LibraryStatus, string> = {
  watching: "library.tab.watching",
  want_to_watch: "library.tab.wantToWatch",
  completed: "library.tab.completed",
  up_to_date: "library.tab.upToDate",
  paused: "library.tab.paused",
};

const TAB_ORDER: LibraryStatus[] = [
  "watching",
  "want_to_watch",
  "up_to_date",
  "completed",
];

export function LibraryTabs({
  active,
  onChange,
}: {
  active: LibraryStatus;
  onChange: (tab: LibraryStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div role="tablist" className="flex gap-1 border-b border-border">
      {TAB_ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            active === tab
              ? "border-primary text-text"
              : "border-transparent text-muted"
          )}
        >
          {t(TAB_LABEL_KEYS[tab])}
        </button>
      ))}
    </div>
  );
}
