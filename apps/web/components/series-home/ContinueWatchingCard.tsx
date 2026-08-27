"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { useSeriesEpisodesLight, groupBySeason } from "@/lib/queries/seriesEpisodesLight";
import { useWatchedEpisodes, useWatchedEpisodeIds, isEpisodeWatched, type WatchedEpisodeKey } from "@/lib/queries/watched-episodes-state";
import { useToggleEpisodeWatched } from "@/lib/queries/watched-episodes-mutations";
import { computeBadge, hasEpisodeAired, type UpcomingBadge } from "@/lib/queries/upcoming-episodes";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { EpisodeWatchedButton } from "../series/EpisodeWatchedButton";

const BADGE_LABEL_KEY: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "seriesHome.badge.premiere",
  novo: "seriesHome.badge.new",
  "mais-recente": "seriesHome.badge.latest",
};

const BADGE_CLASSNAME: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "bg-white text-black",
  novo: "bg-primary text-background",
  "mais-recente": "bg-white text-black",
};

/**
 * Polimento visual (2026-08-25, a partir de uma sugestão trazida pelo
 * usuário, originada de outra IA — "GPT", revisada e ajustada com
 * ele antes de aplicar). Só valores de tamanho/espaçamento/hierarquia
 * dentro do MESMO sistema "vidro" que este card já usava — nenhum
 * layout, componente ou fluxo novo. Pôster 96×64 → 108×72 (mesma
 * proporção 2:3, ~12,5% maior); padding interno 12px → 14px; código
 * T/E mais forte (`text-base font-extrabold`); nome do episódio mais
 * discreto (`text-xs`, mais apagado); selos NOVO/MAIS RECENTE/
 * PREMIERE com cantos mais suaves e um pouco menores, mas sem perder
 * o contraste sólido (âmbar/branco) que os faz chamar atenção de
 * verdade — decisão explícita do usuário, ele NÃO quis o mesmo nível
 * de discrição da pílula "+N".
 */
/**
 * AJUSTE (2026-08-26, a pedido — "deixa as capas maiores, sem
 * aumentar o tamanho dos cards") — 108x72 -> 120x80 (mesma proporção
 * 2:3, ~11% maior). O pôster define a altura da linha inteira (via
 * `items-stretch`), então pra manter o card com a MESMA altura de
 * antes o padding vertical encolheu de 14px pra 8px (`p-3.5` ->
 * `px-3.5 py-2` no `Link` abaixo) — o horizontal não mudou. Testado
 * antes com Playwright: 108+14*2=136px batia exatamente com
 * 120+8*2=136px.
 */
const CARD_POSTER_SIZE = { height: "120px", width: "80px" };

/**
 * CORREÇÃO (achado ao comparar com o print de referência que o
 * usuário mandou — "o destaque não era borda desse jeito") — a
 * primeira tentativa (borda âmbar + brilho ao redor do card inteiro)
 * não era o que o print mostrava. O print mostra uma barrinha vertical
 * na BORDA ESQUERDA de cada card, mais forte no primeiro e clareando
 * nos de baixo — um índice de posição, não um destaque isolado só no
 * topo. Um valor por posição (em vez de fórmula) porque é mais fácil
 * de ajustar olhando pro resultado real, sem risco de a fórmula
 * "escapar" pra um valor estranho num índice alto.
 *
 * CORREÇÃO 2 (achado comparando o resultado real com o print de
 * referência de novo — "isso é como o print 1 pediu?") — dois
 * problemas: (a) a queda de 0.9→0.55→0.32→0.16 era gradual demais —
 * no print de referência o 4º card já está quase invisível, aqui
 * ainda estava bem visível. Curva mais íngreme agora. (b) a barra
 * usava um degradê que ficava transparente nas pontas de cima/baixo e
 * só forte no meio — virava um "brilho losango", não a pílula sólida
 * e uniforme do print de referência. Trocado por um degradê quase
 * sólido (só amacia um pouco bem na ponta, pra combinar com o canto
 * arredondado do card).
 */
