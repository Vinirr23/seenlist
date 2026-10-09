import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { tmdbImage } from "@/lib/tmdb/image";
import { CertificationBadge } from "./CertificationBadge";
import { TrailerCard } from "@/components/media/TrailerCard";

/**
 * REESCRITO (2026-10-09 — correção estrutural do hero, aprovada em
 * quatro rodadas de mockup antes desta implementação; ver
 * `claude/SEENLIST-FEATURE-2026-10-09-redesign-paginas-publicas-spec.md`
 * no projeto). Mudanças estruturais reais, não só CSS:
 *
 * 1) Backdrop: antes vivia numa caixa de altura FIXA (280px/400px),
 *    separada do conteúdo, que só "encostava" nele via margem negativa
 *    — texto/notas ficavam sobre a BORDA do degradê (pior contraste
 *    possível). Agora o backdrop é o fundo de TODA a seção (altura =
 *    altura do conteúdo) com três degradês desenhados por objetivo (ver
 *    comentários abaixo), em vez de uma camada preta única.
 *
 * 2) Mídia: o trailer deixou de ser uma miniatura ao lado das notas —
 *    pedido explícito do usuário comparando com IMDb/TMDB ("o trailer
 *    precisa ser visualmente dominante"). Agora pôster (2:3) e trailer
 *    (16:9) formam a área principal de mídia, lado a lado, com a MESMA
 *    altura — a largura do trailer vem da altura do pôster via
 *    `aspect-ratio` (nunca um valor chutado), então ele ocupa a maior
 *    parte da largura disponível sem sobrar espaço vazio. Sem trailer,
 *    o próprio backdrop (já carregado, sem requisição nova) preenche o
 *    espaço, sem botão de play — nunca um retângulo vazio.
 *
 * 3) Notas (TMDB/SeenList) subiram pro topo, ao lado do título —
 *    SEMPRE separadas e rotuladas (nunca a mesma escala — regra do
 *    projeto).
 *
 * 4) Sinopse, direção/criação e "onde assistir" são children, abaixo da
 *    mídia — "onde assistir" (`StreamingProviders`/`SeriesWatchProviders`)
 *    NÃO foi recriado, continua vindo pronto de quem chama via prop
 *    `watchProviders`.
 *
 * Pôster e trailer aparecem duas vezes no JSX (uma instância visível só
 * no mobile, outra só no desktop — `hidden`/`sm:hidden` cada uma) porque
 * cada tamanho de tela os posiciona num container-pai DIFERENTE (no
 * mobile o pôster fica acima do título; no desktop, ao lado do trailer)
 * — CSS puro não move um nó entre dois pais diferentes, só entre
 * irmãos. É a mesma técnica já usada pro trailer antes desta rodada.
 *
 * Continua Server Component — só `TrailerCard` (filho "use client")
 * hidrata.
 */

function PosterArt({ posterUrl, title, className }: { posterUrl: string | null; title: string; className: string }) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-xl ${className}`}>
      {posterUrl && (
        <Image src={posterUrl} alt={title} width={220} height={330} className="h-full w-full object-cover" priority />
      )}
    </div>
  );
}

function RatingMini({
  source,
  label,
  value,
  scale,
  caption,
  emptyLabel,
}: {
  source: "tmdb" | "seenlist";
  label: string;
  value: string | null;
  scale: string;
  caption?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="text-center sm:text-right">
      <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted sm:justify-end">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${source === "seenlist" ? "bg-primary" : ""}`}
          style={source === "tmdb" ? { backgroundColor: "#01b4e4" } : undefined}
          aria-hidden="true"
        />
        {label}
      </p>
      {value ? (
        <>
          <p className="mt-0.5 flex items-baseline justify-center gap-1 sm:justify-end">
            <span className="text-lg font-bold text-text">{value}</span>
            <span className="text-xs text-muted">{scale}</span>
          </p>
          {caption && <p className="text-[11px] text-muted">{caption}</p>}
        </>
      ) : (
        <p className="mt-0.5 flex items-baseline justify-center gap-1 sm:justify-end">
          <span className="text-base font-semibold text-muted">—{scale}</span>
        </p>
      )}
      {!value && emptyLabel && <p className="text-[11px] italic text-muted">{emptyLabel}</p>}
    </div>
  );
}

