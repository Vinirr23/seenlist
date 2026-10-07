import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Skeleton, Text } from "@/components/ui";
import { fetchSeasonRecap, type SeasonRecapData } from "@/lib/seasonRecap";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, spacing, radius, fontSize, fontFamily } from "@/lib/theme";

interface SeasonRecapCardProps {
  seriesId: number;
  seasonNumber: number;
  seriesTitle: string;
  backdropUrl?: string | null;
}

type CardState = "loading" | "unavailable" | { data: SeasonRecapData };

/**
 * TASK (Resumo da Temporada) — card contextual entre o carrossel
 * "Continuar acompanhando" (`EpisodeCarousel`) e "Todos os episódios"
 * (seção 4 da auditoria). Busca o recap sozinho — o pai
 * (`app/series/[id].tsx`) só decide SE deve montar este componente
 * (`findCompletedPreviousSeason`, seção 3).
 *
 * Três estados possíveis (seção 9 da auditoria): carregando (skeleton
 * simples), indisponível/erro (não renderiza NADA — nem skeleton, nem
 * mensagem) e disponível (o card de verdade, que leva pra tela cheia
 * do resumo completo ao tocar).
 */
export function SeasonRecapCard({ seriesId, seasonNumber, seriesTitle, backdropUrl }: SeasonRecapCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<CardState>("loading");
  const captionOpacity = useRef(new Animated.Value(0.45)).current;

  /**
   * POLIMENTO (2026-10-07, a pedido explícito do usuário — opção "D"
   * de um mockup com 3 direções) — o skeleton antigo era só um
   * retângulo opaco parado (`opacity: 0.4` sobre o card vazio), sem
   * nenhum indício de QUE um resumo estava sendo gerado ali. Agora:
   * barras com o mesmo shimmer já usado em todo o resto do app
   * (`components/ui/Skeleton.tsx`) + uma legenda piscando — só a
   * opacidade da legenda anima aqui, o efeito de brilho em si já vem
   * de dentro do `<Skeleton>`.
   */
  useEffect(() => {
    if (state !== "loading") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(captionOpacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(captionOpacity, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, captionOpacity]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchSeasonRecap(seriesId, seasonNumber).then((data) => {
      if (cancelled) return;
      setState(data ? { data } : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId, seasonNumber]);

  const openFullRecap = useCallback(() => {
    router.push({
      pathname: "/series/[id]/season-recap/[season]",
      // POLIMENTO (2026-10-07, a pedido do usuário) — `backdropUrl` vai
      // como parâmetro de navegação pra tela cheia poder montar o hero
      // compacto (backdrop + gradiente) sem precisar buscar detalhes da
      // série de novo — mesmo padrão de `seriesTitle`, já existente.
      params: { id: String(seriesId), season: String(seasonNumber), seriesTitle, backdropUrl: backdropUrl ?? "" },
    });
  }, [router, seriesId, seasonNumber, seriesTitle, backdropUrl]);

  if (state === "unavailable") return null;

  if (state === "loading") {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <Skeleton width="60%" height={12} borderRadius={6} />
        <Skeleton width="95%" height={10} borderRadius={6} style={styles.loadingBarSpacing} />
        <Skeleton width="70%" height={10} borderRadius={6} style={styles.loadingBarSpacing} />
        <Animated.View style={[styles.loadingCaptionRow, { opacity: captionOpacity }]}>
          <MaterialCommunityIcons name="creation" size={13} color={colors.primary} />
          <Text style={styles.loadingCaptionLabel}>{t("seasonRecap.generating")}</Text>
        </Animated.View>
      </View>
    );
  }

  const { data } = state;

  return (
    <Pressable style={styles.card} onPress={openFullRecap} accessibilityRole="button">
      {backdropUrl ? <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : null}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.75)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.badge}>
        <MaterialCommunityIcons name="creation" size={11} color={colors.primary} />
        <Text style={styles.badgeLabel}>{t("seasonRecap.badge")}</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>{t("seasonRecap.cardSeasonLabel", { season: seasonNumber })}</Text>
        <Text numberOfLines={2} variant="muted" style={styles.teaser}>
          {data.inThirtySeconds}
        </Text>
        <View style={styles.ctaPill}>
          <Text style={styles.ctaPillLabel}>{t("seasonRecap.seeFullRecap")}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minHeight: 140,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  // Estado "gerando" (opção "D" do mockup aprovado) — fundo sólido, sem
  // backdrop nenhum ainda (não teria sentido mostrar a imagem da série
  // atrás de um texto que ainda não existe), só os retângulos de
  // shimmer + a legenda piscando embaixo.
  loadingCard: {
    padding: spacing.md,
    justifyContent: "flex-end",
  },
  loadingBarSpacing: {
    marginTop: spacing.sm,
  },
  loadingCaptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  loadingCaptionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[600],
    color: colors.primary,
  },
  // Selo "Resumo" (opção "C" do mockup aprovado) — canto superior
  // DIREITO de propósito: o título ("Temporada N") mora embaixo à
  // esquerda, no `textBox`; colocar os dois do mesmo lado foi o
  // primeiro rascunho e ficou um sobrepondo o outro.
  badge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(232,163,61,0.18)",
    borderWidth: 1,
    borderColor: "rgba(232,163,61,0.45)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeLabel: {
    fontSize: 10,
    fontFamily: fontFamily[700],
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textBox: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.lgPlus,
    fontFamily: fontFamily[700],
    color: colors.text,
  },
  teaser: {
    fontSize: fontSize.xsPlus,
    color: colors.muted,
    lineHeight: fontSize.xsPlus * 1.4,
  },
  ctaPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginTop: spacing.xs,
  },
  ctaPillLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[700],
    color: colors.background,
  },
});