const PRIORITY_ACCENT_OPACITY = [1, 0.5, 0.25, 0.08, 0.02];

function getPriorityAccentOpacity(priorityIndex: number | undefined): number {
  if (priorityIndex === undefined || priorityIndex < 0) return 0;
  return PRIORITY_ACCENT_OPACITY[priorityIndex] ?? 0;
}

/**
 * CORREÇÃO 3 (2026-08-25, ajuste fino pedido pelo usuário com curva
 * exata em porcentagem) — a curva anterior (`[1, 0.45, 0.16, 0.05]`)
 * ficou substituída por uma calibrada nos números exatos pedidos,
 * relativos ao 1º card (sempre `1`, referência de intensidade máxima):
 * 2º ≈50% menos (`0.5`), 3º ≈70–80% menos (`0.25`, dentro da faixa —
 * 75% de queda), 4º "extremamente sutil" (`0.08`), 5º "praticamente
 * inexistente" (`0.02`, não zero — só o 6º card em diante some de
 * verdade, via `?? 0` em `getPriorityAccentOpacity`). Sempre
 * decrescente, nunca volta a subir num card mais abaixo.
 *
 * Acabamento "gel" (a pedido — "efeito de espelho ou o mesmo efeito
 * dos botões 'gel'", escolhido reaproveitar o "gel" já estabelecido no
 * app: `StatisticsCard.tsx`/`ExploreTabs.tsx`, o brilho fino
 * `inset 0 1px 0 rgba(255,255,255,0.35)` que dá o relevo/reflexo nas
 * pílulas âmbar) — ver `boxShadow` na barrinha, abaixo.
 *
 * Brilho lateral pra dentro do card (a pedido — "um glow/gradiente
 * muito sutil vindo dessa lateral pra dentro do card", separado da
 * barrinha sólida) — segundo elemento, um degradê horizontal bem mais
 * fraco que a barrinha (`GLOW_OPACITY_FACTOR`), limitado a uma faixa
 * fixa de largura (nunca ilumina o card inteiro), com a MESMA curva de
 * queda por posição (é só uma fração da mesma opacidade da barrinha,
 * não uma tabela separada — garante que as duas nunca dessincronizam).
 * Como esse degradê alcança a coluna de texto (não fica só atrás do
 * pôster), a coluna de texto e o pôster ganharam `relative z-10`
 * explícito pra garantir que ficam por CIMA do brilho (sem isso, um
 * `<div>` normal, sem posicionamento próprio, pode ficar por baixo de
 * um elemento `absolute` mesmo vindo depois no HTML — regra de
 * empilhamento do CSS, não um bug de ordem).
 *
 * CORREÇÃO (mesmo dia, o usuário mandou print real e disse "não vi o
 * 'gel' e mal consigo ver o brilho lateral") — os dois efeitos
 * estavam tecnicamente lá, só sutis demais pra notar numa tela real
 * (ainda mais comprimida em print). (a) O "gel" trocou de um
 * `boxShadow` inset de 1px (quase invisível numa barra de 4px) por uma
 * SEGUNDA camada de gradiente branco, sobreposta à cor âmbar (não
 * substitui, soma — CSS permite múltiplas camadas de `background`
 * separadas por vírgula), formando um "capuz" brilhante bem visível no
 * topo da barra que se funde com o âmbar embaixo — o mesmo princípio
 * do "gel" (luz concentrada numa ponta), só numa técnica que realmente
 * aparece numa barra fina. (b) `PRIORITY_GLOW_OPACITY_FACTOR` subiu de
 * `0.16` pra `0.35`, e o ponto onde o degradê termina em transparente
 * (na barrinha do brilho, abaixo) ficou mais próximo da borda (`60%`
 * em vez de `70%`) — o brilho fica mais concentrado e mais visível
 * perto da lateral, sem crescer em LARGURA (continua limitado, nunca
 * ilumina o card inteiro).
 */
const PRIORITY_GLOW_OPACITY_FACTOR = 0.35;

