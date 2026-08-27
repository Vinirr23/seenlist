import { useMemo, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { SeasonWithEpisodes } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { isEpisodeWatchedSync, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import { hapticTick } from "@/lib/haptics";
import { Text } from "@/components/ui";
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
    <View style={styles.wrapper}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)}>
        <View style={styles.headerText}>
          <Text variant="label">{season.name}</Text>
          <Text variant="muted" style={styles.headerCount}>
            {t("episode.watchedCountLabel", { watched: watchedCount, total: season.episodes.length })}
          </Text>
        </View>

        {season.episodes.length > 0 && (
          <Pressable
            hitSlop={8}
            disabled={busy}
            onPress={(e) => {
              e.stopPropagation();
              setDialog({ type: "season-toggle" });
            }}
          >
            <Feather name={allWatched ? "check-circle" : "circle"} size={22} color={allWatched ? colors.primary : colors.muted} />
          </Pressable>
        )}

        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>

      {open && (
        <View style={styles.episodeList}>
          {sortedEpisodes.map((episode) => {
            const isWatched = isEpisodeWatchedSync(watched, episode.seasonNumber, episode.episodeNumber, episode.id, watchedEpisodeIds);
            const stillUrl = tmdbImageUrl(episode.stillPath, "w185");
            return (
              <View key={episode.id} style={styles.episodeRow}>
                <Pressable
                  style={styles.episodeTouchArea}
                  onPress={() => router.push(`/episodes/${seriesId}/${season.seasonNumber}/${episode.episodeNumber}`)}
                >
                  <View style={styles.stillWrapper}>
                    {stillUrl ? (
                      <Image source={{ uri: stillUrl }} style={styles.still} contentFit="cover" />
                    ) : (
                      <Feather name="film" size={16} color={colors.muted} />
                    )}
                  </View>
                  <View style={styles.episodeInfo}>
                    <Text numberOfLines={1} style={styles.episodeTitle}>
                      {episode.episodeNumber}. {episode.name}
                    </Text>
                    {!!episode.airDate && (
                      <Text variant="muted" style={styles.episodeDate}>
                        {episode.airDate}
                      </Text>
                    )}
                  </View>
                </Pressable>
                <EpisodeWatchedButton watched={isWatched} onPress={() => handleEpisodePress(episode.episodeNumber, isWatched)} />
              </View>
            );
          })}
        </View>
      )}

      {dialogProps && <OptionSheet {...dialogProps} onDismiss={() => setDialog(null)} />}
    </View>
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

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerCount: {
    fontSize: 11,
  },
  episodeList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  episodeTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  stillWrapper: {
    width: 64,
    height: 40,
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
  episodeInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  episodeTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  episodeDate: {
    fontSize: 11,
  },
});
