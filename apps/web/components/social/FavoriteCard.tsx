import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

export function FavoriteCard({ item }: { item: LibraryItem }) {
  const posterUrl = tmdbImage(item.posterPath, "w342");
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;

  return (
    <Link href={href} className="block w-36 shrink-0 snap-start sm:w-40">
      {/* "Vidro" (redesign âmbar/vidro, perfil público, 2026-08-26) — mesmo padrão de borda clara + blur/saturação + gradiente radial translúcido dos outros cards de pôster do app (PosterGrid.tsx/ProfileMediaCarousel.tsx), em vez de `bg-surface` opaco. */}
      <div
        className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
        style={{
          background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
        }}
      >
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill sizes="160px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Clapperboard className="h-8 w-8 text-muted/40" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-text">{item.title}</p>
      <p className="text-xs text-muted">{item.year ?? "—"}</p>
    </Link>
  );
}
