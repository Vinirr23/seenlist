import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View, ActivityIndicator, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fetchPendingEpisodesForSeries, type PendingEpisode } from "@/lib/nextEpisodeToWatch";
import { toggleEpisodeWatched, markEpisodesWatched } from "@/lib/seriesDetails";
import { hapticTick } from "@/lib/haptics";
import { Text, Glass } from "@/components/ui";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, scrim, fontSize, fontFamily } from "@/lib/theme";

/**
 * A PEDIDO (2026-10-02 — "adiciona no card que tem mais episódios a
 * serem assistidos, alguma forma de abrir uma lista ali mesmo com o
 * restante dos episódios pra melhorar o fluxo") — mockup com 3 opções
 * publicado (acordeão inline / sheet / popover flutuante), usuário
 * escolheu a Opção B: folha que sobe do rodapé. Mesmo "shell" (Modal +
 * overlay + Glass + insets) já usado por `SeriesQuickActionsSheet.tsx`
 * — não é um padrão novo, só o conteúdo (lista de episódios com botão
 * de marcar) é novo.
 *
 * Aberta direto do selo "+N" em `ContinueWatchingListRow.tsx`. Busca a
 * lista de pendentes (`fetchPendingEpisodesForSeries`, extraída de
 * `fetchNextEpisodesToWatch` pra reaproveitar a mesma lógica de filtro
 * já corrigida 3 vezes lá) só quando abre — não carrega nada enquanto
 * o card normal está em uso.
 */
export interface PendingEpisodesSheetProps {
  seriesId: number;
  seriesTitle: string;
  /**
   * Mesma Promise estável que o card já usa pro botão principal
   * (`onMarkedWatched` em `ContinueWatchingListRow.tsx` → `handleMarkedWatched`
   * na tela, que rebusca biblioteca + próximos episódios). Chamada em
   * paralelo (não bloqueia a lista local) toda vez que um episódio é
   * marcado aqui dentro, pra o card por trás da folha já refletir o
   * novo "+N"/próximo episódio quando a folha fechar.
   */
  onMarkedWatched: () => Promise<void>;
  onClose: () => void;
}

