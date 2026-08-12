import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { fetchDiscoverList } from "@/lib/discover";
import { tmdbImageUrl } from "@/lib/library";

/**
 * A PEDIDO (v2 — reformulação com referência visual) — mosaico de
 * pôster real (TMDB, em alta — mesma fonte de antes, `fetchDiscoverList`,
 * funciona sem sessão) com rotação leve por peça (efeito "colagem",
 * não grade rígida) e VINHETA de verdade via `expo-linear-gradient`
 * (gradiente vertical: mais escuro no meio da tela, mais claro nas
 * bordas de cima/baixo) — antes era um véu plano uniforme, sem
 * variação nenhuma.
 *
 * O gradiente é só VERTICAL, de propósito — testando contra a
 * referência, as laterais continuam mostrando pôster mesmo na altura
 * do texto central; um degradê radial completo (escurecer também
 * lateralmente) precisaria de SVG, complexidade a mais que essa
 * diferença visual não paga.
 */
export const ONBOARDING_SEEN_KEY = "seenlist:onboarding-seen";

const POSTER_COLUMNS = 3;
/** Rotação alternada por posição — pequena o bastante pra não cortar borda de pôster vizinho, grande o bastante pra parecer colagem, não grade. */
const TILE_ROTATIONS = [-3, 2, -2, 3, -2, 3, -3, 2];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [posterUrls, setPosterUrls] = useState<string[]>([]);
  const [debugStatus, setDebugStatus] = useState("carregando...");

  useEffect(() => {
    Promise.all([fetchDiscoverList("trending_series"), fetchDiscoverList("trending_movies")])
      .then(([series, movies]) => {
        const urls: string[] = [];
        const max = Math.max(series.length, movies.length);
        for (let i = 0; i < max; i++) {
          const seriesItem = series[i];
          const movieItem = movies[i];
          if (seriesItem) {
            const url = tmdbImageUrl(seriesItem.posterPath, "w342");
            if (url) urls.push(url);
          }
          if (movieItem) {
            const url = tmdbImageUrl(movieItem.posterPath, "w342");
            if (url) urls.push(url);
          }
        }
        const finalUrls = urls.slice(0, 15);
        setPosterUrls(finalUrls);
        setDebugStatus(`ok: série=${series.length} filme=${movies.length} urls=${finalUrls.length}`);
      })
      .catch((error) => {
        console.warn("[onboarding] Falha ao buscar pôsteres de fundo", error);
        setDebugStatus(`erro: ${error instanceof Error ? error.message : String(error)}`);
      });
  }, []);

  async function handleContinue() {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      {/*
       * TEMPORÁRIO — diagnóstico visível na própria tela, sem precisar
       * de ferramenta de desenvolvedor nenhuma. Remover depois de
       * achar a causa real do "não aparece as capas".
       */}
      <Text style={styles.debugBadge}>{debugStatus}</Text>

      <View style={styles.posterGrid} pointerEvents="none">
        {posterUrls.map((url, i) => (
          <Image
            key={url + i}
            source={{ uri: url }}
            style={[styles.posterCell, { transform: [{ rotate: `${TILE_ROTATIONS[i % TILE_ROTATIONS.length]}deg` }] }]}
            contentFit="cover"
          />
        ))}
      </View>

      {/* Vinheta — gradiente vertical de verdade (`expo-linear-gradient`), não mais um véu plano. Mais escuro no meio (onde o texto fica), mais claro nas bordas. */}
      <LinearGradient
        colors={["rgba(11,14,20,0.55)", "rgba(11,14,20,0.93)", "rgba(11,14,20,0.55)"]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <View style={styles.spacerTop} />

        <View style={styles.textBlock}>
          <AuthBrand />

          <Text style={styles.title}>
            {t("onboarding.titleLine1")}
            {"\n"}
            {t("onboarding.titleLine2Prefix")} <Text style={styles.titleAccent}>{t("onboarding.titleLine2Accent")}</Text>
          </Text>
          <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>
        </View>

        <View style={styles.spacerBottom} />

        <View style={styles.footer}>
          <Button onPress={handleContinue}>{t("onboarding.cta")}</Button>
          <Text onPress={handleContinue} style={styles.loginLink}>
            {t("onboarding.alreadyHaveAccount")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  posterGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  posterCell: {
    width: `${100 / POSTER_COLUMNS}%`,
    aspectRatio: 2 / 3,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
  /*
   * CORREÇÃO (bug real, reportado com print — "tudo embaixo") — antes
   * era UM espaçador só (flex:1) empurrando tudo pro fundo absoluto
   * da tela, com o resto ficando espremido na borda. Dois
   * espaçadores, com pesos diferentes (2 em cima, 1 embaixo),
   * distribui o espaço vazio nos dois lados — o bloco de texto fica
   * um pouco abaixo do meio da tela (como na referência), e o rodapé
   * ainda tem respiro antes da borda de baixo, sem ficar colado nela.
   */
  spacerTop: {
    flex: 2,
  },
  spacerBottom: {
    flex: 1,
  },
  debugBadge: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#4FD1C5",
    fontSize: 10,
    padding: 6,
    borderRadius: 6,
  },
  textBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 32,
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  loginLink: {
    textAlign: "center",
    color: colors.muted,
    fontSize: fontSize.sm,
    paddingVertical: spacing.sm,
  },
});
