import { View, Image, Pressable, StyleSheet, type ImageSourcePropType } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text, GelSurface } from "@/components/ui";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

const EMPTY_LIBRARY_SCENE = require("../../assets/images/empty-library-scene.png") as ImageSourcePropType;

/**
 * PORTE DO WEB (2026-09-10, achado numa auditoria — Séries/Filmes com
 * "Assistir depois" vazio) — no web (`EmptyLibraryHero.tsx`) o estado
 * vazio de verdade (não o card de erro/carregando) é ilustração +
 * título + subtítulo + botão + divisor "OU", soltos DIRETAMENTE em
 * cima do fundo da Home (sem card, sem borda, sem vidro em volta —
 * ver o histórico enorme de comentários no arquivo do web sobre por
 * que não pode parecer uma caixa). Aqui usava o `EmptyShelf` (card com
 * borda tracejada) igual a qualquer outro estado vazio do app — sem
 * ilustração nenhuma. Este componente é a porta fiel do `EmptyLibraryHero`
 * do web; `EmptyShelf` continua existindo pros outros usos (esses,
 * sim, são cards de verdade no web também).
 *
 * A imagem (`empty-library-scene.png`, luminária + gato dormindo +
 * pipoca + planta) é o MESMO arquivo PNG do web, copiado sem
 * reprocessar — real canal alfa, sem retângulo de fundo (ver
 * comentário completo no arquivo do web sobre a conferência pixel a
 * pixel que confirmou isso antes de usar).
 */
export function EmptyLibraryHero({
  title,
  subtitle,
  actionLabel,
  actionHref,
  dividerLabel,
}: {
  title: string;
  subtitle?: string;
  actionLabel: string;
  actionHref: Href;
  dividerLabel?: string;
}) {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      {/** `-mb-3 aspect-[3/2] w-full max-w-[437px]` — a ilustração "morde" o espaço de baixo. */}
      <View style={styles.illustrationBox}>
        <Image source={EMPTY_LIBRARY_SCENE} style={styles.illustration} resizeMode="contain" />
      </View>

      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {/** Mesmo "gel" âmbar calibrado do botão de `EmptyShelf`, só que com as medidas próprias deste botão (`px-[29px] py-[13px] text-[15px]`, ícone 18). */}
      <Pressable onPress={() => router.push(actionHref)}>
        <GelSurface style={styles.action} webCalibrated>
          <Feather name="plus" size={18} color={colors.background} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </GelSurface>
      </Pressable>

      {!!dividerLabel && (
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>{dividerLabel}</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `flex flex-col items-center px-2 pt-0 text-center`. */
  wrapper: {
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  illustrationBox: {
    width: "100%",
    maxWidth: 437,
    aspectRatio: 3 / 2,
    marginBottom: -12,
  },
  illustration: {
    width: "100%",
    height: "100%",
  },
  /** `text-xl font-bold text-text` = 20px (a escala do app não tem 20 exato — `fontSize.xl` é 22). */
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  /** `mt-2 max-w-[280px] text-sm leading-relaxed text-muted`. */
  subtitle: {
    marginTop: spacing.xs,
    maxWidth: 280,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.625,
    color: colors.muted,
    textAlign: "center",
  },
  /**
   * `mt-5 ... gap-1.5 rounded-full px-[29px] py-[13px]`.
   *
   * CORREÇÃO (2026-09-10, reportado — "botão 'Explorar séries' está
   * quadrado") — o comentário acima sempre disse `rounded-full`, mas
   * o `borderRadius` nunca foi escrito de verdade nesta folha de
   * estilo — ficou reto desde a criação do componente.
   */
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.lg - 4, // 20
    paddingHorizontal: 29,
    paddingVertical: 13,
    borderRadius: radius.full,
  },
  /** `text-[15px] font-bold text-background`. */
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.background,
  },
  /** `mt-6 flex w-full items-center gap-3 text-[11px] ... uppercase tracking-wide text-muted/70`. */
  dividerRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dividerLabel: {
    fontSize: fontSize.xxs,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(140,147,168,0.7)",
  },
});
