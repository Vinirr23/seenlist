import { useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, Text as RNText } from "react-native";
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

/*
 * A PEDIDO — sombra de texto, reaproveitada em título/subtítulo/link.
 * Sem isso, texto claro em cima de um trecho claro do mosaico de
 * pôster (ex.: uma capa com fundo branco) ficava quase ilegível —
 * "Já tenho conta" foi o exemplo apontado, mas o mesmo risco existe
 * em qualquer texto sobre a colagem, não só ali. A vinheta
 * (gradiente) já ajuda no meio da tela, mas nas bordas (onde ela é
 * mais clara, de propósito) o texto sozinho não tinha proteção
 * nenhuma.
 */
const textShadow = {
  textShadowColor: "rgba(0,0,0,0.85)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const POSTER_COLUMNS = 3;
/*
 * CORREÇÃO (bug real, confirmado com diagnóstico em tela — a busca
 * retornava 15 URLs certas, mas nenhum pôster desenhava) — a versão
 * anterior dimensionava cada célula por PORCENTAGEM (`width: 33%`) +
 * `aspectRatio`, sem altura numérica nenhuma. Essa combinação é um
 * caso conhecido de falha no React Native: dentro de um container
 * `position: absolute` (o mosaico inteiro é posicionado assim, pra
 * ficar atrás do conteúdo), o motor de layout pode nunca resolver a
 * largura percentual pra um número de verdade a tempo — resultado:
 * imagem "existe" na árvore (por isso os dados chegavam certos),
 * mas com tamanho final zero, invisível.
 *
 * Corrigido com PIXEL explícito: mede a largura real da tela
 * (`Dimensions.get`) uma vez, calcula a largura de cada célula em
 * número — sem ambiguidade nenhuma pro React Native resolver.
 */
const SCREEN_WIDTH = Dimensions.get("window").width;
const TILE_WIDTH = SCREEN_WIDTH / POSTER_COLUMNS;
const TILE_HEIGHT = TILE_WIDTH * 1.5; // proporção 2:3 de pôster, em pixel — mesmo cálculo que "aspectRatio: 2/3" fazia, só que resolvido de antemão
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
        setDebugStatus(`ok: série=${series.length} filme=${movies.length} urls=${finalUrls.length} tile=${TILE_WIDTH.toFixed(0)}x${TILE_HEIGHT.toFixed(0)}`);
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
          <View style={styles.brandWrapper}>
            <AuthBrand />
          </View>

          <Text style={styles.title}>
            {t("onboarding.titleLine1")}
            {"\n"}
            {t("onboarding.titleLine2Prefix")}{" "}
            <RNText style={[styles.title, styles.titleAccent]}>{t("onboarding.titleLine2Accent")}</RNText>
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
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
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
  /*
   * A PEDIDO — respiro entre a logo e o título. `AuthBrand` já tem
   * uma margem própria pequena (pensada pra ficar coladinho num
   * formulário de login logo abaixo) — aqui o contexto é diferente
   * (título grande vem depois, não um campo de formulário), por
   * isso a margem extra é adicionada de FORA, sem mexer no
   * componente compartilhado (que continua certo do jeito que está
   * pras outras telas que o usam).
   */
  brandWrapper: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 32,
    ...textShadow,
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
    ...textShadow,
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
    ...textShadow,
  },
});
