// `ScrollView` saiu daqui: era resto do carrossel revertido em
// 2026-09-03 (ver "REVERTIDO" na doc do componente), já não tinha uso.
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useProfileStats } from "@/lib/useProfileStats";
import { formatWatchDuration } from "@/lib/profileStats";
import { Text, Skeleton, Glass, GelSurface } from "@/components/ui";
import { PageError } from "../media/PageError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * Mesma imagem de brilho já desfocada usada pelo `AmbientGlow`
 * (`components/ui/Glass.tsx`) e pelo brilho da aba ativa da barra
 * (`app/(tabs)/_layout.tsx`) — ver o histórico completo no `Glass.tsx`:
 * um `LinearGradient` NÃO reproduz `radial-gradient` (não tem queda
 * radial, a mancha vira faixa/círculo de borda definida), e a solução
 * validada no aparelho foi o PNG que já nasce borrado, colorido por
 * `tintColor`.
 */
const GLOW_IMAGE = require("../../assets/images/glow-soft.png");

/**
 * CORREÇÃO (2026-09-04, print real mobile × web lado a lado — "está um
 * pouco diferente") — o card saía CINZA LAVADO, e por tabela a legenda
 * de cada métrica sumia (mesmo `colors.muted` do web, #8C93A8: o
 * problema nunca foi a cor do texto, foi o fundo atrás dele ficar
 * claro demais e comer o contraste).
 *
 * Causa raiz: o web pinta DUAS manchas RADIAIS pequenas, de canto —
 * `radial-gradient(55% 65% at 14% 10%, rgba(255,255,255,0.17),
 * transparent 55%)` e `radial-gradient(50% 55% at 92% 100%,
 * rgba(42,127,184,0.18), transparent 60%)`. Eu tinha portado as duas
 * como `LinearGradient` do canto superior esquerdo até (0.7, 0.65):
 * um véu branco cobrindo ~2/3 do card, onde o web tem um brilho de
 * canto que já morre aos 55%. Somando com o `gradientNeutral` que o
 * próprio `Glass` desenha, o miolo do card ficava ~1,7× mais branco
 * que o web.
 *
 * A geometria abaixo é lida direto do CSS: numa `radial-gradient` com
 * tamanho explícito, `55% 65%` são os raios (da largura e da altura da
 * caixa) da elipse final, e `transparent 55%` corta a 55% desse raio —
 * então o brilho VISÍVEL tem raio 0,55 × 55% ≈ 30% da largura e
 * 0,55 × 65% ≈ 36% da altura, centrado em (14%, 10%). A caixa da
 * imagem é o dobro disso, deslocada pra manter o mesmo centro. O
 * `Glass` já tem `overflow: "hidden"`, então o que passa da borda é
 * recortado igual ao CSS faz.
 */
const CARD_GLOWS = [
  {
    key: "white",
    tint: "rgb(255,255,255)",
    opacity: 0.17,
    // centro (14%, 10%), raio visível ~30%×36% → caixa 60%×72%
    left: "-16%",
    top: "-26%",
    width: "60%",
    height: "72%",
  },
  {
    key: "blue",
    tint: "rgb(42,127,184)",
    opacity: 0.18,
    // centro (92%, 100%), raio visível ~30%×33% → caixa 60%×66%
    left: "62%",
    top: "67%",
    width: "60%",
    height: "66%",
  },
] as const;

/**
 * TASK-116 (correção — Perfil) — porta de `StatisticsCard.tsx`.
 * Card com 4 números de prévia — diferente do carrossel de 7
 * (`StatsCarousel`, usado só no perfil PÚBLICO de outra pessoa).
 * "Ver detalhes" leva pra `/profile/stats`, a tela completa com
 * abas Séries/Filmes.
 *
 * Redesign (a pedido, mesmo visual do web) — degradê de verdade via
 * `expo-linear-gradient` (instalado a pedido, precisou de build
 * novo). Ícone por métrica, "Ver detalhes" como pílula preenchida em
 * vez de só a seta. Carregando/erro usam fundo sólido (`cardStatic`)
 * — não faz sentido animar/degradê num estado que nem tem dado pra
 * mostrar ainda.
 *
 * REVERTIDO (2026-09-03, a pedido — "estatísticas, deixa igual web",
 * comparado ao vivo num celular físico) — tinha virado carrossel de
 * rolagem horizontal (pedido anterior, "quero essas estatísticas
 * apareçam como carrossel"), cada item no seu próprio `Glass`
 * (BlurView aninhado) — a 4ª métrica (tempo assistindo filmes) ficava
 * fora da tela, só visível arrastando, e a estrutura toda ficou
 * diferente do card único do web. Voltou a ser uma grade 2×2 (`grid`
 * abaixo) DENTRO do mesmo `Glass` externo do card — igual ao web
 * (`apps/web/components/profile/StatisticsCard.tsx`: `grid grid-cols-2
 * gap-4`, cada item é só ícone + coluna de texto, sem card próprio por
 * item). Toque continua só na pílula "Ver detalhes" — no web também é
 * só o `Link` da pílula, o resto do card não é clicável.
 */
