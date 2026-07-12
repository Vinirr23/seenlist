"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Clock } from "lucide-react";
import { Input } from "@seenlist/ui";
import { useDebouncedValue } from "@seenlist/hooks";

const DEBOUNCE_MS = 400;
const HISTORY_KEY = "seenlist:search-history";
const HISTORY_LIMIT = 8;

export interface SearchBarProps {
  onDebouncedChange: (value: string) => void;
}

function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/** TASK-080 — adiciona um termo no topo do histórico (mais recente primeiro), sem duplicar (ignora maiúscula/minúscula — "Duna" e "duna" contam como o mesmo termo, mantém a grafia da pesquisa mais recente), no máximo 8. */
function addToHistory(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return readHistory();
  const current = readHistory().filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...current].slice(0, HISTORY_LIMIT);
  writeHistory(next);
  return next;
}

/**
 * TASK-080 — histórico de pesquisa: as últimas 8 buscas (por
 * aparelho, `localStorage` — não precisa de conta nem sincronizar
 * entre aparelhos pra uma conveniência assim). Aparece como uma
 * lista logo abaixo da barra quando ela está em foco e vazia — some
 * assim que a pessoa começa a digitar (mesma hora que os resultados
 * de busca de verdade tomam conta da tela). Cada item tem um "×"
 * pra apagar só aquele termo, sem mexer no resto do histórico.
 *
 * `onMouseDown` (não `onClick`) nos itens da lista: dispara ANTES do
 * `onBlur` do campo de texto — sem isso, o campo perderia o foco (e
 * a lista fecharia) antes do clique no item ser processado.
 */
export function SearchBar({ onDebouncedChange }: SearchBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const debounced = useDebouncedValue(value, DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    onDebouncedChange(debounced);
    if (debounced.trim()) setHistory(addToHistory(debounced));
  }, [debounced, onDebouncedChange]);

  function handleClear() {
    // Não espera o debounce de 400ms — "ao limpar, voltar imediatamente ao estado inicial".
    setValue("");
    onDebouncedChange("");
    inputRef.current?.focus();
  }

  function handleSelectHistoryTerm(term: string) {
    setValue(term);
    inputRef.current?.focus();
  }

  function handleRemoveHistoryTerm(term: string) {
    const next = readHistory().filter((t) => t !== term);
    writeHistory(next);
    setHistory(next);
  }

  const showHistory = focused && !value && history.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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

      {showHistory && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <p className="px-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Pesquisas recentes</p>
          {history.map((term) => (
            <div key={term} className="flex items-center gap-2 px-3 py-2 hover:bg-background">
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={2} />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectHistoryTerm(term);
                }}
                className="min-w-0 flex-1 truncate text-left text-sm text-text"
              >
                {term}
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleRemoveHistoryTerm(term);
                }}
                aria-label={`Remover "${term}" do histórico`}
                className="shrink-0 p-0.5 text-muted hover:text-text"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
