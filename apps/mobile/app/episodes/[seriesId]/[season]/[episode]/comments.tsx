import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { EpisodeCommentsSection } from "@/components/episode/EpisodeCommentsSection";
import { Screen, GlassTargetProvider, AmbientGlow, ScreenHeader } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { spacing } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-122 (episódio) — porta de `CommentsPageView.tsx`: tela própria
 * (não mais embutida na tela de detalhes do episódio), igual ao web.
 */
export default function EpisodeCommentsScreen() {
  const { t } = useTranslation();
  const { seriesId, season, episode } = useLocalSearchParams<{ seriesId: string; season: string; episode: string }>();
  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const espacoDoDock = useTabBarClearance();

  return (
    <Screen padded={false}>
      {/*
        * CORREÇÃO (auditoria de consistência, Fase 2, 2026-09-26) —
        * título estava fixo em "Comentários" (não traduzido); nova
        * chave `social.commentsTitle` (traduzida nas 3 línguas) e
        * `<ScreenHeader>` compartilhado, mesmo padrão das outras
        * telas simples de voltar+título.
        */}
      <ScreenHeader title={t("social.commentsTitle")} />

      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas
        * de `CommentsPageView.tsx` do web, que é exatamente o
        * equivalente desta tela (ver `lib/glowBlobs.ts`). É ele que faz
        * o composer e os cartões de comentário (`EpisodeCommentsSection`/
        * `EpisodeCommentItem`, já convertidos pra `Glass`) terem o que
        * borrar — sem isso eles caem no fallback "borda simples".
        */}
      <GlassTargetProvider style={styles.flex} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
            <EpisodeCommentsSection
              target={{ mediaType: "series", mediaId: seriesIdNum, seasonNumber, episodeNumber }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    /**
     * CORREÇÃO (2026-09-25, bug reportado — "respondi um comentário e
     * ficou por trás da barra de navegação") — esta tela nunca chamava
     * `useTabBarClearance()`, então só tinha o `paddingBottom` estático
     * abaixo (`spacing.xl`), insuficiente pra reservar espaço pro dock
     * flutuante (`position: absolute`, não reserva espaço sozinho — ver
     * comentário do próprio hook em `useTabBarClearance.ts`, "VALE PRA
     * TODAS AS TELAS"). O valor dinâmico é aplicado no array de estilo
     * do `ScrollView` abaixo e substitui este fallback estático.
     */
    paddingBottom: spacing.xl,
  },
});
