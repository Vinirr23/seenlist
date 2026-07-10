"use client";

import { useState } from "react";
import { Image as ImageIcon, Search } from "lucide-react";
import NextImage from "next/image";
import type { ShowMatch } from "@/lib/tvtime-import/mapping/types";
import { tmdbImage } from "@/lib/tmdb/image";

interface SearchResult {
  mediaType: "movie" | "series";
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
}

export interface ManualMatchStepProps {
  /** Snapshot fixo, capturado uma vez ao entrar nesta etapa — nunca encolhe durante a resolução (ver nota abaixo). */
  pendingMatches: ShowMatch[];
  onComplete: (resolutions: Map<string, number | null>) => void;
}

/**
 * BUG CORRIGIDO (tela preta após a seleção manual): a versão
 * anterior chamava `onResolve` a cada série, que atualizava o
 * `matches` do componente pai imediatamente — e o pai recalculava
 * `pendingMatches` (`matches.filter(...)`) a cada render, encolhendo
 * esse array a cada resolução. Só que o `index` local aqui
 * continuava incrementando contra o tamanho ORIGINAL, então em
 * algum ponto `pendingMatches[index]` passava do fim do array
 * (agora menor) e virava `undefined` — `current` ficava `undefined`,
 * o componente retornava `null`, e a tela ficava preta. `isLast`
 * também ficava errado pelo mesmo motivo, então `onDone` às vezes
 * nem disparava.
 *
 * Correção: este componente recebe um snapshot que NUNCA muda
 * enquanto o usuário resolve as séries (o pai não mexe em `matches`
 * até o fim), guarda as escolhas num Map local, e só entrega tudo de
 * uma vez em `onComplete` — sem nenhum array encolhendo no meio do
 * caminho.
 */
export function ManualMatchStep({ pendingMatches, onComplete }: ManualMatchStepProps) {
  const [index, setIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Map<string, number | null>>(new Map());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const current = pendingMatches[index];
  const isLast = index === pendingMatches.length - 1;

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await response.json()) as { results: SearchResult[] };
      setResults(data.results.filter((result) => result.mediaType === "series"));
    } catch (error) {
      console.error("[tvtime-import] Falha na busca manual", error);
    } finally {
      setSearching(false);
    }
  }

  function advance(finalResolutions: Map<string, number | null>) {
    setQuery("");
    setResults([]);
    if (isLast) {
      onComplete(finalResolutions);
    } else {
      setIndex((value) => value + 1);
    }
  }

  function pick(tmdbId: number | null) {
    if (!current) return;
    const next = new Map(resolutions);
    next.set(current.show.tvTimeId, tmdbId);
    setResolutions(next);
    advance(next);
  }

  if (!current) return null;

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
        {index + 1} de {pendingMatches.length} séries precisam da sua ajuda
      </p>
      <h1 className="mb-4 text-xl font-bold text-text">{current.show.name}</h1>

      {current.candidates.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-muted">Encontramos estas opções, da mais provável pra menos provável:</p>
          {current.candidates.map((candidate) => (
            <button
              key={candidate.tmdbId}
              type="button"
              onClick={() => pick(candidate.tmdbId)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm text-text transition-transform active:scale-[0.98]"
            >
              <PosterThumb posterPath={candidate.posterPath} />
              <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
              <span className="shrink-0 text-xs text-muted">{candidate.year ?? "—"}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="mb-3 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar manualmente…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={searching}
          aria-label="Buscar"
          className="shrink-0 rounded-lg border border-border px-3 text-muted disabled:opacity-50"
        >
          <Search className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>

      {results.length > 0 && (
        <div className="mb-4 space-y-2">
          {results.slice(0, 8).map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => pick(result.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm text-text transition-transform active:scale-[0.98]"
            >
              <PosterThumb posterPath={result.posterPath} />
              <span className="min-w-0 flex-1 truncate">{result.title}</span>
              <span className="shrink-0 text-xs text-muted">{result.year ?? "—"}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => pick(null)}
        className="w-full rounded-lg border border-border py-2.5 text-sm text-muted transition-transform active:scale-[0.98]"
      >
        Pular esta série
      </button>
    </div>
  );
}

/**
 * "Primeiro canal (se disponível)" (item 5) ficou de fora de
 * propósito: mostrar isso exigiria buscar o detalhe completo de
 * CADA candidato (a busca em lista não traz emissora) — pra uma
 * tela que só aparece pras poucas séries realmente ambíguas, o
 * custo de N requisições extras não compensa o ganho.
 */
function PosterThumb({ posterPath }: { posterPath: string | null }) {
  const url = tmdbImage(posterPath, "w185");
  return (
    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-background">
      {url ? (
        <NextImage src={url} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted/40" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
