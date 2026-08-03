import Image from "next/image";
import type { CastMember } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useAnimeCharacters } from "@/lib/queries/anime-characters";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** Minúsculas, sem acento, sem "(voice)"/pontuação — só pra COMPARAR, nunca pra exibir. */
function normalizeCharacterName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(voice\)/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .trim();
}

/**
 * A PEDIDO (correção real, confirmada pelo usuário) — "no
 * personagem favorito mostra o personagem, em Sobre mostra o
 * dublador". A causa: `CastMember.profilePath` vem direto do
 * `credits.cast` do TMDB, que só tem foto do ATOR/dublador — TMDB
 * não expõe "foto do personagem" pra ninguém. O picker de
 * "personagem favorito" (`EpisodeFavoriteCharacterPicker`, não
 * mexido aqui) já resolve isso com outra fonte
 * (AniList/MyAnimeList, via `useAnimeCharacters` — tem ilustração de
 * personagem de verdade, não foto de dublador) — só nunca tinha
 * sido conectado aqui também.
 *
 * Correspondência por NOME normalizado, EXATA (não parcial/fuzzy) —
 * de propósito: mostrar a foto do personagem ERRADO seria pior que
 * só cair pro dublador. Sem correspondência = cai pro
 * `profilePath` de sempre (dublador), sem quebrar nada.
 */
export function CastCarousel({ cast, title, year }: { cast: CastMember[]; title?: string; year?: number | null }) {
  const { t } = useTranslation();
  const { data: animeCharacters } = useAnimeCharacters(title, year ?? null);
  if (cast.length === 0) return null;

  const imageByCharacterName = new Map((animeCharacters?.characters ?? []).map((c) => [normalizeCharacterName(c.name), c.imageUrl]));

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {cast.map((member) => {
        const characterImage = imageByCharacterName.get(normalizeCharacterName(member.character));
        const photoUrl = characterImage ?? tmdbImage(member.profilePath, "w185");
        return (
          <div key={member.id} className="w-24 shrink-0">
            <div className="relative h-32 w-24 overflow-hidden rounded-xl bg-surface">
              {photoUrl ? (
                <Image src={photoUrl} alt={member.name} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[10px] text-muted">{t("episode.noPhoto")}</div>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold text-text">{member.character}</p>
            <p className="truncate text-[11px] text-muted">{member.name}</p>
          </div>
        );
      })}
    </div>
  );
}
