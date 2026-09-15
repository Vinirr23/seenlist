import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ReviewsFullView } from "@/components/reviews/ReviewsFullView";
import { Screen, Text, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * A PEDIDO (implementar tudo igual ao web) — tela própria
 * "Avaliações", igual `CommentsPageView.tsx`/`ReviewTextSection.tsx`
 * do web (`/series/[id]/comments`, que hoje só mostra review em
 * texto). Título/pôster chegam via parâmetro de rota (mandados por
 * `ReviewsSection.tsx` ao navegar) — evita buscar os detalhes da
 * série de novo só pra isso.
 */
export default function SeriesReviewsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const { id, title, posterPath } = useLocalSearchParams<{ id: string; title: string; posterPath: string }>();
  const numericId = Number(id);

  return (
    <Screen padded={false}>
      {/*
        PORTE DO WEB (2026-09-09, comparado no print) — o cabeçalho
        desta tela é o do `CommentsPageView.tsx`:
        `flex items-center gap-3 border-b border-white/10 px-4 py-3`
        com o título em `text-xl font-bold` (20px/700). Aqui o espaço
        era 8, a altura 8/8, o título `variant="subtitle"` (18px/600) e
        NÃO havia a linha embaixo — o cabeçalho não se separava do
        conteúdo.
      */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("social.reviews")}</Text>
      </View>

      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") — campo de
        * manchas de fundo igual ao das telas de Comentários do web
        * (`CommentsPageView.tsx`), que é o equivalente lá desta tela
        * (ver docstring acima). O `GlassTargetProvider` é o que faz os
        * cards `<Glass>` de dentro (`ReviewComposer`/`ReviewCard`/
        * `ReviewSummary`) terem o que borrar.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          <ReviewsFullView
            target={{ mediaType: "series", mediaId: numericId }}
            media={{ title: title ?? "", posterPath: posterPath || null }}
          />
        </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12, // `gap-3` (era 8)
    paddingHorizontal: spacing.md,
    paddingTop: 12, // `py-3` (era 8)
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)", // `border-b border-white/10`
  },
  /** `text-xl font-bold` = 20/700 (era `variant="subtitle"` = 18/600). */
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  /** O `PageContainer` do web entra com `pt-6` e o conteúdo com `py-4` por dentro — 40 no total antes do primeiro card. Aqui não havia respiro nenhum. */
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: 40,
    paddingBottom: spacing.xl,
  },
});
