import { memo, useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  LinearTransition,
  type SharedValue,
} from "react-native-reanimated";
// CORREÇÃO (2026-09-04, achado lendo a documentação oficial do
// Reanimated 4 ANTES de assumir que `runOnJS` de sempre ainda valia) —
// a partir do Reanimated 4, tudo que agenda código de volta pra JS
// thread (`runOnJS`, `runOnUI` etc.) foi movido pro pacote
// `react-native-worklets`, com nome novo e assinatura diferente
// (`scheduleOnRN(fn, ...args)`, em vez de `runOnJS(fn)(...args)`).
// `runOnJS` ainda é reexportado por `react-native-reanimated` por
// compatibilidade, mas já vem marcado como depreciado — como esta é
// uma instalação nova (não uma migração de código antigo), não faz
// sentido começar já usando algo depreciado.
import { scheduleOnRN } from "react-native-worklets";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import type { NextEpisodeToWatch } from "@/lib/nextEpisodeToWatch";
import { toggleEpisodeWatched } from "@/lib/seriesDetails";
import { hapticTick } from "@/lib/haptics";
import { tmdbImageUrl } from "@/lib/library";
import { EpisodeWatchedButton } from "@/components/series-detail/EpisodeWatchedButton";
import { LinearGradient } from "expo-linear-gradient";
import { Text, Glass } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize, fontFamily } from "@/lib/theme";

const BADGE_LABEL_KEY: Record<"premiere" | "novo" | "mais-recente" | "em-breve", string> = {
  premiere: "seriesHome.badge.premiere",
  novo: "seriesHome.badge.new",
  "mais-recente": "seriesHome.badge.latest",
  "em-breve": "seriesHome.badge.comingSoon",
};

const BADGE_COLORS: Record<"premiere" | "novo" | "mais-recente" | "em-breve", { background: string; text: string }> = {
  premiere: { background: "#FFFFFF", text: "#000000" },
  novo: { background: colors.primary, text: colors.background },
  "mais-recente": { background: "#FFFFFF", text: "#000000" },
  "em-breve": { background: colors.secondary, text: colors.background },
};

/**
 * "MARCAR EPISÓDIO: UMA EXPERIÊNCIA" (2026-09-04 — porta fiel de
 * `ContinueWatchingCard.tsx` do web, mesma coreografia/timing/nomes de
 * constante; a única diferença deliberada é a cor de confirmação, que
 * usa `colors.success` — token que já existe no mobile pra esse
 * propósito — em vez do verde cru do Tailwind (`green-500`/`green-400`)
 * que o web usa por não ter um token equivalente).
 *
 * Precisa de `react-native-reanimated` — rode
 * `npx expo install react-native-reanimated` (isso também adiciona a
 * dependência ao package.json com a versão certa pro SDK do Expo
 * instalado; escrever a versão à mão aqui seria chutar um número sem
 * como confirmar) e depois gere um build novo (tem código nativo, não
 * basta recarregar o app) — ver comentário em babel.config.js.
 */
const CONFIRM_HOLD_MS = 650;
const EXIT_DURATION_MS = 550;
/**
 * CORREÇÃO (2026-09-04, reportado — "marcou, fez a animação de
 * assistido, mas não fez a animação deslizando sutil pra cima") — o
 * card em si (colapso de altura/opacidade, acima) sempre funcionou;
 * faltava o que o web faz com `motion.div layout` em
 * `ContinueWatchingCard.tsx`: quando ESTE card colapsa, os IRMÃOS
 * (outras séries da mesma lista) reposicionam suavemente pra cima
 * sozinhos, preenchendo o espaço — RN não tem isso de graça, precisa
 * do `layout` do próprio Reanimated (`LinearTransition`, ver o prop
 * `layout` no `Animated.View` raiz, abaixo). Duração ligeiramente menor
 * que o colapso (520ms vs. 550ms) — mesma proporção (~94%) que o web já
 * tinha calibrado, pra o reposicionamento dos irmãos terminar júnior
 * ao colapso do card que está saindo, não depois.
 */
const LAYOUT_TRANSITION_DURATION_MS = 520;

