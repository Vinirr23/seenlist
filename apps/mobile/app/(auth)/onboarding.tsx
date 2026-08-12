import { useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, Text as RNText } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { fetchDiscoverList } from "@/lib/discover";
import { tmdbImageUrl } from "@/lib/library";

/**
 * A PEDIDO (v3 — ajuste de hierarquia e legibilidade, mesmo conceito
 * visual mantido) — mosaico de pôster real (TMDB, em alta —
 * `fetchDiscoverList`, funciona sem sessão) com rotação leve por
 * peça (efeito "colagem", não grade rígida). Vinheta com DOIS
 * gradientes cruzados (`expo-linear-gradient`) — vertical E
 * horizontal, os dois mais escuros no meio — aproxima um efeito de
 * vinheta central sem precisar de gradiente radial de verdade (que
 * pediria SVG, dependência nova = build novo). O pôster continua
 * visível nos cantos/bordas; o centro, onde o texto fica, é bem mais
 * escuro que qualquer ponto isolado nas bordas.
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
        setPosterUrls(urls.slice(0, 15));
      })
      .catch((error) => {
        // Sem pôster nenhum não é erro — a tela funciona igual, só sem o mosaico de fundo. Nunca bloqueia o onboarding.
        console.warn("[onboarding] Falha ao buscar pôsteres de fundo", error);
      });
  }, []);

  async function handleContinue() {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
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

      {/*
        * A PEDIDO (v6 — segundo ajuste, mais força e pico realinhado)
        * — a v5 (4 gradientes cruzados, cobrindo diagonais) melhorou
        * a FORMA (menos "cruz", mais suave), mas ainda não bastava.
        * Dois problemas achados comparando a v5 renderizada com a
        * intenção original:
        *
        * 1. O pico de escurecimento mirava o meio EXATO da tela
        *    (0.5), mas o bloco de texto não fica no meio exato — o
        *    layout usa espaçadores 2:1 (mais espaço em cima que
        *    embaixo), empurrando o conteúdo pra baixo do centro
        *    geométrico. Corrigido só no gradiente VERTICAL e nas
        *    diagonais (0.58, não mais 0.5) — o HORIZONTAL continua em
        *    0.5, de propósito: o texto é centralizado na horizontal,
        *    não tem por que deslocar esse eixo.
        * 2. Opacidade de pico mais forte (0.42 → 0.52 por camada,
        *    ~89% → ~95% combinado no centro) — mesmo com a forma
        *    melhorada na v5, a força ali ainda não bastava pra
        *    separar o conteúdo do pôster atrás com folga.
        */}
      <LinearGradient
        colors={["rgba(11,14,20,0.12)", "rgba(11,14,20,0.52)", "rgba(11,14,20,0.12)"]}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(11,14,20,0.12)", "rgba(11,14,20,0.52)", "rgba(11,14,20,0.12)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(11,14,20,0.12)", "rgba(11,14,20,0.52)", "rgba(11,14,20,0.12)"]}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(11,14,20,0.12)", "rgba(11,14,20,0.52)", "rgba(11,14,20,0.12)"]}
        locations={[0, 0.58, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/*
        * A PEDIDO (v8 — desfoque de verdade, `expo-blur`) — a
        * aproximação em cinza (v7) foi reprovada de vez ("ficou uma
        * mancha suja") — confirmou o teto do que dava pra fazer só
        * com cor. `BlurView` desfoca o que está ATRÁS dela de
        * verdade, na mesma faixa central de antes (ícone até abaixo
        * do texto secundário) — as laterais continuam nítidas, fora
        * dessa faixa.
        *
        * `intensity` 40 é moderado de propósito — forte o bastante
        * pra reduzir detalhe (rosto, texto de pôster), sem virar uma
        * mancha branca lavada por cima do mosaico. `borderRadius`
        * grande nos 4 cantos evita uma borda reta óbvia onde o
        * desfoque começa/termina — não é o mesmo que uma borda
        * suave de verdade (precisaria de máscara em gradiente, mais
        * uma dependência), mas já evita o corte mais chapado.
        */}
      <BlurView intensity={40} tint="dark" style={styles.centerSoftenZone} pointerEvents="none" />

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
  /*
   * A PEDIDO — faixa da "amaciada" central (v7), não a tela inteira.
   * `top`/`bottom` em porcentagem aproximam a altura do ícone até
   * abaixo do texto secundário (o layout usa espaçadores 2:1, então
   * o bloco de texto fica um pouco abaixo do meio geométrico — não é
   * medido em tempo real, é estimativa baseada na proporção dos
   * espaçadores; ajustar aqui se o alinhamento não bater exatamente
   * depois de testar no aparelho). `left`/`right` deixam de fora as
   * bordas de verdade, reforçando que essa camada é só do centro.
   */
  centerSoftenZone: {
    position: "absolute",
    top: "30%",
    bottom: "32%",
    left: "8%",
    right: "8%",
    borderRadius: 999,
    overflow: "hidden",
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
    /*
     * CORREÇÃO (a pedido — "quase invisível") — era `colors.muted`
     * (cinza escurecido, pensado pra texto secundário sobre fundo
     * SÓLIDO). Sobre o mosaico de pôster, esse cinza não tinha
     * contraste suficiente. Trocado pra `colors.text` (quase
     * branco, mesma cor do título) — a hierarquia "ação secundária"
     * continua clara pelo TAMANHO (menor) e PESO (sem negrito), não
     * mais tentando fazer isso só com uma cor mais fraca, que aqui
     * também significava "difícil de ler".
     */
    color: colors.text,
    fontSize: fontSize.sm,
    paddingVertical: spacing.sm,
    ...textShadow,
  },
});
