import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
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
    // Skeleton simples — só aparece na 1ª vez que a rota ainda não tem
    // cache pra esta temporada; depois do 1º usuário gerar, os
    // próximos veem o card direto (resposta já vem do cache).
    return <View style={[styles.card, styles.skeleton]} />;
  }

  const { data } = state;

  return (
    <Pressable style={styles.card} onPress={openFullRecap} accessibilityRole="button">
      {backdropUrl ? <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : null}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.78)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.textBox}>
        <Text style={styles.title}>{t("seasonRecap.cardTitle", { season: seasonNumber })}</Text>
        <Text numberOfLines={2} variant="muted" style={styles.teaser}>
          {data.inThirtySeconds}
        </Text>
        <View style={styles.ctaRow}>
          <Text style={styles.ctaLabel}>{t("seasonRecap.seeFullRecap")}</Text>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minHeight: 132,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  skeleton: {
    opacity: 0.4,
  },
  textBox: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[600],
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  teaser: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  ctaLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[600],
    color: colors.primary,
  },
});
