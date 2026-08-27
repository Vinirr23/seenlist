"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import { Clapperboard } from "lucide-react";
import type { DiscoverItem } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { AddToLibraryButton } from "./AddToLibraryButton";

export const DiscoverCard = memo(function DiscoverCard({ item }: { item: DiscoverItem }) {
  const posterUrl = tmdbImage(item.posterPath, "w342");
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;

  return (
    // Correção (a pedido — "deixa os cards um pouco maiores, deixa
    // eles mais juntos") — cresceu de novo, de `w-32` (128px) pra
    // `w-36` (144px); o espaçamento entre eles (gap) foi reduzido em
    // DiscoverCarousel.tsx (era gap-3, virou gap-2).
    <Link href={href} className="block w-36 shrink-0 rounded-lg shadow-md shadow-black/20 transition-transform active:scale-95">
      {/* "Vidro" (mesmo padrão dos cards de pôster do Perfil, ProfileMediaCarousel.tsx) — borda clara + blur/saturação + fundo com gradiente radial translúcido, em vez de `bg-surface` opaco. O pôster (quando carrega) cobre a textura por cima. */}
      <div
        className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
        style={{
          background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
        }}
      >
        {posterUrl ? (
          <Image src={posterUrl} alt="" fill sizes="144px" loading="lazy" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
          </div>
        )}
        <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} className="absolute right-1.5 top-1.5" />
      </div>
    </Link>
  );
});