/**
 * `mb-3` do web. Fica NO CARD, não como `gap` da lista, porque a
 * altura dele anima junto no colapso — com `gap` o espaço não
 * encolheria e sobraria um buraco durante a saída. É por isso que o
 * web também põe no card (`className="mb-3 overflow-hidden last:mb-0"`)
 * em vez de espaçar pelo contêiner.
 */
export const ESPACO_ENTRE_CARDS = 12;
const RING_MAX_SCALE = 1.8;
/** Web usa 16px com o botão em tamanho "lg" (40px); este card usa "md" (32px) — reduzido na mesma proporção. */
const PARTICLE_DISTANCE = 13;
const PARTICLE_ANGLES = [0, 60, 120, 180, 240, 300].map((deg) => (deg * Math.PI) / 180);

type Phase = "idle" | "confirming" | "exiting";

/**
 * Partícula isolada num componente próprio só pra poder chamar
 * `useAnimatedStyle` uma vez por instância (6 elementos JSX via
 * `.map`, não 6 chamadas de hook dentro de um loop) — evita violar a
 * regra dos hooks mesmo com `PARTICLE_ANGLES` sendo uma constante fixa.
 */
function BurstParticle({ angle, progress }: { angle: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, Math.cos(angle) * PARTICLE_DISTANCE]) },
      { translateY: interpolate(progress.value, [0, 1], [0, Math.sin(angle) * PARTICLE_DISTANCE]) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.4]) },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.particle, style]} />;
}

/**
 * TASK-145 (a pedido, com exemplo visual) — só aparece em "Continue
 * assistindo" no modo LISTA, quando a série tem um próximo episódio
 * pendente já calculado (`nextEpisode`). Fora esse caso, quem chama
 * cai pro `MediaListRow` comum — ver `series/index.tsx`.
 *
 * `nextEpisode` aceita `null` (2026-09-04) — ver comentário grande em
 * `series/index.tsx` sobre por que o pai passou a renderizar este
 * componente sempre, mesmo sem episódio pendente: é ESTE componente
 * quem decide não mostrar nada (`return null`), só quando já não tem
 * nada pendente E a animação de confirmação/saída já terminou — assim
 * a animação nunca é cortada no meio por um refetch do pai.
 */
/**
 * DESTAQUE DE PRIORIDADE (2026-09-09, comparado no print — o card do
 * web tem uma faixa âmbar na lateral esquerda e o do mobile não tinha
 * nada).
 *
 * Portado de `ContinueWatchingCard.tsx` (web), que desenha DOIS
 * elementos, os dois com a mesma curva de opacidade por posição:
 *
 *   1. uma barrinha de 4px colada na borda esquerda (`w-1`), com
 *      acabamento "gel": um capuz branco no topo se fundindo com um
 *      degradê âmbar por baixo;
 *   2. um brilho horizontal de 128px (`w-32`) entrando no card, numa
 *      fração da mesma opacidade (`PRIORITY_GLOW_OPACITY_FACTOR`) — é
 *      fração de propósito, pra os dois caírem sempre juntos.
 *
 * A curva é a do web, literal: 1º card cheio, 2º metade, 3º um quarto,
 * 4º quase nada, 5º quase inexistente, 6º em diante zero.
 */
const OPACIDADE_DESTAQUE = [1, 0.5, 0.25, 0.08, 0.02] as const;
const FATOR_BRILHO_DESTAQUE = 0.35;
const LARGURA_BARRA_DESTAQUE = 4;
const LARGURA_BRILHO_DESTAQUE = 128;

function opacidadeDoDestaque(indice: number | undefined): number {
  if (indice === undefined || indice < 0) return 0;
  return OPACIDADE_DESTAQUE[indice] ?? 0;
}

