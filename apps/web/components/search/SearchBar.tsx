"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@seenlist/ui";
import { useDebouncedValue } from "@seenlist/hooks";

const DEBOUNCE_MS = 400;

export interface SearchBarProps {
  onDebouncedChange: (value: string) => void;
}

export function SearchBar({ onDebouncedChange }: SearchBarProps) {
  const [value, setValue] = useState("");
  const debounced = useDebouncedValue(value, DEBOUNCE_MS);

  useEffect(() => {
    onDebouncedChange(debounced);
  }, [debounced, onDebouncedChange]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
      <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Pesquisar filmes e séries..."
        aria-label="Pesquisar filmes e séries"
        className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}
