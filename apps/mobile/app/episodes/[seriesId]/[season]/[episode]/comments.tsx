import { ScrollView, View, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { EpisodeCommentsSection } from "@/components/episode/EpisodeCommentsSection";
import { Screen, Text, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-122 (episódio) — porta de `CommentsPageView.tsx`: tela própria
 * (não mais embutida na tela de detalhes do episódio), igual ao web.
 */
export default function EpisodeCommentsScreen() {
  const router = useRouter();
  const { seriesId, season, episode } = useLocalSearchParams<{ seriesId: string; season: string; episode: string }>();
  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Comentários</Text>
      </View>

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
          <ScrollView contentContainerStyle={styles.content}>
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
  /**
   * CORREÇÃO (2026-09-04, decisão do usuário de 2026-09-03: padronizar
   * borda de tela em 16px app-wide) — `paddingHorizontal` era
   * `spacing.lg` (24) aqui e no `content` abaixo; o web usa `px-4`
   * (`spacing.md`=16). Esta tela tinha FICADO DE FORA daquela rodada
   * por um motivo de ferramenta, não de decisão: ela mora 8 pastas
   * abaixo da pasta conectada, e a ponte com o computador só alcança
   * 7 — só deu pra chegar nela quando os arquivos foram copiados à
   * mão pra um lugar mais raso.
   */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
});