/**
 * "MARCAR EPISÓDIO: UMA EXPERIÊNCIA" (2026-08-25, a pedido, spec trazida
 * pelo usuário) — toque no ✓ → confirmação breve e discreta → (só quando
 * é o ÚLTIMO episódio pendente da série) o card sai e os de baixo sobem
 * pra preencher o espaço, suavemente. Duas decisões tomadas com o
 * usuário antes de implementar (`AskUserQuestion`):
 *
 * 1) Quando a série AINDA tem mais episódio pendente (selo "+N"
 *    visível) — o check só pulsa/confirma; o card FICA no lugar e troca
 *    pro próximo episódio no mesmo card, sem sair da lista nem disparar
 *    reflow. Isso já era o comportamento real de dados (`next` recalcula
 *    pro próximo pendente, ver `useMemo` abaixo) — só faltava a
 *    confirmação visual antes da troca instantânea.
 * 2) Quando ERA o último pendente — o card realmente sai (fade + colapso
 *    de altura) e os cards de baixo deslizam suavemente pra cima
 *    (`layout` do `motion`, biblioteca nova instalada só pra isso —
 *    não tinha nenhuma lib de animação no projeto antes).
 *
 * CONFIRM_HOLD_MS: quanto tempo o botão fica no estado "confirmado"
 * (círculo âmbar) antes de continuar — dá tempo da pessoa REGISTRAR que
 * funcionou antes do conteúdo trocar ou o card sumir. EXIT_DURATION_S:
 * duração do colapso de saída. Os dois juntos (confirmação + saída) somam
 * a janela de ~600–900ms pedida ("toque → concluí → próximo").
 *
 * CORREÇÃO (a pedido, reportado — "acontece tudo muito rápido, não dá
 * pra perceber direito quando fica o badge 'assistido' e desliza
 * saindo") — a janela de ~600-900ms acima (260ms de espera + 320ms de
 * saída = ~580ms no total) ficou rápida demais na prática, mesmo
 * batendo com o alvo original. Alongado pra uma janela mais perceptível
 * (~650ms de espera + 550ms de saída = ~1200ms no total) —
 * `layout`/opacidade da saída ajustados junto, na mesma proporção de
 * antes, pra continuar tudo no mesmo ritmo (nada dessincroniza).
 *
 * CORREÇÃO (mesmo dia — usuário mandou print real dizendo "não está
 * exatamente como a referência" e pediu análise a fundo do infográfico
 * de 6 passos) — 4 diferenças reais achadas comparando com a
 * referência, cada uma confirmada com o usuário antes de implementar
 * (`AskUserQuestion`, já que batiam de frente com a instrução escrita
 * original — "sem confete, sem gamificação, sem rótulo novo" — usuário
 * escolheu manter fiel à referência nas 4):
 * 1) Cor de confirmação virou VERDE (`bg-green-500`, mesmo tom já usado
 *    em `series-categories.ts` pra status "Assistidas"), não mais o
 *    âmbar padrão — só nesse momento transitório, não muda a cor
 *    "de categoria" normal do botão em nenhum outro lugar do app.
 * 2) Selo de texto "✓ {episode.watched}" aparece no lugar do selo NOVO/
 *    MAIS RECENTE/PREMIERE durante a confirmação (reaproveita a chave
 *    de tradução `episode.watched`, já existe nas 3 línguas — não
 *    inventada agora).
 * 3) Partículas pequenas (`PARTICLE_ANGLES`/`PARTICLE_DISTANCE`) se
 *    espalhando a partir do botão, sutil (bolinhas de 4px, some em
 *    ~420ms) — não confete colorido/grande, só um respingo discreto.
 * 4) Anel se expandindo a partir do botão no toque (`RING_MAX_SCALE`),
 *    tipo "ripple"/sonar — feedback de toque, comum em apps, o usuário
 *    concordou que não é gamificação.
 */
const CONFIRM_HOLD_MS = 650;
const EXIT_DURATION_S = 0.55;
const CONFIRM_COLOR_CLASS = "bg-green-500";
const CONFIRM_TINT_RGB = "34,197,94"; // mesmo verde do Tailwind `green-500`, usado em `series-categories.ts` — wash sutil no fundo do card durante a confirmação.
const PARTICLE_ANGLES = [0, 60, 120, 180, 240, 300].map((deg) => (deg * Math.PI) / 180);
const PARTICLE_DISTANCE = 16;
const RING_MAX_SCALE = 1.8;

