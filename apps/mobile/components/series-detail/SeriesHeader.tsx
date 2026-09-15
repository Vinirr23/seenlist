import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass, GlassTargetProvider } from "@/components/ui";
import { colors, spacing, elevation } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * CORREÇÃO (a pedido — auditoria mais rigorosa) — evita
 * `Intl.NumberFormat({ notation: "compact" })` de propósito: é o
 * mesmo tipo de API "avançada" do `Intl` que já derrubou o Feed em
 * produção (`Intl.RelativeTimeFormat`, sem suporte garantido no
 * Hermes dependendo do build). Mais vale um formato mais simples e
 * SEGURO do que arriscar outro crash igual, por uma linha de nota.
 */
function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} mil`;
  return String(n);
}

export function SeriesHeader({
  series,
  watchedCount,
  totalEpisodes,
  onMorePress,
}: {
  series: SeriesDetails;
  watchedCount: number;
  totalEpisodes: number;
  onMorePress: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const backdropUrl = tmdbImageUrl(series.backdropPath, "w1280"); // o web usa `w1280`; `w780` era esticado até 1080px de tela e ficava macio
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const showProgress = totalEpisodes > 0;
  const percentage = showProgress ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const seasonsLabel = `${series.numberOfSeasons} ${series.numberOfSeasons === 1 ? t("media.seasonSingular") : t("media.seasonPlural")}`;

  return (
    /*
     * CAUSA RAIZ (2026-09-09, print real — "os botões não estão
     * transparentes").
     *
     * Os dois botões são `Glass`, e um `Glass` sem alvo próprio pega o
     * alvo do CONTEXTO — que aqui era o `GlassTargetProvider` de
     * `app/series/[id].tsx`, cujo conteúdo é o campo de manchas sobre
     * uma BASE ESCURA OPACA (`DITHER_COMPENSATED_BASE`, ver
     * `Glass.tsx`). Ou seja: o desfoque amostrava um retângulo escuro
     * chapado, e o branco 10% da receita por cima disso dá exatamente
     * o cinza-escuro opaco do print. No web não existe esse desvio —
     * `backdrop-filter` amostra o que está LITERALMENTE atrás do botão,
     * que é a foto: por isso lá o "voltar" puxa o rosa da nuvem e o
     * "..." puxa o azul do céu.
     *
     * Fix pelo padrão que o app já usa e que já está validado no
     * aparelho — o banner do Perfil (`app/(tabs)/profile.tsx`) faz
     * exatamente isto: um `GlassTargetProvider` LOCAL com
     * `base="transparent"` (sem base opaca, senão volta o mesmo
     * problema) e a imagem como `background`. Os `Glass` de dentro
     * passam a desfocar a capa, sem precisar de `blurTarget` em cada
     * um — o contexto mais próximo é este.
     */
    <GlassTargetProvider
      style={styles.wrapper}
      base="transparent"
      background={
        <>
          {backdropUrl ? (
            <Image source={{ uri: backdropUrl }} style={styles.backdrop} contentFit="cover" />
          ) : (
            <View style={[styles.backdrop, styles.backdropFallback]} />
          )}
          {/*
            PORTE DO WEB (2026-09-09, comparado no print) — o véu era uma
            camada CHAPADA (`scrim.overImage`, o mesmo escuro de cima a
            baixo), então a capa inteira ficava apagada por igual. No web é
            um DEGRADÊ vertical: `bg-gradient-to-t from-background
            via-background/60 to-black/10` — quase transparente em cima (a
            imagem aparece em cheio), meio caminho a 60% e o fundo da tela
            chapado embaixo, onde mora o texto.
          */}
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(11,14,20,0.6)", colors.background]}
            locations={[0, 0.5, 1]}
            style={styles.overlay}
          />
        </>
      }
    >

      {/*
        PORTE DO WEB (2026-09-09) — os dois botões eram círculos
        CHAPADOS (`scrim.overImage`, sem borda). No web são vidro, a
        mesma receita dos ícones do Perfil: `border border-white/15
        backdrop-blur-md backdrop-saturate-150` + brilho 0.26 no canto
        superior esquerdo e base 0.10 — a variante `icon` do `Glass` —
        mais `shadow-lg shadow-black/25`.
      */}
      <Glass style={styles.backButton} variant="icon">
        <Pressable style={styles.buttonHit} onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={16} color={colors.text} />
        </Pressable>
      </Glass>

      <Glass style={styles.moreButton} variant="icon">
        <Pressable style={styles.buttonHit} onPress={onMorePress} hitSlop={8}>
          <Feather name="more-horizontal" size={16} color={colors.text} />
        </Pressable>
      </Glass>

      <View style={[styles.textBlock, { bottom: showProgress ? 28 : 12 }]}>
        {/*
          PORTE DO WEB (2026-09-09, comparado no print) — o título era
          `variant="title"` = 28px/700. No web é `text-2xl
          font-extrabold leading-tight` = 24px/800 com entrelinha 30.
          Os 4px a mais eram o que fazia "De Caipira a Mestre
          Espadachim" quebrar em DUAS linhas no mobile e caber em UMA
          no web.
        */}
        <Text style={styles.title}>{series.title}</Text>
        {series.voteAverage > 0 && (
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={12} color={colors.primary} />
            <Text style={styles.ratingValue}>{series.voteAverage.toFixed(1)}</Text>
            {series.voteCount > 0 && (
              /* O web separa com "•" (bullet) e usa a chave `series.ratingsCount`; aqui era "·" (ponto médio) com "avaliações" escrito à mão. */
              <Text style={styles.ratingCount}>
                • {t("media.ratingsCount", { count: formatCompactCount(series.voteCount) })}
              </Text>
            )}
          </View>
        )}
        {/*
          CORREÇÃO (2026-09-09, comparado no print) — havia um terceiro
          item aqui, o primeiro gênero da série ("· Animação"). O web
          (`SeriesHeader.tsx`) monta só `[year, seasonsLabel]`: os
          gêneros já aparecem inteiros logo abaixo, na aba "Sobre", em
          chips próprios.
        */}
        <Text style={styles.meta}>{[year, seasonsLabel].filter(Boolean).join(" · ")}</Text>
      </View>

      {showProgress && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
          <Text style={styles.progressText}>{percentage}%</Text>
        </View>
      )}
    </GlassTargetProvider>
  );
}

/**
 * `drop-shadow` do Tailwind nos textos sobre a capa — sem isso, título
 * claro sobre uma cena clara perde o contorno. Equivalente nativo do
 * `drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))`.
 */
const SOMBRA_DE_TEXTO = {
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  /** `h-72` = 288 no web; aqui eram 240 — a capa do mobile terminava 48px antes. */
  wrapper: {
    height: 288,
    width: "100%",
    backgroundColor: colors.surface,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFallback: {
    backgroundColor: colors.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  /** `left-3 top-3 h-9 w-9` = 12 de canto (era `spacing.md` = 16), 36 de lado. */
  backButton: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  moreButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  /** A área de toque ocupa o círculo inteiro por dentro do vidro. */
  buttonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
  },
  /** `text-2xl font-extrabold leading-tight drop-shadow`. */
  title: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    color: "#FFFFFF",
    ...SOMBRA_DE_TEXTO,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    ...SOMBRA_DE_TEXTO,
  },
  /** `mt-1.5` = 6 (era 5). */
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  /** `font-semibold` = 600 (era 700). */
  ratingValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    ...SOMBRA_DE_TEXTO,
  },
  ratingCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    ...SOMBRA_DE_TEXTO,
  },
  progressRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    /* `px-3 pb-2` = 12/8 no web; a horizontal era `spacing.md` = 16. */
    paddingHorizontal: 12,
    paddingBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    /* `h-1.5 rounded-full bg-black/40` = 6 de altura sobre preto a 40% (era 5 sobre o véu opaco). */
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    ...SOMBRA_DE_TEXTO,
  },
});
