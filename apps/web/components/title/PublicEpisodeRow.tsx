import Image from "next/image";
import { tmdbImage } from "@/lib/tmdb/image";
import type { PublicSeasonEpisode } from "@/lib/tmdb/client";

/**
 * A PEDIDO (2026-10-09 — redesign das páginas públicas, item 5). NÃO é
 * `EpisodeCard.tsx` reaproveitado — aquele exige sessão (botão de
 * assistido, link pra `/series/[id]/season/.../episode/...`, rota que
 * pede login). Este é só leitura, de propósito: imagem, número,
 * título, data e sinopse curta quando disponível — nenhuma parte da
 * linha é clicável, decisão explícita do usuário ("não direcionar
 * visitantes para rotas privadas").
 */
export function PublicEpisodeRow({ episode }: { episode: PublicSeasonEpisode }) {
  const stillUrl = tmdbImage(episode.stillPath, "w300");

  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-surface/40 p-2.5">
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-background">
        {stillUrl ? (
          <Image src={stillUrl} alt="" fill sizes="112px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">Sem imagem</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Episódio {episode.episodeNumber}</p>
        <p className="truncate text-sm font-medium text-text">{episode.name}</p>
        {episode.airDate && <p className="mt-0.5 text-xs text-muted">{episode.airDate}</p>}
        {episode.overview && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{episode.overview}</p>}
      </div>
    </div>
  );
}
