import { useMemo, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { SeasonWithEpisodes } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { isEpisodeWatchedSync, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import { hapticTick } from "@/lib/haptics";
import { Text, Glass } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { OptionSheet, type OptionSheetAction } from "@/components/settings/OptionSheet";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

type Dialog = { type: "mark-previous"; episodeNumber: number } | { type: "watched-actions"; episodeNumber: number } | { type: "season-toggle" } | null;

/**
 * TASK-113/115 — porta completa de `SeasonAccordion.tsx` do web:
 * marcar temporada inteira, "marcar episódios anteriores?",
 * "Reassistido", e (TASK-115) tocar no texto/imagem do episódio abre
 * a tela de Detalhes do Episódio — só o botão redondo continua
 * marcando/desmarcando direto, sem navegar.
 */
export function SeasonAccordion({
  seriesId,
  season,
  watched,
  watchedEpisodeIds,
  busy,
  onToggleEpisode,
  onMarkMany,
  onUnmarkSeason,
  onRewatch,
  defaultOpen = false,
}: {
  seriesId: number;
  season: SeasonWithEpisodes;
  watched: Set<WatchedEpisodeKey>;
  /** CORREÇÃO (2026-08-26 — "motor resistente") — opcional, ver `isEpisodeWatchedSync` (seriesDetails.ts). */
  watchedEpisodeIds?: Set<number>;
  busy: boolean;
  /** `episodeId` opcional (2026-08-26, "motor resistente" — ver seriesDetails.ts) — ID fixo da TMDB, gravado junto quando disponível. */
  onToggleEpisode: (seasonNumber: number, episodeNumber: number, episodeId?: number) => void;
  onMarkMany: (episodes: { seasonNumber: number; episodeNumber: number; episodeId?: number }[]) => void;
  onUnmarkSeason: (seasonNumber: number) => void;
  onRewatch: (seasonNumber: number, episodeNumber: number) => void;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [dialog, setDialog] = useState<Dialog>(null);

  const watchedCount = season.episodes.filter((ep) =>
    isEpisodeWatchedSync(watched, ep.seasonNumber, ep.episodeNumber, ep.id, watchedEpisodeIds)
  ).length;
  const allWatched = season.episodes.length > 0 && watchedCount === season.episodes.length;
  const percentage = season.episodes.length > 0 ? Math.round((watchedCount / season.episodes.length) * 100) : 0;

  const sortedEpisodes = useMemo(() => [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber), [season.episodes]);

  function handleEpisodePress(episodeNumber: number, isWatched: boolean) {
    if (isWatched) {
      hapticTick();
      setDialog({ type: "watched-actions", episodeNumber });
      return;
    }

    const hasUnwatchedBefore = sortedEpisodes.some(
      (ep) =>
        ep.episodeNumber < episodeNumber &&
        !isEpisodeWatchedSync(watched, season.seasonNumber, ep.episodeNumber, ep.id, watchedEpisodeIds)
    );
    if (hasUnwatchedBefore) {
      hapticTick();
      setDialog({ type: "mark-previous", episodeNumber });
    } else {
      // Sem haptic aqui de propósito — `onToggleEpisode` é o `toggle`
      // do hook `useWatchedEpisodes`, que já vibra sozinho. Vibrar
      // aqui também duplicaria o toque num único gesto.
      // CORREÇÃO (2026-08-26 — "motor resistente") — ID fixo da TMDB, já disponível em `sortedEpisodes`.
      const episodeId = sortedEpisodes.find((ep) => ep.episodeNumber === episodeNumber)?.id;
      onToggleEpisode(season.seasonNumber, episodeNumber, episodeId);
    }
  }

  function markUpToEpisode(episodeNumber: number) {
    hapticTick();
    const episodes = sortedEpisodes
      .filter((ep) => ep.episodeNumber <= episodeNumber)
      .map((ep) => ({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, episodeId: ep.id }));
    onMarkMany(episodes);
    setDialog(null);
  }

  function markOnlyThisEpisode(episodeNumber: number) {
    const episodeId = sortedEpisodes.find((ep) => ep.episodeNumber === episodeNumber)?.id;
    onToggleEpisode(season.seasonNumber, episodeNumber, episodeId);
    setDialog(null);
  }

  function confirmSeasonToggle() {
    hapticTick();
    if (allWatched) {
      onUnmarkSeason(season.seasonNumber);
    } else {
      onMarkMany(season.episodes.map((ep) => ({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, episodeId: ep.id })));
    }
    setDialog(null);
  }

  const dialogProps = buildDialogProps(
    dialog,
    {
      onMarkUpTo: markUpToEpisode,
      onMarkOnlyThis: markOnlyThisEpisode,
      onUnwatch: (episodeNumber) => {
        onToggleEpisode(season.seasonNumber, episodeNumber);
        setDialog(null);
      },
      onRewatch: (episodeNumber) => {
        onRewatch(season.seasonNumber, episodeNumber);
        setDialog(null);
      },
      onConfirmSeasonToggle: confirmSeasonToggle,
      allWatched,
    },
    t
  );

  return (
    <Glass style={styles.wrapper} variant="light">
      {/*
        PORTE DO WEB (2026-09-09, comparado no print) — o cabeçalho tinha
        só "12/12 assistidos" em 11px. No web (`SeasonAccordion.tsx` +
        `SeasonProgress.tsx`) ele tem TRÊS coisas: a contagem à
        esquerda, a PORCENTAGEM à direita na cor da categoria, e uma
        BARRA DE PROGRESSO embaixo das duas — nada disso existia aqui.
        A ordem dos dois controles da direita também estava trocada: no
        web o chevron vem PRIMEIRO (ele faz parte do botão que abre o
        acordeão) e o círculo de "marcar temporada" vem depois, solto.
      */}
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => setOpen((v) => !v)}>
          <View style={styles.headerText}>
            <Text style={styles.seasonName}>{season.name}</Text>
            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <Text variant="muted" style={styles.progressLabel}>
                  {t("seriesHome.episodeProgress", { watched: watchedCount, total: season.episodes.length })}
                </Text>
                <Text style={styles.progressPercent}>{percentage}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percentage}%` }]} />
              </View>
            </View>
          </View>
          {/* `transition-transform` + `rotate-180` do web — o web gira o MESMO ícone, não troca de ícone. */}
          <Feather
            name="chevron-down"
            size={16}
            color={colors.muted}
            style={open ? styles.chevronAberto : undefined}
          />
        </Pressable>

        {season.episodes.length > 0 && (
          <Pressable
            hitSlop={8}
            disabled={busy}
            onPress={() => setDialog({ type: "season-toggle" })}
          >
            {/*
              CORREÇÃO (2026-09-09, ampliado no print) — o `check-circle`
              do Feather é um círculo ABERTO, com o traço interrompido no
              canto e o check saindo por cima dele. O web usa o
              `CheckCircle2` do lucide: círculo FECHADO com o check
              inteiro DENTRO. São dois desenhos diferentes. O
              `check-circle-outline` do MaterialCommunityIcons é o
              equivalente do lucide; o vazio vem da mesma família pra os
              dois estados terem o mesmo traço.
            */}
            <MaterialCommunityIcons
              name={allWatched ? "check-circle-outline" : "circle-outline"}
              size={24}
              color={allWatched ? colors.primary : colors.muted}
            />
          </Pressable>
        )}
      </View>

      {open && (
        <View style={styles.episodeList}>
          {sortedEpisodes.map((episode) => {
            const isWatched = isEpisodeWatchedSync(watched, episode.seasonNumber, episode.episodeNumber, episode.id, watchedEpisodeIds);
            const stillUrl = tmdbImageUrl(episode.stillPath, "w300"); // o web usa `w300`; a miniatura tem 96dp (252px reais), `w185` ficava macia
            return (
              /*
                PORTE DO WEB (2026-09-09, comparado no print) — cada
                episódio era uma LINHA nua, separada da seguinte por um
                fio, dentro de um bloco sem recheio. No web
                (`EpisodeCard.tsx`) cada episódio é um CARD DE VIDRO
                próprio — `rounded-2xl border border-white/10 p-2
                backdrop-blur-[18px] backdrop-saturate-[180%]` + brilho
                0.17 / base 0.10, a receita `card` do `Glass` — com 8 de
                distância pro card seguinte.
              */
              <Glass key={episode.id} style={styles.episodeCard}>
                <Pressable
                  style={styles.episodeTouchArea}
                  onPress={() => router.push(`/episodes/${seriesId}/${season.seasonNumber}/${episode.episodeNumber}`)}
                >
                  <View style={styles.stillWrapper}>
                    {stillUrl ? (
                      <Image source={{ uri: stillUrl }} style={styles.still} contentFit="cover" />
                    ) : (
                      <Text numberOfLines={2} variant="muted" style={styles.stillFallback}>
                        {t("episode.noImage")}
                      </Text>
                    )}
                  </View>
                  <View style={styles.episodeInfo}>
                    {/*
                      O número saiu de dentro do título ("1. O Caipira...")
                      e virou uma linha PRÓPRIA acima dele, em cinza —
                      é como o web mostra ("Episódio 1"), e é o que faz o
                      título do episódio ganhar destaque de verdade.
                    */}
                    <Text variant="muted" style={styles.episodeNumber}>
                      {t("episode.numberLabel", { number: episode.episodeNumber })}
                    </Text>
                    <Text numberOfLines={1} style={styles.episodeTitle}>
                      {episode.name}
                    </Text>
                    {/* Faltava a DURAÇÃO: o web mostra "24 min · 2025-04-05", o mobile só a data. */}
                    <Text variant="muted" style={styles.episodeMeta}>
                      {[episode.runtimeMinutes ? `${episode.runtimeMinutes} min` : null, episode.airDate ?? null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </Pressable>
                <EpisodeWatchedButton watched={isWatched} onPress={() => handleEpisodePress(episode.episodeNumber, isWatched)} />
              </Glass>
            );
          })}
        </View>
      )}

      {dialogProps && <OptionSheet {...dialogProps} onDismiss={() => setDialog(null)} />}
    </Glass>
  );
}

/** Monta título/mensagem/ações de cada um dos 3 diálogos possíveis — mantém o corpo do componente mais legível. */
function buildDialogProps(
  dialog: Dialog,
  handlers: {
    onMarkUpTo: (episodeNumber: number) => void;
    onMarkOnlyThis: (episodeNumber: number) => void;
    onUnwatch: (episodeNumber: number) => void;
    onRewatch: (episodeNumber: number) => void;
    onConfirmSeasonToggle: () => void;
    allWatched: boolean;
  },
  t: TFunction
): { title: string; message?: string; actions: OptionSheetAction[] } | null {
  if (!dialog) return null;

  if (dialog.type === "mark-previous") {
    return {
      title: t("episode.markPreviousTitle"),
      message: t("episode.markPreviousMessage"),
      actions: [
        { label: t("common.yes"), active: true, onPress: () => handlers.onMarkUpTo(dialog.episodeNumber) },
        { label: t("common.no"), onPress: () => handlers.onMarkOnlyThis(dialog.episodeNumber) },
      ],
    };
  }

  if (dialog.type === "watched-actions") {
    return {
      title: t("episode.markAs"),
      actions: [
        { label: t("episode.notWatchedAction"), onPress: () => handlers.onUnwatch(dialog.episodeNumber) },
        { label: t("episode.rewatchedAction"), onPress: () => handlers.onRewatch(dialog.episodeNumber) },
      ],
    };
  }

  // season-toggle
  return {
    title: handlers.allWatched ? t("episode.unmarkSeasonTitle") : t("episode.markSeasonTitle"),
    message: handlers.allWatched ? t("episode.unmarkSeasonMessage") : t("episode.markSeasonMessage"),
    actions: [{ label: t("common.confirm"), active: true, onPress: handlers.onConfirmSeasonToggle }],
  };
}

/**
 * A LUZ QUE O DESFOQUE DO MOBILE NÃO TEM DE ONDE PUXAR (2026-09-09,
 * medido no print do usuário, não estimado).
 *
 * Medições, no mesmo lugar dos dois lados — o vão ENTRE dois cards
 * (que mostra o fundo do acordeão) e o corpo do card, fora do brilho
 * de canto:
 *
 *                 fundo do acordeão      card do episódio
 *     web            (24, 36, 49)          (58,  87, 111)
 *     mobile         (25, 35, 47)          (40,  60,  80)
 *
 * O FUNDO bate nos dois — então o vidro do acordeão está certo. E o
 * card do mobile bate, até o nível de ruído, com o que a receita
 * `card` prevê a partir desse fundo: `(L + 1.8·(C−L))·0.9 + 25.5` =
 * (42, 58, 77). Ou seja a receita está aplicada corretamente; o que
 * falta não é calibração dela, é LUZ CHEGANDO.
 *
 * De onde vem essa luz no web: o `backdrop-filter` de raio 18px do
 * card amostra a PÁGINA JÁ COMPOSTA num raio de 18px em volta — e ali
 * estão o vidro do acordeão e os cards vizinhos, todos claros. A pilha
 * inteira se auto-ilumina. No mobile o `blurTarget` é a
 * `BlurTargetView` do `GlassTargetProvider` da tela, que contém APENAS
 * o campo de manchas sobre a base escura: os cards vizinhos e o vidro
 * do acordeão não estão lá dentro, então não existe nada de claro para
 * o desfoque puxar. Não dá pra colocá-los no alvo — um `BlurView`
 * dentro da `BlurTargetView` que ele desfoca é o ciclo que trava o
 * app (SIGSEGV, ver `components/ui/Glass.tsx`).
 *
 * Então a luz entra como camada, no lugar exato onde ela entraria: o
 * `Glass` desenha o `backgroundColor` do chamador ENTRE o desfoque e a
 * base da receita. O valor abaixo é o que leva o desfoque saturado
 * medido (18, 36, 58) até (36, 68, 95) — que, depois do branco 10% da
 * receita, dá exatamente o (58, 87, 111) do web.
 *
 * LIMITE CONHECIDO, registrado de propósito: isto é uma camada de cor
 * FIXA, e a luz do web acompanha a mancha de fundo. Onde a mancha for
 * mais fraca que neste print, o card vai ficar um pouco mais azul que
 * o do web. A correção sem esse limite exigiria o alvo de desfoque
 * incluir a própria pilha de cards, que é justamente o ciclo proibido.
 */
const LUZ_DA_PILHA = "rgba(90,165,207,0.25)";

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-09) — era um bloco SÓLIDO. O
   * `SeasonAccordion.tsx` do web usa
   * `rounded-lg border border-white/10 backdrop-blur-[10px] backdrop-saturate-[160%]`,
   * que é a receita `light` do `Glass` (desfoque 10px, brilho 0.13,
   * base 0.06 — e a saturação 1.6 que essa receita já carrega).
   * Borda e fundo saíram daqui porque quem desenha agora é o `Glass`.
   */
  wrapper: {
    borderRadius: 8, // `rounded-lg` (era `radius.md` = 10)
    overflow: "hidden",
  },
  /** `flex w-full items-center gap-3 px-4 py-3` = 12 entre as partes, 16/12 de recheio (a vertical era 16). */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  /** No web o chevron faz parte do BOTÃO que abre o acordeão, não é um ícone solto ao lado. */
  headerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  /** `text-sm font-medium` = 14/500 (era `variant="label"` = 14/600). */
  seasonName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  chevronAberto: {
    transform: [{ rotate: "180deg" }],
  },
  /** `mt-1.5 w-full` do `SeasonProgress.tsx`. */
  progressBlock: {
    marginTop: 6,
    width: "100%",
  },
  /** `mb-1 flex items-center justify-between text-xs text-muted`. */
  progressLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: fontSize.xs,
  },
  /** No web a porcentagem sai na cor da categoria da série (`barColorClassToTextColorClass`); aqui a categoria não chega neste componente, então usa a cor padrão dela, que é a primária — o mesmo `bg-primary` que o web assume por omissão. */
  progressPercent: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  /** `h-1.5 w-full overflow-hidden rounded-full bg-border` (`ProgressBar.tsx`). */
  progressTrack: {
    height: 6,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  /** `space-y-2 border-t border-border p-3` = 8 entre os cards, 12 de recheio (não tinha recheio nenhum). */
  episodeList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
    gap: spacing.sm,
  },
  /** `rounded-2xl ... p-2` com `gap-3` — borda e fundo vêm do `Glass`. */
  episodeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg, // `rounded-2xl`
    padding: spacing.sm,
    /* O `Glass` extrai o `backgroundColor` do estilo e o desenha ENTRE o desfoque e a base da receita — ver `LUZ_DA_PILHA`, acima. */
    backgroundColor: LUZ_DA_PILHA,
  },
  episodeTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  /** `h-14 w-24 rounded-md bg-background` = 96 × 56, canto 6 (era 64 × 40). */
  stillWrapper: {
    width: 96,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  still: {
    width: "100%",
    height: "100%",
  },
  /** `text-[10px] text-muted` centralizado — o web escreve "Sem imagem", não desenha um ícone. */
  stillFallback: {
    fontSize: 10,
    textAlign: "center",
  },
  /** Sem `gap`: no web são três `<p>` seguidos (margem zero), e só o terceiro tem `mt-0.5`. */
  episodeInfo: {
    flex: 1,
    minWidth: 0,
  },
  /** `text-xs text-muted`. */
  episodeNumber: {
    fontSize: fontSize.xs,
  },
  /** `truncate text-sm font-medium` = 14/500 (era 600). */
  episodeTitle: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  /** `mt-0.5 text-xs text-muted` = 2 de topo, 12px (era 11 e sem margem). */
  episodeMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
  },
});