export function PendingEpisodesSheet({ seriesId, seriesTitle, onMarkedWatched, onClose }: PendingEpisodesSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t, locale } = useTranslation();

  const [episodes, setEpisodes] = useState<PendingEpisode[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  /**
   * BUG REAL CORRIGIDO (2026-10-06, reportado — marcar um episódio aqui
   * não perguntava se queria marcar os anteriores também, diferente do
   * mesmo gesto na tela de Detalhe da Série) — a checagem e o diálogo
   * ("marcar até aqui" / "só este") existiam só em
   * `SeasonAccordion.tsx`/`handleEpisodePress`; nunca foram portados pra
   * esta folha, criada depois (02/10) com seu próprio `handleMark` que
   * chamava `toggleEpisodeWatched` direto, sem checagem nenhuma. `episodes`
   * já é a lista de TODOS os pendentes da série, em ordem — "anterior" é
   * calculado contra ELA (pode atravessar temporada, diferente do
   * acordeão, que só vê uma por vez).
   */
  const [pendingConfirm, setPendingConfirm] = useState<PendingEpisode | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPendingEpisodesForSeries(seriesId, locale)
      .then((list) => {
        if (!cancelled) setEpisodes(list);
      })
      .catch((error) => {
        console.error("[PendingEpisodesSheet] Falha ao buscar episódios pendentes", error);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, locale]);

  /**
   * Fecha sozinha um instante depois de marcar o ÚLTIMO pendente —
   * mesmo espírito do "nunca mostra nada em branco" já documentado em
   * `ContinueWatchingListRow.tsx`: dá tempo do usuário ver a lista
   * esvaziar antes de a folha sumir, em vez de fechar no mesmo toque.
   */
  useEffect(() => {
    if (episodes && episodes.length === 0) {
      const timeout = setTimeout(() => {
        if (mountedRef.current) onClose();
      }, 650);
      return () => clearTimeout(timeout);
    }
  }, [episodes, onClose]);

  function isEarlier(a: PendingEpisode, b: PendingEpisode): boolean {
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber < b.seasonNumber;
    return a.episodeNumber < b.episodeNumber;
  }

  /** Toque no círculo de marcar — decide se marca direto ou pergunta primeiro (ver comentário grande em `pendingConfirm`, acima). */
  function handlePressMark(episode: PendingEpisode) {
    if (markingKey) return;
    const hasUnwatchedBefore = (episodes ?? []).some((ep) => isEarlier(ep, episode));
    if (hasUnwatchedBefore) {
      hapticTick();
      setPendingConfirm(episode);
      return;
    }
    void handleMark(episode, []);
  }

  /** `earlier`: vazio = só este episódio (`toggleEpisodeWatched`, como antes); não vazio = em lote junto com os anteriores (`markEpisodesWatched`, mesmo UPSERT único que `SeasonAccordion`/`markUpToEpisode` já usa). */
  async function handleMark(episode: PendingEpisode, earlier: PendingEpisode[]) {
    const key = `${episode.seasonNumber}-${episode.episodeNumber}`;
    if (markingKey) return; // uma marcação por vez — evita duas escritas concorrentes pro mesmo episódio.
    hapticTick();
    setMarkingKey(key);
    try {
      if (earlier.length > 0) {
        await markEpisodesWatched(
          seriesId,
          [...earlier, episode].map((ep) => ({ seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber, episodeId: ep.episodeId }))
        );
      } else {
        await toggleEpisodeWatched(seriesId, episode.seasonNumber, episode.episodeNumber, false, episode.episodeId);
      }
      if (!mountedRef.current) return;
      const removedKeys = new Set([key, ...earlier.map((ep) => `${ep.seasonNumber}-${ep.episodeNumber}`)]);
      setEpisodes((current) => (current ? current.filter((ep) => !removedKeys.has(`${ep.seasonNumber}-${ep.episodeNumber}`)) : current));
      // Não espera — o card por trás da folha atualiza em paralelo, a
      // folha não precisa travar nisso (mesmo motivo documentado em
      // `handleMarkWatched`, `ContinueWatchingListRow.tsx`).
      onMarkedWatched().catch((error) => console.error("[PendingEpisodesSheet] Falha ao atualizar card depois de marcar", error));
    } catch (error) {
      console.error("[PendingEpisodesSheet] Falha ao marcar episódio", error);
    } finally {
      if (mountedRef.current) setMarkingKey(null);
    }
  }

  const count = episodes?.length ?? 0;
  const countLabel = count > 0 ? `${count} ${t(count === 1 ? "episode.pendingSingular" : "episode.pendingPlural")}` : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom, maxHeight: windowHeight * 0.62 }]} variant="dark">
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <View style={styles.titleTextGroup}>
              <Text numberOfLines={1} style={styles.title}>
                {seriesTitle}
              </Text>
              {countLabel && (
                <Text variant="muted" style={styles.subtitle}>
                  {countLabel}
                </Text>
              )}
            </View>
            <Pressable hitSlop={8} onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
          </View>

          {episodes === null && !loadError && (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {loadError && (
            <View style={styles.centerState}>
              <Text variant="muted" style={styles.centerStateText}>
                {t("episode.pendingSheetLoadError")}
              </Text>
            </View>
          )}

          {episodes !== null && !loadError && episodes.length === 0 && (
            <View style={styles.centerState}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <Text variant="muted" style={styles.centerStateText}>
                {t("episode.pendingSheetAllCaughtUp")}
              </Text>
            </View>
          )}

          {episodes !== null && episodes.length > 0 && (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {episodes.map((episode) => {
                const key = `${episode.seasonNumber}-${episode.episodeNumber}`;
                const code = `T${String(episode.seasonNumber).padStart(2, "0")} | E${String(episode.episodeNumber).padStart(2, "0")}`;
                const isMarking = markingKey === key;
                return (
                  <View key={key} style={styles.episodeRow}>
                    <Text style={styles.episodeCode}>{code}</Text>
                    <Text numberOfLines={1} style={styles.episodeTitle}>
                      {episode.name}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      disabled={markingKey !== null}
                      onPress={() => handlePressMark(episode)}
                      style={[styles.markButton, markingKey !== null && !isMarking && styles.markButtonDisabled]}
                    >
                      {isMarking ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : (
                        <Feather name="check" size={14} color={colors.muted} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Glass>
      </View>

      {pendingConfirm && (
        <OptionSheet
          title={t("episode.markPreviousTitle")}
          message={t("episode.markPreviousMessage")}
          actions={[
            {
              label: t("common.yes"),
              active: true,
              onPress: () => {
                const episode = pendingConfirm;
                const earlier = (episodes ?? []).filter((ep) => isEarlier(ep, episode));
                setPendingConfirm(null);
                void handleMark(episode, earlier);
              },
            },
            {
              label: t("common.no"),
              onPress: () => {
                const episode = pendingConfirm;
                setPendingConfirm(null);
                void handleMark(episode, []);
              },
            },
          ]}
          onDismiss={() => setPendingConfirm(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  /** Mesma receita `dark` + cantos/padding de `SeriesQuickActionsSheet.tsx` — ver comentário lá sobre a fidelidade ao web. */
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  titleTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    fontFamily: fontFamily[700],
  },
  subtitle: {
    fontSize: fontSize.xxs,
    marginTop: 2,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  centerStateText: {
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  list: {
    marginTop: spacing.xs,
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  episodeCode: {
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    color: colors.muted,
    width: 72,
    flexShrink: 0,
  },
  episodeTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.sm,
  },
  markButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  markButtonDisabled: {
    opacity: 0.4,
  },
});
