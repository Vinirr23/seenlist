import Image from "next/image";
import { Star } from "lucide-react";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2, página pública de título). NÃO é
 * `MovieHeader.tsx`/`SeriesHeader.tsx` reaproveitado — aqueles dois
 * embutem o botão "..." que abre `MovieQuickActionsSheet`/
 * `SeriesQuickActionsSheet` (ações de biblioteca, exigem login) e o
 * botão de voltar assume navegação dentro do app logado. Página
 * pública = só leitura; por isso um cabeçalho novo, mais simples, sem
 * nenhuma dessas duas coisas — mesmo visual de "vidro"/gradiente do
 * resto do app, só sem interatividade que não faz sentido aqui.
 *
 * Componente de SERVIDOR de propósito (sem "use client") — nada aqui
 * usa estado/hook, então faz parte do HTML inicial sem depender de
 * hidratação no navegador.
 */
export function TitleHeader({
  title,
  originalTitle,
  backdropPath,
  posterPath,
  year,
  metaLine,
  genres,
  voteAverage,
}: {
  title: string;
  originalTitle?: string | null;
  backdropPath: string | null;
  posterPath: string | null;
  year: string | null;
  /** Já formatado por quem chama — "120 min" (filme) ou "3 temporadas" (série) — pra este componente não precisar saber a diferença entre os dois. */
  metaLine?: string | null;
  genres: string[];
  voteAverage: number;
}) {
  const backdropUrl = tmdbImage(backdropPath, "w1280");
  const posterUrl = tmdbImage(posterPath, "w342");

  return (
    <div className="relative">
      <div className="relative h-56 w-full bg-surface">
        {backdropUrl && <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
      </div>

      <div className="relative -mt-16 flex gap-4 px-4">
        <div
          className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-lg backdrop-blur-[14px] backdrop-saturate-[180%]"
          style={{
            background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
          }}
        >
          {posterUrl && <Image src={posterUrl} alt={title} fill sizes="96px" className="object-cover" />}
        </div>

        <div className="flex flex-1 flex-col justify-end gap-1 pb-1">
          <h1 className="text-lg font-semibold leading-tight text-text">{title}</h1>
          {originalTitle && originalTitle !== title && <p className="text-xs text-muted">{originalTitle}</p>}
          <p className="text-xs text-muted">{[year, metaLine].filter(Boolean).join(" · ")}</p>
          {genres.length > 0 && <p className="text-xs text-muted">{genres.join(", ")}</p>}
          {voteAverage > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-primary">
              <Star className="h-3.5 w-3.5 fill-primary" />
              {voteAverage.toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