/**
 * TASK-055 — "próximo episódio não assistido", ordenado por
 * (temporada, episódio) — a mesma noção de "assistir a seguir" que a
 * tela de detalhe da série já usa, só aplicada série por série aqui.
 *
 * CORREÇÃO (a pedido, achado real — "o card não mostra +N episódios
 * como no mobile") — reescrito pra devolver a lista INTEIRA de
 * pendentes (não só o primeiro), espelhando exatamente
 * `lib/nextEpisodeToWatch.ts` do mobile: mesmo filtro (episódio sem
 * data conhecida OU já ao ar — nunca exclui por "data desconhecida",
 * mesma correção do Tanya the Evil/Daemons já aplicada aqui antes),
 * mesma ordenação. `additionalPendingCount` (o "+N") é
 * `pending.length - 1` — quantos outros episódios além do mostrado
 * já estão liberados pra assistir.
 *
 * CORREÇÃO 2 (a pedido — bug NOVO, introduzido pela correção acima —
 * "temporada nova confirmada mas SEM data de lançamento apareceu
 * como pendente à toa") — episódio sem data só conta como "pode já
 * ter saído" se a MESMA temporada tiver pelo menos um outro episódio
 * com data confirmada e já passada. Temporada inteira sem nenhuma
 * data (especulação de futuro, ainda sem estreia) não conta mais.
 */
/**
 * Exportada (2026-08-25) pra ser reaproveitada por
 * `ContinueWatchingPosterGrid.tsx` — mesma checagem de "tem episódio
 * pendente de verdade" usada aqui, sem duplicar a regra num segundo
 * lugar. Ver comentário lá pro porquê.
 */
