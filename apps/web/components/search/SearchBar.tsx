"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@seenlist/ui";
import { useDebouncedValue } from "@seenlist/hooks";

const DEBOUNCE_MS = 400;

export interface SearchBarProps {
  onDebouncedChange: (value: string) => void;
}

export function SearchBar({ onDebouncedChange }: SearchBarProps) {
  const [value, setValue] = useState("");
  const debounced = useDebouncedValue(value, DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onDebouncedChange(debounced);
  }, [debounced, onDebouncedChange]);

  // Item 9: cursor já no campo ao abrir Explorar.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleClear() {
    // Não espera o debounce de 400ms — "ao limpar, voltar imediatamente ao estado inicial".
    setValue("");
    onDebouncedChange("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
      <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Pesquisar filmes e séries..."
        aria-label="Pesquisar filmes e séries"
        className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
      />
      {value && (
        <button type="button" onClick={handleClear} aria-label="Limpar pesquisa" className="shrink-0 text-muted hover:text-text">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
