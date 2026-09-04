import { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
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
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

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
export function ContinueWatchingListRow({
  item,
  nextEpisode,
  onMarkedWatched,
}: {
  item: LibraryItem;
  nextEpisode: NextEpisodeToWatch | null;
  onMarkedWatched: () => void;
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

  function handleExitComplete() {
    onMarkedWatched();
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
        onMarkedWatched();
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
      marginBottom: collapsing ? spacing.sm * collapseProgress.value : spacing.sm,
      overflow: collapsing ? "hidden" : "visible",
    };
  });

  if (!display) return null;

  const code = `T${display.seasonNumber} | E${String(display.episodeNumber).padStart(2, "0")}`;
  const badge = display.badge ? { label: t(BADGE_LABEL_KEY[display.badge]), ...BADGE_COLORS[display.badge] } : null;

  return (
    <Animated.View
      style={collapseStyle}
      onLayout={(e) => {
        if (phase === "idle") measuredHeight.value = e.nativeEvent.layout.height;
      }}
    >
      <View style={styles.row}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tintStyle]} />

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
              {display.additionalPendingCount > 0 && <Text style={styles.plusBadge}>+{display.additionalPendingCount}</Text>}
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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
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
  seriesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  seriesPillText: {
    fontSize: 10,
    fontWeight: "700",
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
  plusBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  episodeName: {
    fontSize: 12,
    marginTop: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
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
