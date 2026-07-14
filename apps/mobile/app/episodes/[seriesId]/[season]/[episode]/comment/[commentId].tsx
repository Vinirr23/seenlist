import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCommentTree, fetchMediaComments, findCommentNode, postMediaComment, type MediaTarget } from "@/lib/social/mediaComments";
import { useEpisodeComments, useEpisodeSpoilerProtection } from "@/lib/social/useEpisodeComments";
import { EpisodeCommentItem } from "@/components/episode/EpisodeCommentItem";
import { SpoilerGate } from "@/components/reviews/SpoilerGate";
import { Screen, Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-132 — tela dedicada de comentário de episódio, a pedido,
 * diverge do web de propósito (lá, "Responder" aqui é embutido, sem
 * navegar — só o Feed navega). Construída igual à do Feed
 * (`/posts/[id]/comment/[commentId].tsx`): comentário em destaque no
 * topo, respostas dele abaixo, composer fixo que grava sempre como
 * resposta a ESTE comentário.
 */
export default function EpisodeCommentDetailScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { seriesId, season, episode, commentId } = useLocalSearchParams<{
    seriesId: string;
    season: string;
    episode: string;
    commentId: string;
  }>();

  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const target: MediaTarget = useMemo(
    () => ({ mediaType: "series", mediaId: seriesIdNum, seasonNumber, episodeNumber }),
    [seriesIdNum, seasonNumber, episodeNumber]
  );

  const { edit, remove } = useEpisodeComments(target);
  const autoHideSpoilers = useEpisodeSpoilerProtection(seriesIdNum, seasonNumber, episodeNumber);

  const [comment, setComment] = useState<ReturnType<typeof findCommentNode>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [markSpoiler, setMarkSpoiler] = useState(false);
  const [sending, setSending] = useState(false);

  function load() {
    setIsLoading(true);
    fetchMediaComments(target)
      .then((comments) => {
        const tree = buildCommentTree(comments);
        setComment(findCommentNode(tree, String(commentId)));
      })
      .catch((error) => console.error("[EpisodeCommentDetailScreen] Falha ao buscar comentário", error))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [target.mediaId, target.seasonNumber, target.episodeNumber, commentId]);

  async function handleSubmit() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await postMediaComment(target, body, markSpoiler, String(commentId));
      setBody("");
      setMarkSpoiler(false);
      load();
    } catch (error) {
      console.error("[EpisodeCommentDetailScreen] Falha ao responder", error);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    await remove(id);
    load();
  }

  async function handleEdit(id: string, newBody: string) {
    await edit(id, newBody);
    load();
  }

  const commentsBaseHref = `/episodes/${seriesIdNum}/${seasonNumber}/${episodeNumber}`;
  const isOwn = session?.user.id === comment?.author.userId;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Comentário</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text variant="muted">Carregando…</Text>
        ) : !comment ? (
          <Text variant="muted" style={styles.centerText}>
            Este comentário não existe mais.
          </Text>
        ) : (
          <>
            <View style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.authorName}>{comment.author.displayName ?? comment.author.username}</Text>
                <Text variant="muted" style={styles.date}>
                  {dateFormatter.format(new Date(comment.createdAt))}
                </Text>
              </View>
              <SpoilerGate hidden={comment.containsSpoiler || autoHideSpoilers}>
                {!!comment.body && <Text style={styles.body}>{comment.body}</Text>}
              </SpoilerGate>
              {isOwn && (
                <View style={styles.ownActionsRow}>
                  <Pressable onPress={() => handleDelete(comment.id)}>
                    <Text style={styles.deleteLabel}>Apagar</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.repliesArea}>
              {comment.children.length === 0 ? (
                <Text variant="muted" style={styles.centerText}>
                  Nenhuma resposta ainda.
                </Text>
              ) : (
                comment.children.map((child) => (
                  <EpisodeCommentItem
                    key={child.id}
                    comment={child}
                    depth={0}
                    autoHideSpoilers={autoHideSpoilers}
                    commentsBaseHref={commentsBaseHref}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </View>

            <View style={styles.composerArea}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Escreva uma resposta..."
                placeholderTextColor={colors.muted}
                multiline
                style={styles.input}
              />
              <View style={styles.composerFooter}>
                <Pressable style={styles.spoilerToggle} onPress={() => setMarkSpoiler((v) => !v)}>
                  <Feather name={markSpoiler ? "check-square" : "square"} size={16} color={markSpoiler ? colors.primary : colors.muted} />
                  <Text variant="muted" style={styles.spoilerLabel}>
                    Contém spoiler
                  </Text>
                </Pressable>
                <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={!body.trim() || sending}>
                  <Text style={styles.sendButtonText}>Enviar</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  commentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  ownActionsRow: {
    marginTop: spacing.xs,
  },
  deleteLabel: {
    fontSize: 12,
    color: colors.danger,
  },
  repliesArea: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  composerArea: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    minHeight: 60,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spoilerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spoilerLabel: {
    fontSize: 12,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.background,
  },
});