export function findPendingEpisodes(
  seasons: {
    seasonNumber: number;
    episodes: { episodeNumber: number; name: string; airDate: string | null; episodeId?: number }[];
  }[],
  watched: Set<WatchedEpisodeKey> | undefined,
  // CORREÇÃO (2026-08-26 — "motor resistente") — opcional, ver isEpisodeWatched (watched-episodes-state.ts).
  watchedEpisodeIds?: Set<number>
) {
  const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const pending: { seasonNumber: number; episode: (typeof seasons)[number]["episodes"][number] }[] = [];
  for (const season of sorted) {
    const seasonHasConfirmedAiring = season.episodes.some((ep) => ep.airDate !== null && hasEpisodeAired(ep.airDate));
    const episodes = [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    for (const ep of episodes) {
      const aired = ep.airDate ? hasEpisodeAired(ep.airDate) : seasonHasConfirmedAiring;
      if (!aired) continue;
      if (!isEpisodeWatched(watched, season.seasonNumber, ep.episodeNumber, ep.episodeId, watchedEpisodeIds)) {
        pending.push({ seasonNumber: season.seasonNumber, episode: ep });
      }
    }
  }
  return pending;
}

/** Formato de cada item pendente devolvido por `findPendingEpisodes`, reaproveitado abaixo pra tipar o "instantâneo" congelado durante a animação de confirmar/sair. */
type PendingEntry = ReturnType<typeof findPendingEpisodes>[number];

/**
 * TASK-055 — "Minha Lista" enriquecida, no nível do TV Time: pôster
 * do EPISÓDIO (não da série), cápsula com nome da série, código T/E,
 * nome do episódio, badges (mesma regra de "Em breve", reutilizada
 * via `computeBadge`), botão de marcar assistido direto no card.
 * Cada card busca os próprios dados — é a forma correta de fazer
 * isso numa lista de tamanho variável sem violar a regra dos hooks
 * (não dá pra chamar hooks dentro de um .map de um componente só).
 *
 * AUDITORIA (perf, a pedido) — trocado `useSeriesDetails` (elenco,
 * sinopse, títulos similares, imagens — o mesmo dado pesado da
 * PÁGINA da série) por `useSeriesEpisodesLight` (só temporada/
 * episódio/nome/data). Com até 8 cards na lista ao mesmo tempo, isso
 * é bem menos dado trafegado por card, sem mudar nada do que
 * aparece na tela — o resto da lógica (achar o próximo não
 * assistido, badge, checagem de "já foi ao ar") é idêntico.
 */
export interface ContinueWatchingCardProps {
  item: LibraryItem;
  /**
   * A PEDIDO (2026-08-25) — posição do card dentro de "Continue
   * assistindo" (0 = primeiro), usada só pra calibrar a barrinha de
   * degradê na lateral esquerda (`getPriorityAccentOpacity`, acima).
   * `undefined` = sem barrinha nenhuma — é o caso da seção "Faz um
   * tempo que você não assiste" (reaproveita este mesmo componente
   * logo abaixo), que não recebe esse destaque, por decisão explícita
   * do usuário.
   */
  priorityIndex?: number;
}

export function ContinueWatchingCard({ item, priorityIndex }: ContinueWatchingCardProps) {
  const accentOpacity = getPriorityAccentOpacity(priorityIndex);
  const { t } = useTranslation();
  const { data: episodes } = useSeriesEpisodesLight(item.id);
  const { data: watched } = useWatchedEpisodes(item.id);
  // CORREÇÃO (2026-08-26 — "motor resistente") — ver isEpisodeWatched (watched-episodes-state.ts).
  const { data: watchedEpisodeIds } = useWatchedEpisodeIds(item.id);
  const toggleWatched = useToggleEpisodeWatched(item.id);

  const next = useMemo(() => {
    if (!episodes) return null;
    return findPendingEpisodes(groupBySeason(episodes), watched, watchedEpisodeIds);
  }, [episodes, watched, watchedEpisodeIds]);

  /*
   * "MARCAR EPISÓDIO: UMA EXPERIÊNCIA" — máquina de 3 estados pro toque
   * no ✓ (ver comentário grande em `CONFIRM_HOLD_MS`, acima):
   *   idle       → mostra o episódio pendente de verdade (dado ao vivo).
   *   confirming → botão confirmado (âmbar), conteúdo CONGELADO no
   *                episódio que acabou de ser marcado (evita o texto
   *                trocar por baixo do dedo enquanto o botão ainda tá
   *                "confirmando").
   *   exiting    → (só quando era o último pendente) card colapsa
   *                (altura/opacidade) e os de baixo sobem via `layout`.
   *
   * `frozenRef` guarda o último episódio mostrado em `idle` — é o que
   * a fase `confirming`/`exiting` usa pra manter o card mostrando o
   * episódio que a pessoa ACABOU de marcar, mesmo depois do dado ao
   * vivo (`next`) já ter recalculado pro próximo pendente (a mutation é
   * otimista — atualiza na hora, antes do card terminar de animar).
   */
  const [phase, setPhase] = useState<"idle" | "confirming" | "exiting">("idle");
  const [pulseKey, setPulseKey] = useState(0);
  const frozenRef = useRef<{ seasonNumber: number; episode: PendingEntry["episode"]; additionalPendingCount: number } | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === "idle" && next && next.length > 0) {
      frozenRef.current = {
        seasonNumber: next[0]!.seasonNumber,
        episode: next[0]!.episode,
        additionalPendingCount: next.length - 1,
      };
    }
  }, [phase, next]);

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) window.clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  if (!episodes || next === null) return null;
  // Nunca teve nada pendente pra essa série (caso normal, não relacionado à animação) — ou já terminou de sair e não sobrou dado nenhum ao vivo.
  if (next.length === 0 && phase === "idle") return null;

  const live = next.length > 0 ? { seasonNumber: next[0]!.seasonNumber, episode: next[0]!.episode, additionalPendingCount: next.length - 1 } : null;
  const display = phase === "idle" ? live : frozenRef.current;
  if (!display) return null;

  const { seasonNumber, episode, additionalPendingCount } = display;
  const badge =
    episode.airDate && watched
      ? computeBadge(
          { seriesId: item.id, seasonNumber, episodeNumber: episode.episodeNumber, airDate: episode.airDate },
          watched
        )
      : null;
  const badgeConfig = badge ? { label: t(BADGE_LABEL_KEY[badge]), className: BADGE_CLASSNAME[badge] } : null;
  /*
   * Ajuste (a pedido): trocado o still do episódio (`episode.stillPath`)
   * pelo pôster da série (`item.posterPath`) — achado real: além de
   * faltar em vários episódios (TMDB nem sempre tem still pra todo
   * episódio), quando existe costuma vir em baixa qualidade, e é uma
   * imagem PAISAGEM (16:9) forçada dentro de um recorte RETRATO
   * (o container aqui é 64×96, a mesma proporção 2:3 de um pôster),
   * cortando as bordas de um jeito estranho. O pôster da série já vem
   * nessa proporção de verdade e é sempre consistente entre os cards.
   */
  const posterUrl = tmdbImage(item.posterPath, "w185");
  const episodeCode = `T${String(seasonNumber).padStart(2, "0")} | E${String(episode.episodeNumber).padStart(2, "0")}`;

  function handleMarkWatched() {
    if (phase !== "idle" || !live) return;
    // Decidido ANTES de marcar — depois da mutation otimista, `next` já reflete o próximo pendente (ou nenhum), então precisa capturar agora se este era o último.
    const wasLastPending = live.additionalPendingCount === 0;
    hapticTick();
    setPulseKey((k) => k + 1);
    setPhase("confirming");
    // CORREÇÃO (2026-08-26 — "motor resistente", ver watched-episodes-mutations.ts) — o campo certo é
    // `episodeId` (bug real achado agora: `live.episode.id` nunca existiu neste tipo — ver
    // seriesEpisodesLight.ts — então o ID nunca era gravado por este card antes desta correção).
    toggleWatched.mutate({
      seasonNumber: live.seasonNumber,
      episodeNumber: live.episode.episodeNumber,
      watched: false,
      episodeId: live.episode.episodeId,
    });
    exitTimeoutRef.current = window.setTimeout(() => {
      setPhase(wasLastPending ? "exiting" : "idle");
    }, CONFIRM_HOLD_MS);
  }

  const watchedButton = (
    <EpisodeWatchedButton
      watched={phase !== "idle"}
      onClick={handleMarkWatched}
      disabled={phase !== "idle"}
      size="lg"
      // A PEDIDO (2026-08-25, fidelidade à referência) — verde na confirmação, só aqui e só transitório; não muda a cor "de categoria" padrão do botão (`bg-primary`) em nenhum outro lugar do app.
      colorClass={CONFIRM_COLOR_CLASS}
      className="shadow-md shadow-black/25 ring-1 ring-white/10"
    />
  );

  return (
    // "MARCAR EPISÓDIO: UMA EXPERIÊNCIA" — `motion.div` externo com `layout`:
    // quando ESTE card colapsa (fase "exiting"), os cards IRMÃOS (outras
    // instâncias deste mesmo componente na lista) também têm `layout` e
    // reposicionam sozinhos, suavemente, sem cálculo manual de posição.
    // `initial={false}` evita animar no carregamento normal da página —
    // só anima quando `phase` muda de verdade, por uma ação da pessoa.
    <motion.div
      layout
      initial={false}
      animate={
        phase === "exiting"
          ? { height: 0, opacity: 0, marginBottom: 0 }
          : { height: "auto", opacity: 1 }
      }
      transition={{
        // Alongado junto com CONFIRM_HOLD_MS/EXIT_DURATION_S acima
        // (mesma proporção de antes: layout ~94% do colapso, opacidade
        // ~70% dele) — sem isso, os cards de baixo terminariam de subir
        // ANTES do card de cima acabar de sumir, dessincronizado.
        layout: { duration: 0.52, ease: "easeInOut" },
        height: { duration: EXIT_DURATION_S, ease: "easeInOut" },
        opacity: { duration: phase === "exiting" ? 0.4 : 0.18, ease: "easeInOut" },
        marginBottom: { duration: EXIT_DURATION_S, ease: "easeInOut" },
      }}
      className="mb-3 overflow-hidden last:mb-0"
    >
      {/* "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — virou "glass-row" em vez de `border-border bg-surface` opaco. */}
      <Link
        href={`/series/${item.id}/season/${seasonNumber}/episode/${episode.episodeNumber}`}
        className="relative flex items-stretch gap-3.5 overflow-hidden rounded-2xl border border-white/[0.08] px-3.5 py-2 backdrop-blur-[18px] backdrop-saturate-[180%] transition-transform active:scale-[0.98]"
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
        }}
      >
        {accentOpacity > 0 && (
          <>
            {/*
             * Brilho lateral (a pedido, 2026-08-25) — luz difusa vindo
             * da lateral esquerda pra DENTRO do card, separada da
             * barrinha sólida abaixo. Largura fixa (`w-32`) — o
             * degradê termina em `transparent` bem antes da borda
             * direita dessa faixa, então nunca ilumina o card inteiro,
             * só a região próxima da lateral. Opacidade é uma fração
             * BEM menor da mesma tabela da barrinha (`PRIORITY_GLOW_OPACITY_FACTOR`),
             * nunca uma tabela própria — garante que os dois elementos
             * sempre caem juntos, na mesma proporção, por posição.
             */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-0 w-32 rounded-l-2xl"
              style={{
                background: `linear-gradient(to right, rgba(240,169,79,${accentOpacity * PRIORITY_GLOW_OPACITY_FACTOR}) 0%, transparent 60%)`,
              }}
            />
            {/*
             * Barrinha na lateral esquerda — pílula praticamente sólida
             * (só amacia bem na ponta, acompanhando o canto arredondado
             * do card), ver `getPriorityAccentOpacity` acima. Nada ao
             * redor do resto do card. Acabamento "gel" (a pedido,
             * corrigido — a versão anterior usava um `boxShadow` inset
             * de 1px, quase invisível numa barra de 4px de largura) —
             * DUAS camadas de `background` sobrepostas (CSS permite
             * várias, separadas por vírgula): um "capuz" branco no topo
             * (primeira camada, mais alto na pilha) se fundindo com o
             * degradê âmbar por baixo (segunda camada) — o mesmo
             * princípio de luz concentrada numa ponta que o "gel" das
             * pílulas do app usa (`StatisticsCard.tsx`/`ExploreTabs.tsx`),
             * só numa técnica que realmente aparece numa barra fina.
             */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1 rounded-l-2xl"
              style={{
                background: `linear-gradient(to bottom, rgba(255,255,255,${accentOpacity * 0.55}) 0%, rgba(255,255,255,0) 20%), linear-gradient(to bottom, rgba(240,169,79,${accentOpacity * 0.75}) 0%, rgba(240,169,79,${accentOpacity}) 12%, rgba(240,169,79,${accentOpacity}) 88%, rgba(240,169,79,${accentOpacity * 0.75}) 100%)`,
              }}
            />
          </>
        )}

        {/*
         * Wash verde de confirmação (a pedido, 2026-08-25 — fidelidade
         * à referência) — tingimento bem sutil (10% de opacidade) no
         * fundo INTEIRO do card enquanto `phase !== "idle"`, mesmo
         * verde do botão (`CONFIRM_TINT_RGB`). `z-0`, atrás de tudo —
         * pôster/texto (`z-10` abaixo) continuam por cima, legíveis.
         */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: `rgba(${CONFIRM_TINT_RGB},0.1)` }}
          initial={false}
          animate={{ opacity: phase !== "idle" ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        />

        {/* `relative z-10` explícito (a pedido, junto do brilho lateral acima) — sem isso, um elemento `absolute` pode empilhar por CIMA de um `<div>` comum mesmo vindo antes no HTML (regra de empilhamento do CSS); com isso, pôster e coluna de texto ficam garantidamente por cima do brilho, nunca "lavados" por ele. */}
        <div className="relative z-10 shrink-0 overflow-hidden rounded bg-background" style={{ height: CARD_POSTER_SIZE.height, width: CARD_POSTER_SIZE.width }}>
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title} fill sizes={CARD_POSTER_SIZE.width} className="object-cover" />
          ) : item.summaryPending ? (
            /* ACHADO ("não tá suave", 16ª rodada) — enquanto o resumo do
             * TMDB não chega, pulso discreto em vez do ícone estático:
             * comunica "carregando", não "sem pôster". */
            <div className="h-full w-full animate-pulse bg-surface" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="relative z-10 min-w-0 flex-1 space-y-1.5 py-0.5">
          {item.summaryPending ? (
            <div className="h-5 w-24 animate-pulse rounded-full bg-surface" aria-hidden="true" />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-text">
              {item.title}
              <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
            </span>
          )}
          <p className="flex items-center gap-1.5 font-mono text-base font-extrabold tracking-tight text-text">
            {episodeCode}
            {/* A PEDIDO (achado real — "falta o +N que o mobile tem") — quantos outros episódios além deste já estão liberados pra assistir. */}
            {additionalPendingCount > 0 && (
              <span className="rounded bg-primary/15 px-1 font-sans text-[10px] font-bold text-primary">
                +{additionalPendingCount}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted/85">{episode.name}</p>
          {/*
           * A PEDIDO (2026-08-25, fidelidade à referência) — durante a
           * confirmação, o selo NOVO/MAIS RECENTE/PREMIERE dá lugar a
           * um selo verde "✓ Assistido" (reaproveita a chave de
           * tradução `episode.watched`, já existente nas 3 línguas —
           * não inventada agora). Volta pro selo normal (ou nenhum)
           * assim que `phase` volta a `idle`.
           */}
          {phase !== "idle" ? (
            <span className="inline-block rounded-full bg-green-500 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white">
              ✓ {t("episode.watched")}
            </span>
          ) : (
            badgeConfig && (
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide",
                  badgeConfig.className
                )}
              >
                {badgeConfig.label}
              </span>
            )
          )}
        </div>

        {pulseKey > 0 ? (
          // Pulso do toque (~260ms) — remonta via `key` a cada toque, pra
          // sempre tocar do zero (evita disparar de novo em re-renders
          // que não vieram de um toque novo). Só existe DEPOIS do 1º
          // toque — antes disso é um botão comum, sem pulso no carregamento.
          <motion.div
            key={pulseKey}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="relative self-center"
          >
            {watchedButton}
            {/*
             * Anel expandindo no toque (a pedido, fidelidade à
             * referência — passo "TOQUE NO CHECK") — parte do tamanho
             * do próprio botão (`inset-0`) e cresce além dele
             * (`RING_MAX_SCALE`), sumindo enquanto expande — efeito
             * "ripple"/sonar, feedback de toque, não gamificação.
             */}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 rounded-full border-2 border-green-400"
              initial={{ opacity: 0.6, scale: 0.6 }}
              animate={{ opacity: 0, scale: RING_MAX_SCALE }}
              transition={{ duration: 0.42, ease: "easeOut" }}
            />
            {/*
             * Partículas (a pedido, fidelidade à referência — passo
             * "CONFIRMAÇÃO VISUAL") — só um respingo discreto (6
             * bolinhas de 4px, ~420ms), não confete grande/colorido.
             * `PARTICLE_ANGLES` fixo (não aleatório) — o burst fica
             * sempre igual, sem risco de sortear um ângulo estranho.
             */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              {PARTICLE_ANGLES.map((angle, i) => (
                <motion.span
                  key={i}
                  className="absolute h-1 w-1 rounded-full bg-green-400"
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{
                    opacity: 0,
                    x: Math.cos(angle) * PARTICLE_DISTANCE,
                    y: Math.sin(angle) * PARTICLE_DISTANCE,
                    scale: 0.4,
                  }}
                  transition={{ duration: 0.42, ease: "easeOut" }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="self-center">{watchedButton}</div>
        )}
      </Link>
    </motion.div>
  );
}
