import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

function hrefFor(item: MediaSearchResult): string {
  return item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
}

/**
 * A PEDIDO — refinamento da aba Sobre (série): "além do pôster,
 * mostrar nota e ano — não adicionar muito texto". `voteAverage` é
 * opcional no tipo — só aparece quando o chamador já tiver esse dado
 * (série já tem; se filme não tiver ainda, cai graciosamente sem a
 * nota, sem quebrar nada).
 */
export function SimilarTitlesCarousel({ items }: { items: MediaSearchResult[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map((item) => {
        const posterUrl = tmdbImage(item.posterPath, "w185");
        return (
          <Link key={item.id} href={hrefFor(item)} className="w-28 shrink-0">
            <div className="relative h-40 w-28 overflow-hidden rounded-lg bg-surface">
              {posterUrl ? (
                <Image src={posterUrl} alt={item.title} fill sizes="112px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">{t("media.noPoster")}</div>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-medium text-text">{item.title}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted">
              {item.voteAverage != null && item.voteAverage > 0 && (
                <span className="flex items-center gap-0.5 text-primary">
                  <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
                  {item.voteAverage.toFixed(1)}
                </span>
              )}
              {item.voteAverage != null && item.voteAverage > 0 && item.year && "·"}
              {item.year}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
