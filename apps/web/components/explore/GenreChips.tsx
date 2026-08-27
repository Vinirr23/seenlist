"use client";

import Link from "next/link";
import type { FavoriteGenre } from "@/lib/queries/favorite-genres";

/**
 * Fase C da reformulação da Explorar (2026-08-21) — "Seus gêneros
 * favoritos", uma fileira de chips clicáveis (mesmo "vidro neutro" da
 * aba inativa em `ExploreTabs.tsx`), cada um levando pra
 * `/explore/genre/[mediaType]/[genreId]` — a listagem completa
 * daquele gênero, só naquele tipo de mídia (filme ou série, conforme
 * a aba onde o chip está).
 *
 * CORREÇÃO (a pedido, reportado — "não aparece simultâneo com o
 * resto, aparece um pouco depois") — causa raiz: esta seção (e o
 * carrossel "Para você") dependem de MAIS chamadas de rede que as
 * outras (Biblioteca → resumos com gênero → mapa de gênero, em vez de
 * 1 chamada só), então demoram mais — e como antes não existia
 * NENHUM estado de carregamento aqui (só `null` até o dado chegar), o
 * conteúdo "pulava" pra dentro da tela e empurrava tudo abaixo pra
 * baixo, de repente. Com `isLoading`, a seção já entra com o mesmo
 * espaço reservado (esqueleto pulsante) desde o primeiro instante em
 * que já sabemos que ela VAI aparecer (`hasCompletedItems`, decidido
 * por quem chama este componente) — sem esqueleto nenhum enquanto
 * isso ainda não é sabido, então quem não vai ter a seção nunca vê um
 * "flash" dela.
 */
export function GenreChips({
  title,
  genres,
  isLoading,
  mediaType,
}: {
  title: string;
  genres: FavoriteGenre[];
  isLoading?: boolean;
  mediaType: "movie" | "series";
}) {
  if (!isLoading && genres.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 px-4 text-base font-bold text-text">{title}</h2>
      {isLoading ? (
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-surface" />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {genres.map((genre) => (
            <Link
              key={genre.genreId}
              href={`/explore/genre/${mediaType}/${genre.genreId}`}
              className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted backdrop-blur-[10px] backdrop-saturate-[160%] transition-colors"
              style={{
                background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
              }}
            >
              {genre.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
