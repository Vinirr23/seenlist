import { Pressable, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { ReviewTarget } from "@/lib/social/reviews";
import { useReviewAggregate } from "@/lib/social/useReviewAggregate";
import { Text, Glass } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useTranslation();
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

      {/*
        PORTE DO WEB (2026-09-09) — esta linha era SÓLIDA
        (`colors.surface` com borda escura), canto 10, recheio 8/16 e
        texto em peso 600. No `SeriesDetailsView.tsx` do web ela é a
        "glass-row": `rounded-2xl border border-white/10 px-4 py-3
        text-sm font-medium backdrop-blur-[18px]
        backdrop-saturate-[180%]` + brilho 0.17 / base 0.10 — ou seja, a
        receita `card` do `Glass`, canto 16, recheio 12/16, peso 500.
        O texto também estava escrito à mão, sem tradução.
      */}
      <Glass style={styles.link}>
        <Pressable style={styles.linkHit} onPress={() => router.push(href)}>
          <View style={styles.linkLeft}>
            <Feather name="star" size={16} color={colors.muted} />
            <Text style={styles.linkText}>{t("review.seeAll")}</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * No web o resumo e a linha "Ver todas" não são vizinhos coladinhos:
   * o resumo fecha a `<section>` de Avaliações e a linha é o item
   * SEGUINTE da pilha `space-y-6` da aba Sobre — 24 de distância, não 8.
   */
  wrapper: {
    gap: spacing.lg,
  },
  /** `rounded-2xl px-4 py-3` — a borda e o fundo vêm do `Glass`. */
  link: {
    borderRadius: radius.lg,
  },
  linkHit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12, // `py-3` (era 8)
    paddingHorizontal: spacing.md,
  },
  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  /** `text-sm font-medium` = 14/500 (era 600). */
  linkText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