/**
 * MEMOIZADO (2026-09-17, réplica do fix do Perfil — "pode replicar nas
 * outras abas") — este é o card mais renderizado da tela mais visitada
 * (Séries, aba "Minha Lista": um `ContinueWatchingListRow` por série em
 * "Continue assistindo" + "Faz um tempo que você não assiste"). Antes,
 * QUALQUER re-render de `SeriesHomeScreen` (tem vários hooks de busca
 * independentes — `useLibraryItems`/`useUpcomingEpisodes`/
 * `useDiscoverList`/`useViewModePreference`, cada um resolvendo em
 * momento diferente) reconciliava TODOS esses cards de novo, mesmo
 * quando nenhuma prop de um card específico tinha mudado de verdade.
 * Só funciona porque `item`/`nextEpisode` vêm de listas já memoizadas
 * (`useMemo`) no pai e `onMarkedWatched`/`onTransitionActiveChange`
 * agora são estáveis (`useCallback` no pai, ver `series/index.tsx` e a
 * correção de causa raiz em `useLibraryItems.ts`) — sem isso, o
 * `memo()` não seguraria nada (props "novas" a cada render).
 */
export const ContinueWatchingListRow = memo(function ContinueWatchingListRow({
  item,
  nextEpisode,
  onMarkedWatched,
  layoutActive = false,
  onTransitionActiveChange,
  priorityIndex,
}: {
  item: LibraryItem;
  nextEpisode: NextEpisodeToWatch | null;
  onMarkedWatched: () => void;
  /**
   * Espelha `layoutActive`/`onTransitionActiveChange` de
   * `ContinueWatchingCard.tsx` (web) — ver comentário grande em
   * `LAYOUT_TRANSITION_DURATION_MS`, acima. O pai (`series/index.tsx`)
   * agrega isso entre TODAS as linhas da lista (contador, não booleano
   * simples — mesmo raciocínio do web: mais de uma linha pode estar
   * animando ao mesmo tempo).
   */
  layoutActive?: boolean;
  onTransitionActiveChange?: (active: boolean) => void;
  /** Posição na lista (0 = primeiro). Decide a força do destaque âmbar — ver `OPACIDADE_DESTAQUE`. */
  priorityIndex?: number;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const posterUrl = tmdbImageUrl(item.posterPath, "w185");

  const [phase, setPhase] = useState<Phase>("idle");
  const [pulseKey, setPulseKey] = useState(0);
  /**
   * Congela o último episódio mostrado em `idle` — usado durante
   * `confirming`/`exiting` pra manter o card mostrando o episódio que
   * a pessoa ACABOU de marcar, mesmo que `nextEpisode` (prop, vinda do
   * pai) já tenha mudado ou virado `null` antes da animação terminar
   * (mesmo raciocínio do `frozenRef` no web).
   */
  const frozenRef = useRef<NextEpisodeToWatch | null>(nextEpisode);
  if (phase === "idle") frozenRef.current = nextEpisode;
  const display = phase === "idle" ? nextEpisode : frozenRef.current;

  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (layoutOffTimeoutRef.current) clearTimeout(layoutOffTimeoutRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, []);

  // Pulso do botão (~260ms, dispara de novo a cada toque via `pulseKey`).
  const pulseScale = useSharedValue(1);
  // Anel + partículas, progresso único (0→1) driblando as duas animações juntas (~420ms).
  const burstProgress = useSharedValue(0);
  // Tingimento verde sutil no fundo do card, ligado enquanto phase !== "idle".
  const tintOpacity = useSharedValue(0);
  // Colapso de altura/opacidade na saída — 1 = tamanho normal, 0 = colapsado.
  const collapseProgress = useSharedValue(1);
  const measuredHeight = useSharedValue(0);

  /**
   * CAUSA RAIZ DO "não tem a animação de slide pra cima, a tela
   * atualiza" (2026-09-09, a pedido).
   *
   * A ORDEM estava invertida. Aqui se desligava `layoutActive` e SÓ
   * DEPOIS se avisava o pai. Só que é o pai que tira o card da lista
   * (`refetchSilently`), e é o `layout={LinearTransition}` das linhas
   * IRMÃS que faz elas subirem suavemente quando isso acontece — e ele
   * só existe enquanto `layoutActive` estiver ligado. Resultado: no
   * instante em que a lista encolhia, a animação de layout já não
   * estava mais montada, e os cards de baixo davam um salto. Não era
   * animação faltando, era animação desligada cedo demais.
   *
   * O web não tem esse problema porque lá não há refetch nenhum: a
   * mutação atualiza o cache e o React re-renderiza sozinho, com o
   * `layoutActive` ainda ligado por mais `EXIT_DURATION_S`
   * (comentário literal de `ContinueWatchingCard.tsx`: "é esse colapso
   * que faz os cards de baixo deslizarem, então `layoutActive` precisa
   * continuar ligado até ele acabar").
   *
   * Agora avisa o pai PRIMEIRO e desliga depois de uma transição
   * inteira — tempo de o `LinearTransition` das irmãs rodar sobre a
   * lista já atualizada.
   */
  function handleExitComplete() {
    onMarkedWatched();
    desligarLayoutDepoisDaTransicao();
  }

  const layoutOffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function desligarLayoutDepoisDaTransicao() {
    if (layoutOffTimeoutRef.current) clearTimeout(layoutOffTimeoutRef.current);
    layoutOffTimeoutRef.current = setTimeout(() => {
      layoutOffTimeoutRef.current = null;
      onTransitionActiveChange?.(false);
    }, LAYOUT_TRANSITION_DURATION_MS);
  }

  function handleMarkWatched() {
    if (phase !== "idle" || !nextEpisode) return;
    // Decidido ANTES de marcar — depois do refetch do pai, `nextEpisode`
    // já pode ter mudado, então precisa capturar agora se este era o
    // último episódio pendente desta série.
    const wasLastPending = nextEpisode.additionalPendingCount === 0;

    hapticTick();
    setPhase("confirming");
    setPulseKey((k) => k + 1);
    // Ver comentário de `onTransitionActiveChange` na assinatura do componente, acima — avisa o pai assim que a animação começa, pra ele ligar `layoutActive` em todas as linhas da lista.
    onTransitionActiveChange?.(true);

    pulseScale.value = withSequence(
      withTiming(1.18, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) })
    );
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    tintOpacity.value = withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) });

    // Fogo e esquece (igual ao web: a escrita real roda em paralelo com
    // a animação, não trava a coreografia esperando a rede — timing
    // aqui embaixo precisa começar IMEDIATAMENTE, não só depois da
    // resposta do servidor, senão numa conexão lenta o botão fica
    // "preso" parecendo travado antes mesmo da coreografia começar).
    // CORREÇÃO (2026-08-26 — "motor resistente", ver seriesDetails.ts).
    toggleEpisodeWatched(nextEpisode.seriesId, nextEpisode.seasonNumber, nextEpisode.episodeNumber, false, nextEpisode.episodeId).catch(
      (error) => {
        console.error("[ContinueWatchingListRow] Falha ao marcar episódio assistido", error);
        // Só reverte se a coreografia ainda não tiver avançado sozinha
        // (a escrita falhou rápido, antes do CONFIRM_HOLD_MS). Uma
        // falha tardia (depois do card já ter saído/voltado a idle)
        // não tem mais o que desfazer visualmente — o próximo refetch
        // do pai mostra o estado real de qualquer forma.
        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current);
          holdTimeoutRef.current = null;
          tintOpacity.value = withTiming(0, { duration: 150 });
          setPhase("idle");
          onTransitionActiveChange?.(false);
        }
      }
    );

    holdTimeoutRef.current = setTimeout(() => {
      holdTimeoutRef.current = null;
      if (wasLastPending) {
        setPhase("exiting");
        collapseProgress.value = withTiming(0, { duration: EXIT_DURATION_MS, easing: Easing.inOut(Easing.ease) }, (finished) => {
          if (finished) scheduleOnRN(handleExitComplete);
        });
        tintOpacity.value = withTiming(0, { duration: EXIT_DURATION_MS * 0.7 });
      } else {
        tintOpacity.value = withTiming(0, { duration: 200 });
        setPhase("idle");
        // Só agora avisa o pai (a escrita já foi disparada acima, em
        // paralelo) — isto só pede pro pai buscar o próximo estado
        // real pra tela, depois que a coreografia visual já terminou.
        //
        // MESMA ORDEM do `handleExitComplete` (ver o comentário lá): o
        // refetch pode mudar a altura deste card (episódio com nome
        // mais longo, selo que aparece ou some) e mexer nos de baixo.
        // Desligar o layout antes disso fazia esse ajuste ser um salto.
        onMarkedWatched();
        desligarLayoutDepoisDaTransicao();
      }
    }, CONFIRM_HOLD_MS);
  }

  const buttonWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burstProgress.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(burstProgress.value, [0, 1], [0.6, RING_MAX_SCALE]) }],
  }));
  const tintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value,
  }));
  // `overflow: hidden` só entra durante o colapso — fora disso, deixa o
  // anel/partículas (que crescem PRA FORA do botão) sangrarem livremente,
  // mesmo bug já corrigido no web (comentário grande em ContinueWatchingCard.tsx).
  const collapseStyle = useAnimatedStyle(() => {
    const collapsing = collapseProgress.value < 1;
    return {
      opacity: interpolate(collapseProgress.value, [0, 1], [0, 1]),
      height: measuredHeight.value > 0 ? measuredHeight.value * collapseProgress.value : undefined,
      /* `mb-3` = 12 no web (`ContinueWatchingCard.tsx`); era `spacing.sm` = 8. */
      marginBottom: collapsing ? ESPACO_ENTRE_CARDS * collapseProgress.value : ESPACO_ENTRE_CARDS,
      overflow: collapsing ? "hidden" : "visible",
    };
  });

  const destaque = opacidadeDoDestaque(priorityIndex);

  if (!display) return null;

  /*
   * CORREÇÃO (2026-09-09, comparado no print): a TEMPORADA não estava
   * sendo preenchida com zero — saía "T1 | E24" contra "T01 | E24" do
   * web. O `ContinueWatchingCard.tsx` de lá monta
   * `T${String(seasonNumber).padStart(2,"0")} | E${...padStart(2,"0")}`,
   * ou seja os DOIS números com dois dígitos.
   */
  const code = `T${String(display.seasonNumber).padStart(2, "0")} | E${String(display.episodeNumber).padStart(2, "0")}`;
  const badge = display.badge ? { label: t(BADGE_LABEL_KEY[display.badge]), ...BADGE_COLORS[display.badge] } : null;

  return (
    <Animated.View
      style={collapseStyle}
      layout={layoutActive ? LinearTransition.duration(LAYOUT_TRANSITION_DURATION_MS).easing(Easing.inOut(Easing.ease)) : undefined}
      onLayout={(e) => {
        if (phase === "idle") measuredHeight.value = e.nativeEvent.layout.height;
      }}
    >
      <Glass style={styles.row} variant="card">
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tintStyle]} />
        {destaque > 0 && (
          <>
            {/* O brilho lateral entrando no card (o `w-32` do web). */}
            <LinearGradient
              pointerEvents="none"
              colors={[`rgba(240,169,79,${destaque * FATOR_BRILHO_DESTAQUE})`, "rgba(240,169,79,0)"]}
              locations={[0, 0.6]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.destaqueBrilho}
            />
            {/* A barrinha âmbar (o `w-1` do web) — degradê de baixo. */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                `rgba(240,169,79,${destaque * 0.75})`,
                `rgba(240,169,79,${destaque})`,
                `rgba(240,169,79,${destaque})`,
                `rgba(240,169,79,${destaque * 0.75})`,
              ]}
              locations={[0, 0.12, 0.88, 1]}
              style={styles.destaqueBarra}
            />
            {/* O capuz branco do acabamento "gel" — camada de cima da barrinha. */}
            <LinearGradient
              pointerEvents="none"
              colors={[`rgba(255,255,255,${destaque * 0.55})`, "rgba(255,255,255,0)"]}
              locations={[0, 0.2]}
              style={styles.destaqueBarra}
            />
          </>
        )}

        {/*
          O CARD INTEIRO leva ao EPISÓDIO (2026-09-09, a pedido — "nos
          cards o título tem link que vai pra a série direto, diferente
          de clicar no card vai pra o episódio").
        
          No web o card é um `<Link>` pro episódio e o título é um link
          ANINHADO pra série (`ContinueWatchingCard.tsx`). Aqui só o
          pôster, o título e o código do episódio respondiam ao toque —
          o resto do card não fazia nada.
        
          Em vez de embrulhar o conteúdo (o que mudaria o layout do
          `Glass`, que é quem tem o `flexDirection`/`gap`/`padding`), o
          alvo é uma camada absoluta ATRÁS de tudo: os `Pressable` de
          dentro ficam por cima e continuam levando à série; onde não há
          nada interativo, o toque cai nesta. `zIndex` não entra na
          conta — é a ordem de renderização que decide.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => router.push(`/episodes/${item.id}/${display.seasonNumber}/${display.episodeNumber}`)}
        />
        <Pressable style={styles.posterWrapper} onPress={() => router.push(`/series/${item.id}`)}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
          ) : (
            <Feather name="film" size={20} color={colors.muted} />
          )}
        </Pressable>

        <View style={styles.info}>
          <Pressable style={styles.seriesPill} onPress={() => router.push(`/series/${item.id}`)}>
            <Text numberOfLines={1} style={styles.seriesPillText}>
              {item.title.toUpperCase()}
            </Text>
            <Feather name="chevron-right" size={12} color={colors.text} />
          </Pressable>

          <Pressable onPress={() => router.push(`/episodes/${item.id}/${display.seasonNumber}/${display.episodeNumber}`)}>
            <View style={styles.codeRow}>
              <Text style={styles.code}>{code}</Text>
              {display.additionalPendingCount > 0 && (
                /* No web o `+N` tem fundo: `rounded bg-primary/15 px-1 text-[10px] font-bold text-primary`. Aqui era texto solto. */
                <View style={styles.plusBadgeBox}>
                  <Text style={styles.plusBadge}>+{display.additionalPendingCount}</Text>
                </View>
              )}
            </View>
            <Text numberOfLines={1} variant="muted" style={styles.episodeName}>
              {display.name}
            </Text>
          </Pressable>

          {/* A PEDIDO (2026-09-04, fidelidade ao web — mesma decisão
              documentada em ContinueWatchingCard.tsx) — durante a
              confirmação, o selo NOVO/MAIS RECENTE/PREMIERE dá lugar a
              um selo verde "✓ Assistido" (chave `episode.watched`, já
              existente nas 3 línguas). Volta pro selo normal (ou
              nenhum) assim que `phase` volta a `idle`. */}
          {phase !== "idle" ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
              <Text style={[styles.statusBadgeText, { color: colors.background }]}>✓ {t("episode.watched")}</Text>
            </View>
          ) : (
            !!badge && (
              <View style={[styles.statusBadge, { backgroundColor: badge.background }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            )
          )}
        </View>

        <Animated.View style={[styles.buttonSlot, buttonWrapperStyle]}>
          <EpisodeWatchedButton
            watched={phase !== "idle"}
            onPress={handleMarkWatched}
            disabled={phase !== "idle"}
            size="md"
            confirmColor={colors.success}
          />

          {pulseKey > 0 && (
            <>
              {/* Anel se expandindo a partir do botão no toque — efeito "ripple"/sonar, feedback de toque, não gamificação. */}
              <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
              {/* Partículas (6 bolinhas, ~420ms) — só um respingo discreto, não confete grande/colorido. */}
              <View pointerEvents="none" style={styles.particleField}>
                {PARTICLE_ANGLES.map((angle, i) => (
                  <BurstParticle key={i} angle={angle} progress={burstProgress} />
                ))}
              </View>
            </>
          )}
        </Animated.View>
      </Glass>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-09, "implementar em todas as telas") — era um
   * cartão SÓLIDO (`colors.surface` + `colors.border`). O
   * `ContinueWatchingCard.tsx` do web usa vidro: `backdrop-blur-[18px]` com
   * `radial-gradient(... rgba(255,255,255,0.17) ...), rgba(255,255,255,0.10)`
   * — exatamente a receita `card` do `Glass` (`glassVariants`, em
   * `lib/theme.ts`). `borderWidth`/`borderColor`/`backgroundColor`
   * saíram daqui porque quem passa a desenhá-los é o `Glass`; o que fica
   * é só layout: direção, respiro, raio e padding.
   */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    /* `rounded-2xl` = 16 no web (`ContinueWatchingCard.tsx`); estava `radius.md` = 10. */
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  tint: {
    borderRadius: radius.md,
  },
  posterWrapper: {
    /**
     * AUMENTO (2026-09-03, auditoria "implementar tudo que não
     * envolve redesign") — mesma proporção 2:3 do pôster, só maior:
     * 56×80 → 80×120, batendo com o tamanho atual do card equivalente
     * no web (`ContinueWatchingCard.tsx`, `CARD_POSTER_SIZE`, depois
     * de duas rodadas de aumento — 96×64 → 108×72 → 120×80, mesma
     * proporção). O mobile nunca tinha recebido nenhuma das duas.
     */
    width: 80,
    height: 120,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  /**
   * CORREÇÃO (2026-09-09, a pedido — "ao redor dos nomes das séries tem
   * um anel; no mobile você colocou um anel escuro, deixe igual ao
   * web").
   *
   * O anel era `colors.border`, um cinza ESCURO. No web
   * (`ContinueWatchingCard.tsx`) esta pílula é
   *
   *     inline-flex items-center gap-1 rounded-full border border-white/15
   *     px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-text
   *
   * ou seja borda BRANCA a 15%. Conferindo o resto da classe junto,
   * mais quatro valores estavam fora: respiro 8/3 contra 10/4, corpo 10
   * contra 11, e faltava o `tracking-wide`.
   */
  seriesPill: {
    flexDirection: "row",
    alignItems: "center",
    /* `gap-1` = 4. */
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.full,
    /* `px-2.5` = 10, `py-1` = 4. */
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  seriesPillText: {
    /* `text-[11px] font-bold`; `tracking-wide` = 0.025em ≈ 0.275 em 11px. */
    fontSize: 11,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    letterSpacing: 0.275,
    color: colors.text,
    flexShrink: 1,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  code: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  /** Ver `OPACIDADE_DESTAQUE` — a barrinha de 4px colada na esquerda; o raio do card já a recorta (`overflow: hidden` do `Glass`). */
  destaqueBarra: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: LARGURA_BARRA_DESTAQUE,
  },
  /** O brilho de 128px entrando no card — nunca ilumina o card inteiro, por isso largura fixa. */
  destaqueBrilho: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: LARGURA_BRILHO_DESTAQUE,
  },
  /** `bg-primary/15 rounded px-1` do web — `rounded` do Tailwind = 4px. */
  plusBadgeBox: {
    backgroundColor: "rgba(232,163,61,0.15)",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  plusBadge: {
    /* `text-[10px]` no web; estava 11. */
    fontSize: 10,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    color: colors.primary,
  },
  episodeName: {
    fontSize: 12,
    marginTop: 1,
  },
  /**
   * CORREÇÃO (2026-09-09, a pedido — "o badge NOVO/MAIS RECENTE no web
   * é redondo"). Era `borderRadius: 4`, um retângulo de canto suave. No
   * web (`ContinueWatchingCard.tsx`) o selo é
   *
   *     inline-block rounded-full px-2 py-0.5 text-[9px]
   *     font-semibold tracking-wide
   *
   * ou seja CÁPSULA. Junto com o raio vieram os outros quatro valores,
   * que também estavam fora: 7/3 de respiro contra 8/2, corpo 10
   * contra 9, peso 800 contra 600.
   *
   * NÃO vale pro selo do card de "Em breve"
   * (`UpcomingEpisodeCard.tsx`): lá o web usa `rounded px-1 py-px`
   * mesmo — canto de 4px —, e aquele já bate.
   */
  statusBadge: {
    alignSelf: "flex-start",
    /* `rounded-full`: raio grande o bastante pra virar cápsula em qualquer altura. */
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    fontFamily: fontFamily[600],
    /* `tracking-wide` = 0.025em, que em 9px dá ~0.23. */
    letterSpacing: 0.23,
  },
  buttonSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.success,
  },
  particleField: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
});
