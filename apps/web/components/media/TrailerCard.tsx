"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — refinamento da aba Sobre (série), item 7: "card
 * horizontal antes do elenco, thumbnail grande, botão de play, sem
 * autoplay". A miniatura do YouTube (`img.youtube.com`) não precisa
 * de nenhuma chamada nova — é só montar a URL a partir da chave do
 * vídeo, que já vem do TMDB. "Sem autoplay" quer dizer: o vídeo só
 * toca depois do toque explícito da pessoa — antes disso é só uma
 * imagem estática com um botão, igual o resto do app.
 */
export function TrailerCard({ videoKey }: { videoKey: string }) {
  const [playing, setPlaying] = useState(false);
  const { t } = useTranslation();
  const thumbnailUrl = `https://img.youtube.com/vi/${videoKey}/hqdefault.jpg`;

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
          title={t("series.trailer")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    // "Vidro" (mesmo padrão de DiscoverCard.tsx)
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="relative block aspect-video w-full overflow-hidden rounded-xl border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
      style={{
        background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
      }}
      aria-label={t("series.playTrailer")}
    >
      <Image src={thumbnailUrl} alt="" fill sizes="400px" className="object-cover" unoptimized />
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
          <Play className="ml-0.5 h-6 w-6 fill-background text-background" strokeWidth={0} />
        </div>
      </div>
    </button>
  );
}
