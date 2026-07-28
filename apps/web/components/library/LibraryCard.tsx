"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useMoveLibraryItem, useRemoveLibraryItem } from "@/lib/queries/library";
import { InlineError } from "../media/InlineError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { translateMediaType } from "@/lib/i18n/mediaTypeLabels";

export function LibraryCard({
  item,
  children,
}: {
  item: LibraryItem;
  children?: React.ReactNode;
}) {
  const move = useMoveLibraryItem();
  const remove = useRemoveLibraryItem();
  const { t, locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });

  const STATUS_LABEL: Record<LibraryStatus, string> = {
    watching: t("media.status.watching"),
    want_to_watch: t("library.tab.wantToWatch"),
    completed: t("media.status.completed"),
    up_to_date: t("media.status.upToDate"),
    paused: t("media.status.paused"),
  };

  const posterUrl = tmdbImage(item.posterPath, "w185");
  const href =
    item.mediaType === "movie"
      ? `/movies/${item.id}`
      : `/series/${item.id}`;

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface p-2">
      <Link
        href={href}
        className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-background"
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">
            {t("media.noPoster")}
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <Link
          href={href}
          className="truncate text-sm font-medium text-text"
        >
          {item.title}
        </Link>

        <p className="text-xs text-muted">
          {[translateMediaType(item.mediaType, t), item.year]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {children}

        <p className="text-[11px] text-muted">
          {t("library.updatedOn", { date: dateFormatter.format(new Date(item.updatedAt)) })}
        </p>

        <InlineError show={move.isError || remove.isError} />
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            remove.mutate({
              mediaType: item.mediaType,
              id: item.id,
            })
          }
          disabled={remove.isPending}
          aria-label={t("library.removeFromList")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-background hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>

        <select
          value={item.status}
          onChange={(event) =>
            move.mutate({
              mediaType: item.mediaType,
              id: item.id,
              status: event.target.value as LibraryStatus,
            })
          }
          disabled={move.isPending}
          aria-label={t("library.moveTo")}
          className="rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] text-text disabled:opacity-50"
        >
          {(Object.keys(STATUS_LABEL) as LibraryStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}