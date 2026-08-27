import Image from "next/image";
import type { CastMember } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function CastCarousel({ cast }: { cast: CastMember[] }) {
  const { t } = useTranslation();
  if (cast.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1">
      {cast.map((member) => {
        const photoUrl = tmdbImage(member.profilePath, "w185");
        return (
          <div key={member.id} className="w-20 shrink-0 text-center">
            <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-surface">
              {photoUrl ? (
                <Image src={photoUrl} alt={member.name} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">
                  {t("episode.noPhoto")}
                </div>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-medium text-text">{member.name}</p>
            <p className="truncate text-[11px] text-muted">{member.character}</p>
          </div>
        );
      })}
    </div>
  );
}
