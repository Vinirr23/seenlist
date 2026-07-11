"use client";

import Image from "next/image";
import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";

export interface FavoriteCharacterOption {
  id: number;
  name: string;
  imageUrl: string | null;
}

/**
 * TASK-067 — "Quem foi seu personagem favorito?".
 *
 * Versão 2 — a lista agora pode vir de duas fontes diferentes, mas
 * este componente não sabe (nem precisa saber) qual: quem chama
 * (`EpisodeDetailView`) já decide isso antes e entrega uma lista no
 * mesmo formato — `imageUrl` pronto pra usar, já resolvido pra URL
 * completa (não é mais `profilePath` do TMDB cru).
 * - Anime com correspondência no MyAnimeList (via Jikan,
 *   `lib/anime/jikan.ts`): ilustração de verdade do personagem.
 * - Sem correspondência (a maioria dos filmes/séries não-anime, ou
 *   anime que o Jikan não achou): elenco do TMDB — nesse caso a
 *   imagem é do ator/dublador real, não tem jeito de evitar sem
 *   trocar de fonte de dado (é a mesma limitação de antes).
 */
export function EpisodeFavoriteCharacterPicker({
  characters,
  selectedId,
  onSelect,
}: {
  characters: FavoriteCharacterOption[];
  selectedId: number | null;
  onSelect: (character: FavoriteCharacterOption | null) => void;
}) {
  if (characters.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {characters.map((character) => {
        const selected = selectedId === character.id;
        return (
          <button
            key={character.id}
            type="button"
            onClick={() => {
              hapticTick();
              onSelect(selected ? null : character);
            }}
            className="w-20 shrink-0 text-center"
          >
            <div
              className={cn(
                "relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-surface ring-2 transition-colors",
                selected ? "ring-primary" : "ring-transparent"
              )}
            >
              {character.imageUrl ? (
                <Image src={character.imageUrl} alt={character.name} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">Sem foto</div>
              )}
            </div>
            <p className={cn("mt-1.5 truncate text-xs font-medium", selected ? "text-primary" : "text-text")}>
              {character.name}
            </p>
          </button>
        );
      })}
    </div>
  );
}
