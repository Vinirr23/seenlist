import Image from "next/image";
import type { CastMember } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — refinamento da aba Sobre (série): "cada card deve
 * priorizar foto, nome do PERSONAGEM, nome do ator menor abaixo" —
 * inverte a hierarquia de antes (ator em destaque, personagem
 * pequeno). Foto retangular (não mais círculo) — mesma quantidade
 * de gente exibida, só design melhorado, como pedido.
 */
export function CastCarousel({ cast }: { cast: CastMember[] }) {
  const { t } = useTranslation();
  if (cast.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {cast.map((member) => {
        const photoUrl = tmdbImage(member.profilePath, "w185");
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
