import { useEffect, useState, useCallback } from "react";
import { View, Image, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { MediaTarget } from "@/lib/social/mediaComments";
import { fetchMediaComments, postMediaComment, type MediaComment } from "@/lib/social/mediaComments";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-115 (episódio) — versão simplificada: lista plana, sem
 * responder (`parent_comment_id` sempre nulo). O Feed e as
 * Avaliações já têm padrões de comentário mais ricos (respostas,
 * curtidas) — replicar tudo isso aqui também inflaria bastante esta
 * leva; comentar o episódio em si já é o essencial coberto.
 */
export function EpisodeCommentsSection({ target }: { target: MediaTarget }) {
  const router = useRouter();
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    fetchMediaComments(target)
      .then(setComments)
      .catch((error) => console.error("[EpisodeCommentsSection] Falha ao buscar comentários", error))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.mediaType, target.mediaId, target.seasonNumber, target.episodeNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await postMediaComment(target, body);
      setBody("");
      load();
    } catch (error) {
      console.error("[EpisodeCommentsSection] Falha ao comentar", error);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text variant="subtitle" style={styles.title}>
        Comentários
      </Text>

      {isLoading ? (
        <Text variant="muted">Carregando…</Text>
      ) : comments.length === 0 ? (
        <Text variant="muted">Nenhum comentário ainda.</Text>
      ) : (
        <View style={styles.list}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <Pressable style={styles.avatar} onPress={() => router.push(`/u/${comment.author.username}`)}>
                {comment.author.avatarUrl ? (
                  <Image source={{ uri: comment.author.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials(comment.author.displayName ?? comment.author.username)}</Text>
                )}
              </Pressable>
              <View style={styles.commentBody}>
                <View style={styles.commentHeader}>
                  <Text style={styles.authorName}>{comment.author.displayName ?? comment.author.username}</Text>
                  <Text variant="muted" style={styles.date}>
                    {dateFormatter.format(new Date(comment.createdAt))}
                  </Text>
                </View>
                {!!comment.body && <Text style={styles.commentText}>{comment.body}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.composerRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Escreva um comentário..."
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={!body.trim() || sending}>
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  title: {
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  authorName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  commentText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.text,
  },
  composerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm - 2,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  sendButton: {
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.background,
  },
});
