"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SeasonSummary } from "@seenlist/types";
import type { PublicSeasonDetails } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { PublicEpisodeRow } from "./PublicEpisodeRow";

/**
 * A PEDIDO (2026-10-09 — redesign das páginas públicas, item 5:
 * "temporadas e episódios — somente séries", com o ajuste pedido pelo
 * usuário depois da auditoria: "permitir que o visitante explore as
 * temporadas... sem exigir login", "evitar carregar todas as
 * temporadas antecipadamente"). "Use client" de propósito — é o único
 * jeito de trocar de temporada sem recarregar a página inteira; tudo
 * mais na ficha pública continua Server Component.
 *
 * Estratégia de carregamento: a temporada mais relevante
 * (`initialSeasonNumber`, decidida no servidor — ver `page.tsx` de
 * série) já chega PRONTA via `initialSeasonDetails` (zero requisição
 * extra no primeiro render). Trocar de aba busca só aquela temporada,
 * uma vez (`/api/tmdb/series/[id]/season/[season]`, rota nova,
 * pública), e guarda em cache local (`seasonCache`) — voltar pra uma
 * aba já vista não refaz a requisição. Nenhum link de episódio aponta
 * pra rota privada (decisão do usuário) — o único link clicável desta
 * seção é o CTA discreto no fim, pro app.
 */
export function PublicSeasonExplorer({
  seriesId,
  seasons,
  initialSeasonNumber,
  initialSeasonDetails,
  appHref,
}: {
  seriesId: number;
  seasons: SeasonSummary[];
  initialSeasonNumber: number;
  initialSeasonDetails: PublicSeasonDetails;
  appHref: string;
}) {
  const [selectedSeason, setSelectedSeason] = useState(initialSeasonNumber);
  const [seasonCache, setSeasonCache] = useState<Record<number, PublicSeasonDetails>>({
    [initialSeasonNumber]: initialSeasonDetails,
  });
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [failedSeason, setFailedSeason] = useState<number | null>(null);

  if (seasons.length === 0) return null;

  const current = seasonCache[selectedSeason];

  async function loadSeason(seasonNumber: number) {
    setSelectedSeason(seasonNumber);
    if (seasonCache[seasonNumber]) return;

    setFailedSeason(null);
    setLoadingSeason(seasonNumber);
    try {
      const response = await fetch(`/api/tmdb/series/${seriesId}/season/${seasonNumber}`);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data: PublicSeasonDetails = await response.json();
      setSeasonCache((prev) => ({ ...prev, [seasonNumber]: data }));
    } catch (error) {
      console.error(`[PublicSeasonExplorer] Falha ao carregar temporada ${seasonNumber}`, error);
      setFailedSeason(seasonNumber);
    } finally {
      setLoadingSeason(null);
    }
  }

  const posterUrl = current ? tmdbImage(current.posterPath, "w342") : null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-text">Temporadas</h2>

      <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
        {seasons.map((season) => {
          const isActive = season.seasonNumber === selectedSeason;
          return (
            <button
              key={season.seasonNumber}
              type="button"
              onClick={() => loadSeason(season.seasonNumber)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-surface/40 text-muted hover:text-text"
              }`}
            >
              {season.name}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {loadingSeason === selectedSeason && !current && <p className="text-sm text-muted">Carregando temporada…</p>}

        {failedSeason === selectedSeason && (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-surface/40 p-3 text-sm text-muted">
            <span>Não foi possível carregar esta temporada agora.</span>
            <button type="button" onClick={() => loadSeason(selectedSeason)} className="font-semibold text-primary">
              Tentar de novo
            </button>
          </div>
        )}

        {current && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              {posterUrl && (
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10">
                  <Image src={posterUrl} alt="" fill sizes="80px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{current.name}</p>
                <p className="text-xs text-muted">
                  {[current.airDate?.slice(0, 4), `${current.episodes.length} ${current.episodes.length === 1 ? "episódio" : "episódios"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {current.overview && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{current.overview}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {current.episodes.map((episode) => (
                <PublicEpisodeRow key={episode.id} episode={episode} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Link
        href={appHref}
        className="mt-4 inline-block text-xs font-medium text-muted underline-offset-2 hover:text-primary hover:underline"
      >
        Acompanhar episódios assistidos no app SeenList
      </Link>
    </section>
  );
}