export function StatisticsCard() {
  const router = useRouter();
  const { stats, isLoading, isError, refetch } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading) {
    return (
      <View style={[styles.card, styles.cardStatic]}>
        <View style={styles.header}>
          <Skeleton width={120} height={16} />
        </View>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.gridItem}>
              <Skeleton width={16} height={16} style={styles.skeletonIcon} />
              <View style={styles.gridItemText}>
                <Skeleton width={50} height={fontSize.lg} />
                <Skeleton width={90} height={11} style={styles.skeletonLabel} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (isError || !stats) {
    return (
      <View style={[styles.card, styles.cardStatic]}>
        <PageError message={t("profile.errorLoadStats")} onRetry={() => refetch()} />
      </View>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes, t);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes, t);

  const preview: { label: string; value: string; icon: keyof typeof Feather.glyphMap }[] = [
    { label: t("profile.stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched), icon: "tv" },
    { label: t("profile.stats.moviesWatched"), value: numberFormatter.format(stats.moviesCompleted), icon: "film" },
    { label: t("profile.stats.timeWatchingSeries"), value: seriesTime.primary, icon: "clock" },
    { label: t("profile.stats.timeWatchingMovies"), value: movieTime.primary, icon: "video" },
  ];

  /*
   * Este card foi o corpo de prova da calibração do vidro (2026-09-04,
   * aprovada no aparelho): a cor do véu, medida contra os pixels do
   * web, virou o `base` das receitas em `lib/theme.ts` e vale pra todo
   * `Glass` do app. Nada especial aqui — usa o padrão, como os outros.
   */
  return (
    <Glass style={styles.card}>
      {/*
        * CORREÇÃO (a pedido, 2026-09-02 — comparação lado a lado com
        * print real do web, "não está igual") — `StatisticsCard.tsx`
        * do web pinta o card com DOIS `radial-gradient`: um branco no
        * canto superior esquerdo, outro azulado no canto inferior
        * direito, por CIMA do vidro neutro. O `Glass` genérico daqui
        * só tem o gradiente neutro (`glass.gradientNeutral`,
        * `Glass.tsx`, igual em todo card do app) — sem essas duas
        * manchas extras, o card ficava mais uniforme/chapado que o
        * web. Camadas extra aqui, iguais ao mesmo ajuste feito nas
        * pílulas de contagem do Perfil (`profile.tsx`) — ajuste no
        * COMPONENTE, `Glass.tsx` continua intocado.
        */}
      {/* `pointerEvents` é prop de `View`, não de `Image` — daí a View em volta (mesma caixa, geometria inalterada). */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {CARD_GLOWS.map((glow) => (
          <Image
            key={glow.key}
            source={GLOW_IMAGE}
            // `stretch` (e não `cover`): o web usa raios diferentes pra
            // largura e altura, ou seja uma ELIPSE — esticar a imagem na
            // caixa calculada é o que reproduz isso.
            resizeMode="stretch"
            style={{
              position: "absolute",
              left: glow.left,
              top: glow.top,
              width: glow.width,
              height: glow.height,
              tintColor: glow.tint,
              opacity: glow.opacity,
            }}
          />
        ))}
      </View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="bar-chart-2" size={16} color={colors.primary} />
          <Text variant="label">{t("profile.statistics")}</Text>
        </View>
        <Pressable onPress={() => router.push("/profile/stats")}>
          <GelSurface style={styles.pillButton} webCalibrated>
            <Text style={styles.pillButtonText}>{t("profile.viewDetails")}</Text>
            <Feather name="chevron-right" size={12} color={colors.background} />
          </GelSurface>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {preview.map((item) => (
          <View key={item.label} style={styles.gridItem}>
            {/*
             * CORREÇÃO (a pedido — "perfil não se parece com o web") —
             * era `colors.secondary` (teal). No `StatisticsCard.tsx` do
             * web, TODOS os ícones das 4 métricas usam `text-primary`
             * (âmbar) — decisão documentada explicitamente na sessão do
             * redesign "vidro" (2026-08-21): "Ícones: todos em âmbar,
             * incluindo os de estatísticas que no código original são
             * text-secondary (teal) — mudança deliberada". Esta tela só
             * não tinha recebido essa parte do port ainda.
             */}
            <Feather name={item.icon} size={16} color={colors.primary} />
            <View style={styles.gridItemText}>
              <Text style={styles.value} numberOfLines={1}>
                {item.value}
              </Text>
              {/*
               * CORREÇÃO (2026-09-03, achada comparando print real
               * mobile x web lado a lado, a pedido — "ainda não está
               * igual ao web") — tinha `numberOfLines={1}`, cortava a
               * legenda com "..." ("Episódios assi..", "Tempo vendo
               * ...") sempre que não cabia numa linha só. No
               * `StatisticsCard.tsx` do web, a classe da legenda
               * (`.lbl`/`text-xs text-muted`) NÃO tem `truncate` nem
               * `whitespace-nowrap` — o texto nunca é cortado, só quebra
               * linha se precisar. Aqui cabia numa linha só por acaso,
               * nas dimensões do web; no mobile, com a mesma fonte, não
               * cabia — daí o corte. Removido o limite de linha (deixa
               * quebrar como o CSS real do web permite) em vez de forçar
               * caber numa linha só com fonte menor ou coluna mais larga
               * — isso seria inventar um valor sem base no CSS de
               * verdade.
               */}
              <Text variant="muted" style={styles.label}>
                {item.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  skeletonLabel: {
    marginTop: 4,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    /*
     * A borda deste card NÃO é definida aqui de propósito. Ela vem do
     * `Glass` com a prop `rim`, que pinta COR POR LADO no mesmo anel de
     * 1px (topo claro, laterais no 0.10 literal do web, base escura) —
     * ver `rimBorder` em `components/ui/Glass.tsx`, com a medição.
     *
     * Uma tentativa anterior fixava `borderColor` uniforme em 0.06 aqui.
     * Removida: como o `style` do componente é a ÚLTIMA camada do array
     * no `Glass`, ela sobrescrevia as cores por lado e apagava
     * justamente a espessura de vidro que se queria.
     */
  },
  cardStatic: {
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.xs` (4); o web usa `gap-2` (`StatisticsCard.tsx`, "flex items-center gap-2" do cabeçalho) = 8px. */
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  /**
   * CORREÇÃO (2026-09-04, print real mobile × web) — a pílula estava
   * visivelmente menor que a do web. Valores do web
   * (`StatisticsCard.tsx`, classes do `Link`): `px-3.5` = 14px,
   * `py-2` = 8px, `gap-1` = 4px. Eu tinha 10 / 4 / 2 — cada um pela
   * metade ou perto disso, o que encolhia o botão inteiro.
   */
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    /**
     * CORREÇÃO (2026-09-04, medido) — o web usa `py-2` (8) e o mobile
     * também usava, mas a altura final saía menor: normalizando pela
     * largura do card, 7.51% contra 7.78% do web (~1px a menos). A causa
     * é a caixa de linha: o mesmo texto de 11px ocupa menos altura no RN
     * do que no navegador. Meio pixel de cada lado fecha exatamente essa
     * diferença, sem mexer em fonte nem em largura.
     */
    paddingVertical: spacing.sm + 0.5,
  },
  /**
   * CORREÇÃO (2026-09-03, a pedido — "o botão 'ver detalhes' ainda não
   * está igual ao web") — faltava `textTransform: "uppercase"` (web:
   * classe `uppercase`, `StatisticsCard.tsx`) — o texto vinha da
   * tradução em "Ver detalhes" (frase normal) e ficava assim na tela,
   * só o "Editar" (`profile.tsx`, `editButtonText`) já tinha esse
   * ajuste. Ver comentário em `Glass.tsx` (`gelWrap`) pro resto da
   * correção (borda + sombra que faltavam no botão em si).
   */
  pillButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.background,
    textTransform: "uppercase",
    /** `tracking-wide` do web = 0.025em; a 11px dá ~0.275px. Faltava aqui. */
    letterSpacing: 0.275,
  },
  /**
   * Grade 2×2 (ver comentário "REVERTIDO" no topo do arquivo) — igual
   * ao `grid grid-cols-2 gap-4` do web. `flexBasis: "47%"` (não 50%)
   * dá espaço pro `gap` entre colunas sem estourar a linha pra 3
   * colunas em telas estreitas.
   */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gridItemText: {
    flex: 1,
    minWidth: 0,
  },
  skeletonIcon: {
    borderRadius: radius.sm,
  },
  value: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era 11; o web usa `text-xs` (`StatisticsCard.tsx`, legenda de cada métrica) = 12px. */
  label: {
    fontSize: fontSize.xs,
  },
});
