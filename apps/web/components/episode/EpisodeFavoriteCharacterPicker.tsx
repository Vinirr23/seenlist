"use client";

import Image from "next/image";
import type { CastMember } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";

/**
 * TASK-067 — "Quem foi seu personagem favorito?". Reaproveita
 * `series.cast` (já vem de `useSeriesDetails`, mesma consulta que
 * `CastCarousel` usa na aba Sobre) — sem chamada nova ao TMDB. Não
 * são os "guest stars" específicos deste episódio (o TMDB só
 * devolve isso por uma consulta separada por episódio); é o elenco
 * principal da série, que é o que aparece nas capturas de
 * referência (Rick, Morty, Jerry, Summer...).
 */
export function EpisodeFavoriteCharacterPicker({
  cast,
  selectedId,
  onSelect,
}: {
  cast: CastMember[];
  selectedId: number | null;
  onSelect: (member: CastMember | null) => void;
}) {
  if (cast.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {cast.map((member) => {
        const photoUrl = tmdbImage(member.profilePath, "w185");
        const selected = selectedId === member.id;
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => {
              hapticTick();
              onSelect(selected ? null : member);
            }}
            className="w-20 shrink-0 text-center"
          >
            <div
              className={cn(
                "relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-surface ring-2 transition-colors",
                selected ? "ring-primary" : "ring-transparent"
              )}
            >
              {photoUrl ? (
                <Image src={photoUrl} alt={member.name} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">Sem foto</div>
              )}
            </div>
            <p className={cn("mt-1.5 truncate text-xs font-medium", selected ? "text-primary" : "text-text")}>
              {member.name}
            </p>
          </button>
        );
      })}
    </div>
  );
}
