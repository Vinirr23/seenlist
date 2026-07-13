import { useMemo, useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { SeasonWithEpisodes } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { episodeKey, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import { Text } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { OptionSheet, type OptionSheetAction } from "@/components/settings/OptionSheet";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

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
  busy: boolean;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onMarkMany: (episodes: { seasonNumber: number; episodeNumber: number }[]) => void;
  onUnmarkSeason: (seasonNumber: number) => void;
  onRewatch: (seasonNumber: number, episodeNumber: number) => void;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [dialog, setDialog] = useState<Dialog>(null);

  const watchedCount = season.episodes.filter((ep) => watched.has(episodeKey(ep.seasonNumber, ep.episodeNumber))).length;
  const allWatched = season.episodes.length > 0 && watchedCount === season.episodes.length;

  const sortedEpisodes = useMemo(() => [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber), [season.episodes]);

  function handleEpisodePress(episodeNumber: number, isWatched: boolean) {
    if (isWatched) {
      setDialog({ type: "watched-actions", episodeNumber });
      return;
    }

    const hasUnwatchedBefore = sortedEpisodes.some(
      (ep) => ep.episodeNumber < episodeNumber && !watched.has(episodeKey(season.seasonNumber, ep.episodeNumber))
    );
    if (hasUnwatchedBefore) {
      setDialog({ type: "mark-previous", episodeNumber });
    } else {
      onToggleEpisode(season.seasonNumber, episodeNumber);
    }
  }

  function markUpToEpisode(episodeNumber: number) {
    const episodes = sortedEpisodes.filter((ep) => ep.episodeNumber <= episodeNumber).map((ep) => ({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber }));
    onMarkMany(episodes);
    setDialog(null);
  }

  function markOnlyThisEpisode(episodeNumber: number) {
    onToggleEpisode(season.seasonNumber, episodeNumber);
    setDialog(null);
  }

  function confirmSeasonToggle() {
    if (allWatched) {
      onUnmarkSeason(season.seasonNumber);
    } else {
      onMarkMany(season.episodes.map((ep) => ({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber })));
    }
    setDialog(null);
  }

  const dialogProps = buildDialogProps(dialog, {
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
  });

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)}>
        <View style={styles.headerText}>
          <Text variant="label">{season.name}</Text>
          <Text variant="muted" style={styles.headerCount}>
            {watchedCount}/{season.episodes.length} assistidos
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
            const isWatched = watched.has(episodeKey(episode.seasonNumber, episode.episodeNumber));
            const stillUrl = tmdbImageUrl(episode.stillPath, "w185");
            return (
              <View key={episode.id} style={styles.episodeRow}>
                <Pressable
                  style={styles.episodeTouchArea}
                  onPress={() => router.push(`/episodes/${seriesId}/${season.seasonNumber}/${episode.episodeNumber}`)}
                >
                  <View style={styles.stillWrapper}>
                    {stillUrl ? (
                      <Image source={{ uri: stillUrl }} style={styles.still} resizeMode="cover" />
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
  }
): { title: string; message?: string; actions: OptionSheetAction[] } | null {
  if (!dialog) return null;

  if (dialog.type === "mark-previous") {
    return {
      title: "Marcar episódios anteriores?",
      message: "Você deseja marcar também todos os episódios anteriores como assistidos?",
      actions: [
        { label: "Sim", active: true, onPress: () => handlers.onMarkUpTo(dialog.episodeNumber) },
        { label: "Não", onPress: () => handlers.onMarkOnlyThis(dialog.episodeNumber) },
      ],
    };
  }

  if (dialog.type === "watched-actions") {
    return {
      title: "Marcar como...",
      actions: [
        { label: "Não assistido", onPress: () => handlers.onUnwatch(dialog.episodeNumber) },
        { label: "Reassistido", onPress: () => handlers.onRewatch(dialog.episodeNumber) },
      ],
    };
  }

  // season-toggle
  return {
    title: handlers.allWatched ? "Desmarcar toda a temporada?" : "Marcar temporada como assistida?",
    message: handlers.allWatched
      ? "Todos os episódios desta temporada voltarão para não assistido."
      : "Todos os episódios desta temporada serão marcados como assistidos.",
    actions: [{ label: "Confirmar", active: true, onPress: handlers.onConfirmSeasonToggle }],
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
