import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * "Vidro" + reorganização — Perfil público (a pedido, 2026-08-26,
 * correção do entendimento anterior — "é pra ter carrossel e ter sub
 * páginas, igual ao perfil do usuário"). Mesma linguagem visual do
 * `ProfileMediaCarousel.tsx` (Perfil próprio): cabeçalho ícone+título
 * dentro de um `Link` (leva pra uma sub-página com a lista completa),
 * carrossel horizontal de pôster com o mesmo vidro
 * (`DiscoverCard.tsx`), sem nenhum "card" envolvendo a seção inteira
 * — só o pôster individual recebe vidro, igual ao Perfil próprio.
 *
 * Diferente do `ProfileMediaCarousel.tsx`: lá, o carrossel busca
 * pôster/título aos poucos (paginado, ids → resumo) porque a
 * biblioteca do PRÓPRIO usuário pode ter centenas de itens. Aqui, os
 * hooks do perfil público (`usePublicLibraryItems`/`usePublicFavorites`)
 * já devolvem os itens PRONTOS (com pôster/título, via
 * `fetchDisplaySummaries` internamente) — não precisa desse
 * segundo passo, então este componente só recebe a lista já filtrada
 * e ordenada por quem chama.
 *
 * CORREÇÃO (a pedido, 2026-08-26 — "nas partes com manchas as letras
 * estão ficando meio apagadas") — a 1ª versão deste componente tinha
 * ficado com o título sem a mesma proteção de leitura que o
 * `ProfileMediaCarousel.tsx` original sempre teve: aqui o título senta
 * DIRETO em cima do brilho azul ambiente (sem nenhum card/vidro atrás
 * dele), e sem `text-shadow` o texto claro sobre um fundo às vezes
 * claro (o próprio brilho) perde contraste — exatamente o mesmo
 * problema já resolvido antes em `ProfileMediaCarousel.tsx`/
 * `ProfileListsPreview.tsx` no Perfil próprio. Faltou copiar a
 * correção junto quando este componente foi criado. Adicionado agora
 * o mesmo `text-shadow` (sombra escura em 3 camadas) em TODOS os
 * títulos (carregando/vazio/carregado) + a opção `dimHeadingBg`
 * (mancha escura atrás do título, só pro carrossel mais perto do
 * topo da página, onde o brilho é mais concentrado).
 */
const HEADING_TEXT_SHADOW_CLASS =
  "relative text-lg font-extrabold tracking-tight text-text [text-shadow:0_0_2px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.75),0_1px_6px_rgba(0,0,0,0.6)]";

function DimHeadingBg() {
  return (
    <div
      className="pointer-events-none absolute -inset-x-3 -inset-y-3 rounded-2xl blur-xl"
      style={{ background: "radial-gradient(closest-side, rgba(5,7,12,0.55), transparent 75%)" }}
      aria-hidden="true"
    />
  );
}

export function PublicMediaCarousel({
  icon: Icon,
  label,
  href,
  items,
  isLoading,
  emptyLabel,
  dimHeadingBg = false,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  items: LibraryItem[];
  isLoading: boolean;
  /** Quando ausente, a seção some por completo se vazia (mesmo padrão de "Séries"/"Filmes" no Perfil próprio) — só passar pra seções que devem mostrar um convite (favoritos). */
  emptyLabel?: string;
  /** Escurece o fundo bem atrás do título (ver comentário acima) — só o carrossel mais perto do topo da página deveria ligar isso. */
  dimHeadingBg?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="relative mb-3 flex items-center gap-2 px-1">
          {dimHeadingBg && <DimHeadingBg />}
          <Icon className="relative h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className={HEADING_TEXT_SHADOW_CLASS}>{label}</h2>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto overflow-y-hidden px-4 pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <section className="mb-8">
        <div className="relative mb-3 flex items-center gap-2 px-1">
          {dimHeadingBg && <DimHeadingBg />}
          <Icon className="relative h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className={HEADING_TEXT_SHADOW_CLASS}>{label}</h2>
        </div>
        <p className="px-1 text-sm text-muted">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <Link href={href} className="mb-3 flex items-center justify-between px-1">
        <span className="relative flex items-center gap-2">
          {dimHeadingBg && <DimHeadingBg />}
          <Icon className="relative h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className={HEADING_TEXT_SHADOW_CLASS}>{label}</h2>
        </span>
        <span className="shrink-0 text-muted">
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </Link>
      <div className="-mx-4 flex gap-2 overflow-x-auto overflow-y-hidden px-4 pb-1">
        {items.map((item) => {
          const posterUrl = tmdbImage(item.posterPath, "w185");
          const itemHref = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
          return (
            <Link key={`${item.mediaType}-${item.id}`} href={itemHref} className="w-36 shrink-0">
              {/* "Vidro" — mesmo padrão de `ProfileMediaCarousel.tsx`/`DiscoverCard.tsx`. */}
              <div
                className="relative aspect-[2/3] w-36 overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-black/40 backdrop-blur-[14px] backdrop-saturate-[180%]"
                style={{
                  background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                }}
              >
                {posterUrl ? (
                  <Image src={posterUrl} alt={item.title} fill sizes="144px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
