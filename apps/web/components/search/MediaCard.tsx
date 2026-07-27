import Link from "next/link";
import Image from "next/image";
import { Card, Badge } from "@seenlist/ui";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { translateMediaType } from "@/lib/i18n/mediaTypeLabels";

export function MediaCard({ item }: { item: MediaSearchResult }) {
  // TASK-006 definiu a rota real de filme como /movies/[id] (plural,
  // igual à aba). TASK-004 tinha usado /movie/[id] (singular) —
  // corrigido aqui pra bater com a rota que de fato existe agora.
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
  const posterUrl = tmdbImage(item.posterPath, "w342");
  const { t } = useTranslation();

  return (
    <Link href={href}>
      <Card className="flex gap-3 rounded-lg border border-border bg-surface p-2 transition-colors hover:bg-surface/70">
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-background">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted">
              {t("media.noPoster")}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-1">
          <Badge className="w-fit rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            {translateMediaType(item.mediaType, t)}
          </Badge>
          <p className="truncate text-sm font-medium text-text">{item.title}</p>
          {item.year && <p className="text-xs text-muted">{item.year}</p>}
        </div>
      </Card>
    </Link>
  );
}
