"use client";

import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { useUpcomingEpisodes, type UpcomingBadge } from "@/lib/queries/upcoming-episodes";
import { tmdbImage } from "@/lib/tmdb/image";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { translateDayLabel } from "@/lib/i18n/dayLabels";
import { EmptyShelf } from "../media/EmptyShelf";

/** TASK-054 — TMDB devolve literalmente "Episódio N"/"Episode N" quando ainda não existe título específico pro episódio — mostrar isso duplica o código T/E que já aparece acima, sem informação nova nenhuma. */
function isGenericEpisodeName(name: string, episodeNumber: number): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === `episódio ${episodeNumber}` || normalized === `episode ${episodeNumber}`;
}

/**
 * BUG REAL CORRIGIDO (2026-08-27, reportado — "a tela 'em breve' de
 * séries o esqueleto está errado (já de antes)") — causa raiz: esta
 * tela usava o `HomeSkeleton` genérico (uma TIRA horizontal de
 * pôsteres 2:3, pensada pra carrossel) enquanto o conteúdo real dela,
 * desde o redesign da TASK-063, é uma LISTA VERTICAL de linhas
 * horizontais (pôster 70×80 + texto) conectadas por uma trilha
 * lateral (ponto + linha) e agrupadas sob um selo de data (HOJE/
 * AMANHÃ/DEPOIS) — dois formatos completamente diferentes. O
 * esqueleto nunca foi atualizado pra acompanhar aquele redesign.
 * Esqueleto dedicado aqui, replicando a MESMA estrutura real (selo de
 * grupo + trilha + linha pôster/texto) em vez do genérico — mesmo
 * princípio de `HomeSkeleton.tsx` (variant "list"), só que com a
 * trilha lateral que só esta tela tem.
 */
function EmBreveSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      {Array.from({ length: 2 }).map((_, groupIndex) => (
        <section key={groupIndex}>
          <div className="mb-3 flex justify-center">
            <div className="h-6 w-24 rounded-full bg-border" />
          </div>
          <div className="flex flex-col">
            {Array.from({ length: groupIndex === 0 ? 2 : 1 }).map((_, index, arr) => (
              <div key={index} className="flex gap-3">
                <div className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white/[0.22]" />
                  {index < arr.length - 1 && <span className="w-px flex-1 bg-white/[0.13]" />}
                </div>
                <div className="flex flex-1 flex-col">
                  <div
                    className="flex items-start gap-1.5 rounded-2xl border border-white/10 p-2.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
                    style={{
                      background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10), transparent 60%), rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="h-20 w-[70px] shrink-0 rounded bg-surface" />
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                      <div className="h-3.5 w-3/4 rounded bg-border" />
                      <div className="h-3 w-1/2 rounded bg-border" />
                      <div className="h-2.5 w-1/3 rounded bg-border" />
                    </div>
                  </div>
                  {index < arr.length - 1 && <div className="h-2.5" aria-hidden="true" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const BADGE_LABEL_KEY: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "seriesHome.badge.premiere",
  novo: "seriesHome.badge.new",
  "mais-recente": "seriesHome.badge.latest",
};

/** TASK-053 — mesmas cores do mockup de referência: PREMIERE e MAIS RECENTE em branco/preto, NOVO em amarelo (cor primária do SeenList) — a única das três que usa a identidade de cor da marca, igual o botão "Assistido". */
const BADGE_CLASSNAME: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "bg-white text-black",
  novo: "bg-primary text-background",
  "mais-recente": "bg-white text-black",
};

/**
 * TASK-053 — layout ampliado pra bater com a referência: card maior,
 * badges abaixo do título (não acima), código T/E e nome do episódio
 * dentro da coluna de conteúdo. O horário grande à direita do mockup
 * NÃO foi replicado — o TMDB não devolve hora de exibição em
 * `next_episode_to_air` (só a data), e mostrar um horário inventado
 * seria pior do que não mostrar nenhum. No lugar dele, a emissora
 * ocupa esse espaço (a única informação real disponível ali).
 *
 * Ajuste (porta do mobile, a pedido) — episódio a partir do 7º dia
 * cai no grupo catch-all "DEPOIS" (`useUpcomingEpisodes`, evita
 * "SEXTA" ambíguo — podia ser essa semana ou a que vem) e, nesses
 * casos, o espaço que mostraria a emissora passa a mostrar a
 * contagem exata de dias até a estreia.
 */
export function EmBreveSection() {
  const { groups, isLoading, isError } = useUpcomingEpisodes();
  const { t } = useTranslation();

  if (isLoading) return <EmBreveSkeleton />;
  if (isError) {
    return <EmptyShelf message={t("seriesHome.errorLoadUpcoming")} />;
  }
  if (groups.length === 0) {
    return (
      <EmptyShelf
        message={t("seriesHome.emptyUpcoming")}
        actionLabel={t("seriesHome.exploreSeries")}
        actionHref="/explore?tab=series"
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey}>
          {/* "Vidro" (mesmo padrão de SectionTitle.tsx) */}
          <div className="mb-3 flex justify-center">
            <span
              className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted backdrop-blur-[10px] backdrop-saturate-[160%]"
              style={{
                background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
              }}
            >
              {translateDayLabel(group.label, t)}
            </span>
          </div>
          {/*
           * TASK-063 (a pedido, 2026-08-26, proposta revisada com o
           * usuário antes de aplicar — ver handoff) — cards mais baixos
           * (poster `h-24 w-16` → `h-20 w-[70px]`, padding `p-3` → `p-2.5`,
           * ~15-18% menor no total, MEDIDO, sem reduzir nenhum tamanho de
           * fonte) e uma trilha vertical fina conectando os cards do MESMO
           * grupo de data (reseta a cada cabeçalho HOJE/AMANHÃ/DEPOIS,
           * decisão do usuário) — puramente visual, sem número, sem nova
           * interação: só ajuda a ler "isso é uma sequência de próximos
           * lançamentos", não 5 caixas soltas.
           */}
          <div className="flex flex-col">
            {group.episodes.map((episode, index) => {
              const posterUrl = tmdbImage(episode.posterPath, "w185");
              const badge = episode.badge
                ? { label: t(BADGE_LABEL_KEY[episode.badge]), className: BADGE_CLASSNAME[episode.badge] }
                : null;
              const network = episode.networks[0] ?? null;
              // "S04 · E05" em vez de "S04E05" — mais fácil de escanear
              // visualmente (a pedido).
              const episodeCode = `S${String(episode.seasonNumber).padStart(2, "0")} · E${String(episode.episodeNumber).padStart(2, "0")}`;
              const hasRealEpisodeName = episode.name && !isGenericEpisodeName(episode.name, episode.episodeNumber);
              const isFirstInGroup = index === 0;
              const hasNextInGroup = index < group.episodes.length - 1;

              return (
                // CORREÇÃO (a pedido, 2026-08-26, print real — "a linha
                // conectando um ao outro... achei meio estranho não
                // estando realmente conectada em todos os pontos") — a 1ª
                // versão tinha DOIS problemas juntos: (1) o ponto tinha um
                // deslocamento (`mt-2`) antes de aparecer, e a linha só
                // começava DEPOIS dele (mais `mt-1`) — sobrava um vão vazio
                // logo abaixo de cada ponto; (2) o espaço entre um card e o
                // próximo era uma margem (`mb-2.5`) FORA da trilha — a linha
                // (que só esticava (`flex-1`) até a altura do PRÓPRIO card,
                // via `align-items: stretch` desta linha) nunca chegava a
                // cobrir esse espaço nem o deslocamento do próximo ponto,
                // deixando um vão bem maior ainda ali. Corrigido nos dois
                // lugares: ponto sem nenhum deslocamento (fica exatamente
                // onde a linha anterior termina) e o espaço entre cards
                // virou um "spacer" DENTRO da coluna de conteúdo (não mais
                // uma margem no wrapper de fora) — assim a trilha, que
                // estica pra cobrir a altura real do que está ao lado dela,
                // cobre AUTOMATICAMENTE esse espaço também, e a linha fica
                // de fato contínua, ponto a ponto, sem nenhum vão. Testado
                // visualmente antes de aplicar (Playwright).
                <div key={`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`} className="flex gap-3">
                  {/*
                   * AJUSTE (a pedido, 2026-08-26, feedback detalhado do
                   * usuário depois de ver a lista renderizada — "o primeiro
                   * card está 'especial' demais... eu faria a diferença...
                   * um pouco mais sutil... sem um brilho tão forte") —
                   * tirado o halo (`shadow-[...]`) do primeiro ponto,
                   * mantida só a cor âmbar como diferença (sutil o
                   * suficiente pra indicar "aqui começa a sequência", sem
                   * chamar tanta atenção).
                   *
                   * AJUSTE 2 (a pedido, 2026-08-26, rodada seguinte de
                   * feedback — "a linha está muito dominante... linha =
                   * estrutura visual, cards = conteúdo... deixaria os
                   * pontos aproximadamente 30-40% mais discretos") — ponto
                   * âmbar do primeiro lançamento mantido como estava (o
                   * usuário confirmou que esse gostou). Reduzida a
                   * opacidade da linha (`/20` → `/[0.13]`, -35%) e dos
                   * pontos cinza (`/35` → `/[0.22]`, -37%) — dentro da
                   * faixa pedida. Usado valor arbitrário entre colchetes
                   * (`/[0.NN]`) em vez de um número solto fora da escala
                   * padrão do Tailwind (5 em 5) — é a sintaxe CORRETA pra
                   * opacidade fracionária (já usada em outros arquivos do
                   * projeto, ex. `ContinueWatchingCard.tsx`), diferente do
                   * erro da entrega anterior (`bg-white/18` sem colchetes,
                   * que silenciosamente não gerava classe nenhuma).
                   */}
                  {/* Trilha: ponto + linha de conexão até o próximo card do mesmo grupo. */}
                  <div className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", isFirstInGroup ? "bg-primary" : "bg-white/[0.22]")} />
                    {hasNextInGroup && <span className="w-px flex-1 bg-white/[0.13]" />}
                  </div>

                  {/* Coluna de conteúdo: o card + um "spacer" que reserva o
                   * mesmo espaço que antes era `mb-2.5` no card — mas por
                   * estar DENTRO desta coluna, a trilha (irmã, `stretch`)
                   * cobre ele também, o que fecha o vão da linha. */}
                  {/*
                   * BUG REAL CORRIGIDO (2026-08-27, reportado — "quando o
                   * card tem um título e nome do episódio longos, fica
                   * bugado", print real mostrando o card vazando pra fora
                   * da tela, sem borda direita visível e a emissora
                   * cortada fora da tela) — causa raiz: item clássico de
                   * layout flex aninhado — o filho mais fundo (a coluna de
                   * texto dentro do `<Link>`, algumas linhas abaixo) já
                   * tinha `min-w-0` (permite encolher/quebrar linha), mas
                   * ESTE nível aqui (o `<div>` que embrulha o card inteiro
                   * dentro da timeline) não tinha — sem `min-w-0` em TODOS
                   * os níveis da cadeia, o navegador podia calcular a
                   * largura "preferida" (sem quebra nenhuma) de título +
                   * nome do episódio somados e forçar o card inteiro a
                   * crescer até esse tamanho, vazando pra fora da tela.
                   * Cards com título/episódio curtos nunca expunham isso
                   * (a largura preferida já cabia sozinha); só apareceu
                   * agora com uma combinação longa o bastante.
                   */}
                  <div className="flex min-w-0 flex-1 flex-col">
                  {/*
                   * AJUSTE (a pedido, 2026-08-26, mesmo feedback) — "o
                   * poster termina em uma posição e o texto começa
                   * relativamente distante... aproximaria uns 4-6px": gap
                   * `gap-2.5` (10px) → `gap-1.5` (6px), -4px.
                   */}
                  {/* "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — "glass-row". */}
                  <Link
                    href={`/series/${episode.seriesId}`}
                    className="flex items-start gap-1.5 rounded-2xl border border-white/10 p-2.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
                    style={{
                      background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
                    }}
                  >
                    <div className="relative h-20 w-[70px] shrink-0 overflow-hidden rounded bg-background">
                      {posterUrl ? (
                        <Image src={posterUrl} alt="" fill sizes="70px" className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
                      {/*
                       * CORREÇÃO (a pedido, 2026-08-26, print real — "quando
                       * o nome da série é longo o card não fica legal", ex.
                       * "Re:ZERO –Starting Life in Another Wo…") — `truncate`
                       * força 1 linha só e corta NO MEIO DA PALAVRA, e com o
                       * card mais estreito/compacto da TASK-063 isso ficou
                       * mais visível (menos espaço horizontal sobrando antes
                       * da coluna da emissora). Testado antes de aplicar:
                       * trocado por `line-clamp-2` — títulos curtos (a
                       * maioria) continuam numa linha só, sem nenhuma
                       * mudança visual; só os títulos realmente longos
                       * ganham uma 2ª linha (o card cresce um pouco pra
                       * caber, a altura do poster continua a mesma) em vez
                       * de cortar no meio de uma palavra.
                       */}
                      {/*
                       * AJUSTE (a pedido, 2026-08-26, última rodada de
                       * feedback — "eu faria o nome da série ligeiramente
                       * menor para tentar preservar uma única linha sempre
                       * que possível") — `text-base` (16px) → `text-[15px]`.
                       * Títulos bem longos (tipo "Re:ZERO –Starting Life in
                       * Another World–") continuam quebrando em 2 linhas de
                       * qualquer forma (o próprio usuário reconheceu que é
                       * "inevitável pelo tamanho") — o ganho é só nos casos
                       * de fronteira, que passam a caber numa linha só.
                       */}
                      <p className="line-clamp-2 text-[15px] font-bold leading-snug text-text">{episode.seriesTitle}</p>
                      {/*
                       * AJUSTE (a pedido, 2026-08-26, mesmo feedback — "eu
                       * padronizaria a posição das informações... o
                       * conteúdo se movimenta dependendo do badge") — antes,
                       * o selo era uma linha própria ENTRE o título e o
                       * código — quando ausente, o código "subia" pra logo
                       * abaixo do título, deixando cards com e sem selo
                       * visualmente diferentes na posição do código. Agora
                       * o selo entrou na MESMA linha do código (à direita
                       * dele) — a estrutura fica sempre [título] / [código
                       * (+ selo, se tiver)] / [nome do episódio, se tiver],
                       * igual em todo card, com ou sem selo.
                       */}
                      <div className="flex items-center gap-1.5">
                        <p className="font-mono text-sm font-bold text-text">{episodeCode}</p>
                        {badge && (
                          // AJUSTE (a pedido, 2026-08-26, última rodada —
                          // "o badge está competindo um pouco com S02 · E08
                          // ... os dois têm praticamente o mesmo peso
                          // visual... o código é a informação principal, o
                          // selo é um indicador secundário, menor") — pílula
                          // encolhida (`px-1.5 py-0.5` → `px-1 py-px`,
                          // `text-[10px]` → `text-[9px]`) e mais leve
                          // (`font-bold` → `font-semibold`, `tracking-wide`
                          // → `tracking-normal`) — continua a mesma pílula
                          // colorida de sempre (mesmo `badge.className`,
                          // sem quebrar o padrão visual compartilhado com
                          // `ContinueWatchingCard.tsx`), só menor e mais
                          // discreta que o código ao lado.
                          <span
                            className={cn(
                              "inline-block w-fit shrink-0 rounded px-1 py-px text-[9px] font-semibold tracking-normal",
                              badge.className
                            )}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                      {/*
                       * AJUSTE (a pedido, 2026-08-26, mesmo feedback — "o
                       * título do episódio está ocupando muito espaço... é
                       * informação útil, mas deveria ser secundária...
                       * fonte menor, cor mais discreta") — `text-sm
                       * text-muted` (mesmo peso visual do código) virou
                       * `text-xs text-muted/70` (menor e mais apagado); já
                       * era `truncate` (1 linha, ellipsis) — isso não mudou.
                       */}
                      {hasRealEpisodeName && <p className="truncate text-xs text-muted/70">{episode.name}</p>}
                    </div>

                    {episode.daysUntil >= 7 ? (
                      <div className="flex shrink-0 flex-col items-center self-center">
                        <span className="text-xl font-extrabold leading-none text-text">{episode.daysUntil}</span>
                        <span className="text-[10px] font-bold tracking-wide text-muted">{t("seriesHome.daysUntil")}</span>
                      </div>
                    ) : (
                      /*
                       * BUG REAL CORRIGIDO (2026-08-27, mesmo reportado
                       * acima) — segunda parte da mesma causa: mesmo com
                       * o `min-w-0` de cima já resolvendo o vazamento da
                       * largura, o nome da emissora (ex.: uma emissora com
                       * nome mais longo) ainda não tinha corte nenhum
                       * (`shrink-0`, sem `truncate`/limite de largura) —
                       * `max-w-[76px] truncate` corta com "…" só nos
                       * nomes realmente longos; nomes curtos (AT-X, Fuji
                       * TV, Prime Video) continuam exatamente iguais.
                       */
                      network && (
                        <div className="max-w-[76px] shrink-0 self-center text-right">
                          <p className="truncate text-xs text-muted">{network}</p>
                        </div>
                      )
                    )}
                  </Link>
                  {hasNextInGroup && <div className="h-2.5" aria-hidden="true" />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
