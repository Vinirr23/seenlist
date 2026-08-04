import { Pressable, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { ReviewTarget } from "@/lib/social/reviews";
import { useReviewAggregate } from "@/lib/social/useReviewAggregate";
import { Text } from "@/components/ui";
import { ReviewSummary } from "./ReviewSummary";
import { colors, radius, spacing } from "@/lib/theme";

export interface ReviewsSectionProps {
  target: ReviewTarget;
  media: { title: string; posterPath: string | null };
}

/**
 * A PEDIDO (implementar tudo igual ao web, revertendo uma decisão
 * tomada sem confirmar antes) — esta seção (aba Sobre) volta a ser
 * só o RESUMO da comunidade (nota média + distribuição), sem nada
 * pra preencher — mesma estrutura do `ReviewsSection.tsx` do web.
 * Nota, texto, e "Publicar também no Feed" moraram aqui antes;
 * agora vivem todos juntos na tela separada "Avaliações"
 * (`app/series/[id]/reviews.tsx` / `app/movies/[id]/reviews.tsx`),
 * acessada pelo link "Ver todas as avaliações" abaixo.
 */
export function ReviewsSection({ target, media }: ReviewsSectionProps) {
  const router = useRouter();
  const aggregate = useReviewAggregate(target);

  const basePath = target.mediaType === "movie" ? "movies" : "series";
  const href = {
    pathname: `/${basePath}/[id]/reviews` as const,
    params: { id: String(target.mediaId), title: media.title, posterPath: media.posterPath ?? "" },
  };

  return (
    <View style={styles.wrapper}>
      {aggregate && <ReviewSummary aggregate={aggregate} />}

      <Pressable style={styles.link} onPress={() => router.push(href)}>
        <View style={styles.linkLeft}>
          <Feather name="star" size={16} color={colors.muted} />
          <Text style={styles.linkText}>Ver todas as avaliações</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