export function TitleHeader({
  mediaTypeLabel,
  title,
  originalTitle,
  backdropPath,
  posterPath,
  year,
  certification,
  secondaryMetaLine,
  genres,
  voteAverage,
  communityAggregate,
  trailerKey,
  overview,
  creditLabel,
  creditNames,
  watchProviders,
}: {
  mediaTypeLabel: "Filme" | "Série";
  title: string;
  originalTitle?: string | null;
  backdropPath: string | null;
  posterPath: string | null;
  year: string | null;
  certification: string | null;
  /** Já formatado por quem chama — "113 min" (filme) ou "3 temporadas" (série) — mesmo padrão de antes, este componente não precisa saber a diferença entre os dois. */
  secondaryMetaLine?: string | null;
  genres: string[];
  voteAverage: number;
  communityAggregate: { average: number; count: number } | null;
  trailerKey: string | null;
  /** Sinopse — integrada ao hero, não numa seção separada abaixo. */
  overview: string;
  /** "Direção" (filme) ou "Criação" (série) — rótulo pronto, mesmo raciocínio de `secondaryMetaLine`. */
  creditLabel: string | null;
  creditNames: string[];
  /** `<StreamingProviders .../>` ou `<SeriesWatchProviders .../>` já renderizado por quem chama. */
  watchProviders: ReactNode;
}) {
  const backdropUrl = tmdbImage(backdropPath, "w1280");
  const posterUrl = tmdbImage(posterPath, "w500");

  return (
    <div className="relative overflow-hidden bg-background">
      {/* Fundo: a imagem fica atrás de TODO o conteúdo (altura = altura do
          conteúdo da seção, via `absolute inset-0` dentro de um pai
          `relative` sem altura fixa — nunca um valor em px chutado). */}
      <div className="absolute inset-0">
        {backdropUrl && <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" priority />}

        {/* Camada 1 — overlay escuro discreto, só o necessário pra uma base
            mínima de legibilidade. Mais forte no mobile (lá o conteúdo
            cobre a imagem inteira, não só a metade esquerda) e bem leve no
            desktop, onde as outras duas camadas fazem a maior parte do
            trabalho — a imagem precisa continuar visível nas áreas livres. */}
        <div className="absolute inset-0 bg-background/45 sm:bg-background/10" />

        {/* Camada 2 — degradê horizontal, só no desktop: escurece o lado do
            texto e preserva a imagem visível à direita, em vez de uma
            camada plana sobre tudo. */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-background/75 via-background/30 to-transparent sm:block" />

        {/* Camada 3 — degradê vertical: a base da seção se funde com o
            `bg-background` que vem depois (ficha técnica, elenco etc.),
            sem uma borda seca. */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      </div>

      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-7 sm:gap-6 sm:px-8 sm:py-10">
        <nav className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <Link href="/" className="font-semibold hover:text-text">
            SeenList
          </Link>
          <span aria-hidden="true">›</span>
          <span>{mediaTypeLabel === "Filme" ? "Filmes" : "Séries"}</span>
        </nav>

        {/* Topo: título + metadados à esquerda, notas à direita (sempre
            separadas, nunca a mesma escala). Centralizado no mobile,
            lado a lado a partir do desktop. */}
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:text-left">
          {/* Pôster — instância mobile, acima do título (no desktop ele mora na área de mídia, abaixo). */}
          <PosterArt posterUrl={posterUrl} title={title} className="h-[186px] w-[124px] sm:hidden" />

          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-[1.3rem] font-bold leading-tight text-text sm:text-4xl">
              {title}
              {year && <span className="font-normal text-muted"> ({year})</span>}
            </h1>
            {originalTitle && originalTitle !== title && <p className="mt-1 text-sm italic text-muted">{originalTitle}</p>}

            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted sm:mt-2 sm:justify-start">
              <CertificationBadge certification={certification} />
              {secondaryMetaLine && <span>{secondaryMetaLine}</span>}
              {genres.length > 0 && (
                <>
                  {secondaryMetaLine && (
                    <span className="text-border" aria-hidden="true">
                      •
                    </span>
                  )}
                  <span>{genres.join(", ")}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-6 sm:gap-5">
            <RatingMini
              source="tmdb"
              label="TMDB"
              value={voteAverage > 0 ? voteAverage.toFixed(1) : null}
              scale="/10"
            />
            <RatingMini
              source="seenlist"
              label="SeenList"
              value={communityAggregate ? communityAggregate.average.toFixed(1) : null}
              scale="/5"
              caption={
                communityAggregate
                  ? `${communityAggregate.count} ${communityAggregate.count === 1 ? "avaliação" : "avaliações"}`
                  : undefined
              }
              emptyLabel={communityAggregate ? undefined : "sem avaliações"}
            />
          </div>
        </div>

        {/* Área de mídia — pôster + trailer (ou, sem trailer, o backdrop
            já carregado) lado a lado, mesma altura. */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-7">
          {/* Pôster — instância desktop, dentro da área de mídia. */}
          <PosterArt posterUrl={posterUrl} title={title} className="hidden h-[330px] w-[220px] sm:block" />

          {trailerKey ? (
            <>
              <div className="w-full sm:hidden" style={{ aspectRatio: "16 / 9" }}>
                <TrailerCard videoKey={trailerKey} />
              </div>
              <div className="hidden h-[330px] shrink-0 overflow-hidden rounded-xl sm:block" style={{ aspectRatio: "16 / 9" }}>
                <TrailerCard videoKey={trailerKey} />
              </div>
            </>
          ) : (
            backdropUrl && (
              <div
                className="relative w-full overflow-hidden rounded-xl border border-white/10 sm:h-[330px] sm:w-auto sm:shrink-0"
                style={{ aspectRatio: "16 / 9" }}
              >
                <Image src={backdropUrl} alt="" fill sizes="(min-width: 640px) 587px, 100vw" className="object-cover" />
              </div>
            )
          )}
        </div>

        {/* Abaixo da mídia: sinopse, direção/criação e onde assistir —
            sempre alinhados à esquerda (pedido explícito, inclusive no
            mobile — diferente do bloco do topo, que centraliza). */}
        <div className="flex flex-col gap-2.5 text-left">
          {overview && <p className="max-w-[68ch] text-sm leading-relaxed text-text">{overview}</p>}

          {creditLabel && creditNames.length > 0 && (
            <p className="text-sm text-muted">
              {creditLabel} de <span className="text-text">{creditNames.join(", ")}</span>
            </p>
          )}

          {watchProviders && <div className="mt-1.5">{watchProviders}</div>}
        </div>
      </div>
    </div>
  );
}
