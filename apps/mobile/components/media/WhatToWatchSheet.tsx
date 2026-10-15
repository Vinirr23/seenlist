import { useCallback, useState } from "react";
import { View, Modal, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, scrim, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * NOVO (a pedido, 2026-10-15 — "O que assistir?": resolver a
 * indecisão de abrir "Assistir a seguir" com muitas opções e fechar o
 * app sem assistir nada) — único arquivo novo desta feature: a folha
 * (mesmo esqueleto de `Modal transparent animationType="slide"` +
 * overlay + `Glass variant="dark"` já usado em `RecommendSheet.tsx`/
 * `RecommendationQuickActionsSheet.tsx`) E a lógica de escolha, as
 * duas no mesmo arquivo de propósito — não é reusada em nenhum outro
 * lugar do app, então não precisa virar hook/serviço separado.
 *
 * ESCOLHA (pedido explícito: "priorizar bem avaliados, mas não
 * selecionar sempre o de maior nota" + "considerar quantidade de
 * votos pra não favorecer nota alta com poucos votos" + "pequena
 * aleatoriedade") — média bayesiana simples (mesma fórmula clássica
 * usada por rankings tipo IMDb Top 250): pondera a nota do item pela
 * confiança que a QUANTIDADE DE VOTOS dá nela, contra a média do
 * próprio "Assistir a seguir" — um filme nota 9 com 3 votos pesa
 * pouco; nota 8 com 2000 votos pesa quase o valor cheio. Dos
 * melhores colocados nessa pontuação, sorteia UM (não é sempre o 1º
 * lugar) — pequena aleatoriedade sem virar sistema de recomendação de
 * verdade.
 */

/** Limiar de "confiança" em votos — abaixo disso, a nota pesa menos que a média do grupo. Mesmo papel do `m` na fórmula bayesiana clássica (IMDb). Ajustável sem tocar no resto da lógica. */
const MIN_VOTES_CONFIDENCE = 50;
/** Nota neutra usada só quando a lista inteira não tem NENHUM item com nota (nunca deveria faltar dado — rede fora, cache frio) — não favorece nem penaliza. */
const FALLBACK_MEAN_RATING = 6.5;
/** Fração dos melhores colocados que entram no sorteio — nunca menos que 3 (pra sempre ter alguma variação, mesmo com lista pequena). */
const TOP_POOL_FRACTION = 0.3;
const TOP_POOL_MIN = 3;

function itemKey(item: LibraryItem): string {
  return `${item.mediaType}-${item.id}`;
}

function weightedScore(item: LibraryItem, meanRating: number): number {
  const votes = item.voteCount ?? 0;
  // Item sem nota nenhuma (resumo do TMDB ainda não trouxe) entra com
  // a média do grupo — nem favorece, nem descarta da lista.
  const rating = item.voteAverage ?? meanRating;
  return (votes / (votes + MIN_VOTES_CONFIDENCE)) * rating + (MIN_VOTES_CONFIDENCE / (votes + MIN_VOTES_CONFIDENCE)) * meanRating;
}

function pickSuggestion(items: LibraryItem[], excludeKeys: Set<string>): LibraryItem | null {
  if (items.length === 0) return null;

  // "Evitar repetir os filmes já mostrados NA SESSÃO ENQUANTO HOUVER
  // ALTERNATIVAS" (pedido explícito) — esgotou as alternativas, volta
  // a considerar a lista inteira (melhor repetir do que não sugerir
  // nada).
  const pool = items.filter((item) => !excludeKeys.has(itemKey(item)));
  const candidates = pool.length > 0 ? pool : items;

  const ratedValues = candidates.map((item) => item.voteAverage).filter((value): value is number => value != null);
  const meanRating = ratedValues.length > 0 ? ratedValues.reduce((sum, value) => sum + value, 0) / ratedValues.length : FALLBACK_MEAN_RATING;

  const scored = candidates
    .map((item) => ({ item, score: weightedScore(item, meanRating) }))
    .sort((a, b) => b.score - a.score);

  const topCount = Math.max(TOP_POOL_MIN, Math.ceil(scored.length * TOP_POOL_FRACTION));
  const topCandidates = scored.slice(0, Math.min(topCount, scored.length));

  const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];
  return chosen?.item ?? candidates[0] ?? null;
}

export function WhatToWatchSheet({ items, onClose }: { items: LibraryItem[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  // Estado só desta "sessão" da folha (não sobrevive fechar/abrir de
  // novo, de propósito — "enquanto houver alternativas" é sobre esta
  // conferida, não pra sempre).
  const [shownKeys] = useState(() => new Set<string>());
  const [suggestion, setSuggestion] = useState<LibraryItem | null>(() => pickSuggestion(items, shownKeys));

  const handleAnotherSuggestion = useCallback(() => {
    if (suggestion) shownKeys.add(itemKey(suggestion));
    setSuggestion(pickSuggestion(items, shownKeys));
  }, [items, shownKeys, suggestion]);

  const handleWatchNow = useCallback(() => {
    if (!suggestion) return;
    onClose();
    router.push(`/movies/${suggestion.id}`);
  }, [suggestion, onClose, router]);

  const posterUrl = suggestion ? tmdbImageUrl(suggestion.posterPath, "w500") : null;
  const metaParts = suggestion
    ? [suggestion.year ? String(suggestion.year) : null, suggestion.runtimeMinutes ? `${suggestion.runtimeMinutes} min` : null].filter(Boolean)
    : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={colors.muted} />
          </Pressable>

          <Text variant="subtitle" style={styles.title}>
            {t("whatToWatch.sheetTitle")}
          </Text>

          {suggestion && (
            <>
              <Glass style={styles.posterWrapper} variant="medium">
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
                ) : (
                  <View style={styles.posterFallback}>
                    <Feather name="film" size={28} color={colors.muted} />
                  </View>
                )}
                {suggestion.voteAverage != null && (
                  <View style={styles.ratingBadge}>
                    <Feather name="star" size={11} color={colors.primary} />
                    <Text style={styles.ratingBadgeText}>{suggestion.voteAverage.toFixed(1)}</Text>
                  </View>
                )}
              </Glass>

              <Text numberOfLines={2} style={styles.movieTitle}>
                {suggestion.title}
              </Text>
              {metaParts.length > 0 && (
                <Text variant="muted" style={styles.meta}>
                  {metaParts.join(" · ")}
                </Text>
              )}

              <Pressable style={styles.watchButton} onPress={handleWatchNow}>
                <Feather name="play" size={16} color={colors.background} />
                <Text style={styles.watchButtonText}>{t("whatToWatch.watchNow")}</Text>
              </Pressable>

              <Pressable style={styles.anotherButton} onPress={handleAnotherSuggestion} hitSlop={8}>
                <Feather name="refresh-cw" size={14} color={colors.muted} />
                <Text variant="muted" style={styles.anotherButtonText}>
                  {t("whatToWatch.anotherSuggestion")}
                </Text>
              </Pressable>
            </>
          )}
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: scrim.modal },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  title: {
    marginBottom: spacing.md,
    textAlign: "center",
  },
  posterWrapper: {
    width: "55%",
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Mesma receita do selo da grade (`PosterGrid.tsx`, `ratingBadge`) — fundo escuro translúcido, borda sutil, âmbar.
  ratingBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: scrim.overImage,
  },
  ratingBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.primary,
  },
  movieTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  meta: {
    marginTop: 2,
  },
  watchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  watchButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  anotherButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  anotherButtonText: {
    fontSize: fontSize.sm,
  },
});
