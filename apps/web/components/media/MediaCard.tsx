import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@seenlist/utils";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { ProgressBar } from "./ProgressBar";

export interface MediaCardProps {
  item: LibraryItem;
  size?: "default" | "large";
  /** TASK-020, item 3: mostrar status + última atualização no card. Opcional pra não forçar isso em telas que já não mostravam (ex.: "Continue assistindo" de séries, que já comunica isso pela barra de progresso). */
  showMeta?: boolean;
}

const STATUS_LABEL: Record<LibraryStatus, string> = {
  watching: "Assistindo",
  want_to_watch: "Assistir depois",
  completed: "Concluído",
  paused: "Pausada",
  up_to_date: "Em dia",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-017: pôster real do TMDB. TASK-020: generalizado pra filme e
 * série — o link pra detalhes era fixo em `/series/${id}` antes
 * (bug real, encontrado ao reaproveitar este componente pra filmes;
 * corrigido aqui), agora usa `item.mediaType`. Também ganhou
 * status + data da última atualização (item 3 do TASK-020),
 * mostrados só quando `showMeta` é passado.
 */
export function MediaCard({ item, size = "default", showMeta = false }: MediaCardProps) {
  const posterUrl = tmdbImage(item.posterPath, "w342");
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "group block shrink-0",
        size === "large" ? "w-44 sm:w-48 md:w-52" : "w-36 sm:w-40 md:w-44"
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface transition-transform duration-200 ease-out group-hover:-translate-y-1">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            sizes="(min-width: 768px) 208px, 176px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface to-background">
            <Clapperboard className="h-8 w-8 text-muted/40" strokeWidth={1.5} />
          </div>
        )}

        {/* Barra de progresso sobreposta na base do pôster, igual ao TV Time — só séries têm `progress`. */}
        {item.progress && item.progress.totalEpisodes > 0 && (
          <div className="absolute inset-x-0 bottom-0">
            <ProgressBar
              percentage={Math.round((item.progress.watchedEpisodes / item.progress.totalEpisodes) * 100)}
            />
          </div>
        )}
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="truncate text-base font-semibold text-text">{item.title}</p>
        <p className="text-xs text-muted">{item.year}</p>
        {showMeta && (
          <p className="truncate text-[11px] text-muted">
            {STATUS_LABEL[item.status]} · {dateFormatter.format(new Date(item.updatedAt))}
          </p>
        )}
      </div>
    </Link>
  );
}
