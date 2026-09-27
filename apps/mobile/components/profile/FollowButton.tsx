import { StyleSheet } from "react-native";
import { Text, PressableScale } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function FollowButton({ isFollowing, busy, onPress }: { isFollowing: boolean; busy: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    // CORREÇÃO (2026-09-16, a pedido — "no web, quando aperto algum
    // botão pílula glass, tem uma pequena animação, confere e adiciona
    // também") — conferido no web (`FollowButton.tsx`): `active:scale-
    // [0.96]`. Aqui era `Pressable` puro, sem nenhum feedback de
    // toque — trocado por `PressableScale`.
    <PressableScale style={[styles.button, isFollowing ? styles.following : styles.notFollowing]} onPress={onPress} disabled={busy}>
      <Text style={isFollowing ? styles.followingText : styles.notFollowingText}>
        {isFollowing ? t("profile.following") : t("profile.follow")}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  notFollowing: {
    backgroundColor: colors.primary,
  },
  /**
   * CORREÇÃO (2026-09-24, a pedido — "o botão 'follow' é âmbar, usa a
   * cor azul que usamos na aba interna 'em breve' pra 'following' ao
   * invés desse preto") — era `backgroundColor: colors.background`
   * (a mesma cor de fundo do app inteiro, por isso "parecia preto") +
   * borda cinza padrão. Trocado pelo novo token `colors.info` (ver o
   * comentário grande em `lib/theme.ts` — mesma família de azul da aba
   * "Em breve", `gelBlue`). Borda continua, só que na MESMA cor do
   * preenchimento (mais clara — `rgb(103,176,247)`, o `border.top` de
   * `gelBlue` em `lib/theme.ts`) em vez do `colors.border` cinza, que
   * ficava sem contraste nenhum contra o novo fundo azul.
   */
  following: {
    borderWidth: 1,
    borderColor: "rgb(103,176,247)",
    backgroundColor: colors.info,
  },
  notFollowingText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    color: colors.background,
  },
  /** Texto claro pra contrastar com o novo fundo azul sólido (era `colors.text` sobre fundo escuro; sobre `colors.info` ficava sem contraste). */
  followingText: {
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    color: colors.text,
  },
});
