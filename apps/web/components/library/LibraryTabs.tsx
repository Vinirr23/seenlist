import { cn } from "@seenlist/utils";
import type { LibraryStatus } from "@seenlist/types";

const TAB_LABELS: Record<LibraryStatus, string> = {
  watching: "Assistindo",
  want_to_watch: "Quero assistir",
  completed: "Concluído",
};

const TAB_ORDER: LibraryStatus[] = ["watching", "want_to_watch", "completed"];

export function LibraryTabs({
  active,
  onChange,
}: {
  active: LibraryStatus;
  onChange: (tab: LibraryStatus) => void;
}) {
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
            active === tab ? "border-primary text-text" : "border-transparent text-muted"
          )}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
