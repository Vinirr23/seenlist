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
 * A PEDIDO (correção 2, bug real reportado — "Rudeus Greyrat's
 * Former Self" caindo pro dublador) — o TMDB às vezes acrescenta um
 * qualificador no nome do personagem que o AniList/MyAnimeList não
 * usa ("'s Former Self", variações de idade/versão) — correspondência
 * EXATA nunca bate nesses casos. Achado só depois de ver rodando de
 * verdade — a correspondência POR PREFIXO (um nome sendo o começo
 * do outro) resolve isso sem abrir muito risco de casar personagem
 * errado (diferente de "contém em qualquer posição", que casaria
 * "Eris" com "Erisabeth" incorretamente, por exemplo).
 */
function findCharacterImage(imageByCharacterName: Map<string, string | null>, characterName: string): string | null | undefined {
  const normalized = normalizeCharacterName(characterName);
  const exact = imageByCharacterName.get(normalized);
  if (exact !== undefined) return exact;

  for (const [knownName, imageUrl] of imageByCharacterName) {
    if (knownName.length >= 4 && (normalized.startsWith(knownName) || knownName.startsWith(normalized))) return imageUrl;
  }
  return undefined;
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
    <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1">
      {cast.map((member) => {
        const characterImage = findCharacterImage(imageByCharacterName, member.character);
        /*
         * CORREÇÃO (bug real, reportado com print) — quando a série É
         * anime (achamos personagens), NUNCA cai pro dublador:
         * misturar foto de personagem animado com foto de dublador na
         * MESMA fileira é pior que um espaço vazio. Fora de anime, o
         * comportamento continua igual (foto do ator, que é o certo).
         */
        const isAnime = imageByCharacterName.size > 0;
        const photoUrl = isAnime ? characterImage : tmdbImage(member.profilePath, "w185");
        return (
          <div key={member.id} className="w-28 shrink-0">
            {/* "Vidro" (mesmo padrão de DiscoverCard.tsx) — A PEDIDO, cards maiores (mesma técnica de `aspect-[2/3]` do Explorar, em vez de altura fixa). */}
            <div
              className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
              style={{
                background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
              }}
            >
              {photoUrl ? (
                <Image src={photoUrl} alt={member.name} fill sizes="112px" className="object-cover" />
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
