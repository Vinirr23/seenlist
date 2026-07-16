import { useState } from "react";
import { View, Image, TextInput, Pressable, Share, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Post } from "@/lib/posts";
import { editPost, deletePost } from "@/lib/posts";
import { reportPost } from "@/lib/social/postReports";
import { tmdbImageUrl } from "@/lib/library";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Text, Button } from "@/components/ui";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { LikeButton } from "./LikeButton";
import { CommentCount } from "./CommentCount";
import { SaveButton } from "./SaveButton";
import { PostCommentsSection } from "./PostCommentsSection";
import { AdaptiveImage } from "@/components/media/AdaptiveImage";
import { PollBlock } from "./PollBlock";
import type { PollData } from "@/lib/social/polls";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const SITE_URL = "https://seenlist.app";

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
 * TASK-112 (editar/apagar post) — porta do que faltava do
 * `PostCard.tsx` do web: menu "...", editar/apagar (só dono),
 * denunciar (quem não é dono), salvar. "Copiar link" ficou de fora —
 * usa só `Share.share` nativo (que já oferece copiar como uma das
 * opções do próprio sistema), sem precisar de uma dependência nova
 * (`expo-clipboard`) só pra isso.
 *
 * `onDeleted` é opcional: quem usa o card decide o que fazer depois
 * de apagar (Feed recarrega a lista; a tela de detalhe do post volta
 * pro Feed, já que o post que ela mostrava deixou de existir).
 */
export function PostCard({
  post,
  detail = false,
  onDeleted,
  likeInfo,
  isSaved,
  commentCount,
  pollInfo,
}: {
  post: Post;
  detail?: boolean;
  onDeleted?: () => void;
  /** TASK-153 — quando quem chama já buscou isso em lote (Feed), passa pronto aqui. */
  likeInfo?: { count: number; hasLiked: boolean };
  isSaved?: boolean;
  commentCount?: number;
  /** TASK-163 — mesmo padrão de likeInfo/isSaved/commentCount: Feed busca em lote e passa pronto. */
  pollInfo?: PollData;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const posterUrl = post.mediaPosterPath ? tmdbImageUrl(post.mediaPosterPath, "w185") : null;
  const isOwner = session?.user.id === post.userId;

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [currentBody, setCurrentBody] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [reported, setReported] = useState(false);

  function handlePress() {
    if (detail) return;
    router.push(`/posts/${post.id}`);
  }

  async function handleShare() {
    setMenuOpen(false);
    try {
      await Share.share({ url: `${SITE_URL}/explore/posts/${post.id}`, message: `${SITE_URL}/explore/posts/${post.id}` });
    } catch (error) {
      console.error("[PostCard] Falha ao compartilhar", error);
    }
  }

  function handleStartEdit() {
    setEditBody(currentBody);
    setEditing(true);
    setMenuOpen(false);
  }

  async function handleSaveEdit() {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await editPost(post.id, trimmed);
      setCurrentBody(trimmed);
      setEditing(false);
    } catch (error) {
      console.error("[PostCard] Falha ao editar post", error);
      Alert.alert("Não foi possível editar agora", "Tente de novo em instantes.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    setMenuOpen(false);
    Alert.alert("Apagar este post?", "Não dá pra desfazer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(post.id);
            if (detail) router.replace("/(tabs)/feed");
            onDeleted?.();
          } catch (error) {
            console.error("[PostCard] Falha ao apagar post", error);
            Alert.alert("Não foi possível apagar agora", "Tente de novo em instantes.");
          }
        },
      },
    ]);
  }

  async function handleReport() {
    setMenuOpen(false);
    try {
      await reportPost(post.id, "inadequado");
      setReported(true);
    } catch (error) {
      console.error("[PostCard] Falha ao denunciar", error);
    }
  }

  const Wrapper = detail ? View : Pressable;

  return (
    <Wrapper style={styles.card} {...(detail ? {} : { onPress: handlePress })}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.header}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/u/${post.authorUsername}`);
          }}
        >
          <View style={styles.avatar}>
            {post.authorAvatarUrl ? (
              <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{initials(post.authorName)}</Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.authorName}>
              {post.authorName}
            </Text>
            <Text numberOfLines={1} variant="muted" style={styles.meta}>
              @{post.authorUsername} · {dateFormatter.format(new Date(post.createdAt))}
            </Text>
          </View>
        </Pressable>

        <Pressable
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation();
            setMenuOpen(true);
          }}
        >
          <Feather name="more-horizontal" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {post.type === "review" && post.mediaTitle && (
        <View style={styles.reviewCard}>
          <View style={styles.reviewPoster}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.reviewPosterImage} resizeMode="cover" />
            ) : (
              <Feather name="film" size={16} color={colors.muted} />
            )}
          </View>
          <View style={styles.reviewInfo}>
            <Text numberOfLines={1} style={styles.reviewTitle}>
              {post.mediaTitle}
            </Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Feather key={i} name="star" size={13} color={i < (post.rating ?? 0) ? colors.primary : colors.border} />
              ))}
              <Text style={styles.ratingText}>{(post.rating ?? 0).toFixed(1)}/5</Text>
            </View>
          </View>
        </View>
      )}

      {editing ? (
        <View style={styles.editArea}>
          <TextInput value={editBody} onChangeText={setEditBody} multiline maxLength={500} autoFocus style={styles.editInput} />
          <View style={styles.editButtons}>
            <Pressable onPress={() => setEditing(false)} style={styles.editCancelButton}>
              <Text variant="muted">Cancelar</Text>
            </Pressable>
            <View style={styles.editSaveButton}>
              <Button onPress={handleSaveEdit} loading={saving} disabled={!editBody.trim()}>
                Salvar
              </Button>
            </View>
          </View>
        </View>
      ) : (
        !!currentBody && <Text style={styles.body}>{currentBody}</Text>
      )}

      {!!post.imageUrl && <AdaptiveImage uri={post.imageUrl} />}

      {post.type === "poll" && <PollBlock postId={post.id} initial={pollInfo} />}

      <View style={styles.footer}>
        <LikeButton targetType="post" targetId={post.id} initial={likeInfo} />
        <CommentCount postId={post.id} initial={commentCount} />
        <SaveButton postId={post.id} initial={isSaved} />
      </View>

      {detail && <PostCommentsSection postId={post.id} />}

      {menuOpen && (
        <OptionSheet
          title={post.authorName}
          onDismiss={() => setMenuOpen(false)}
          actions={[
            { label: "Compartilhar", onPress: handleShare },
            ...(isOwner
              ? [
                  { label: "Editar", onPress: handleStartEdit },
                  { label: "Apagar", danger: true, onPress: handleDelete },
                ]
              : [{ label: reported ? "Denunciado" : "Denunciar", danger: true, onPress: handleReport }]),
          ]}
        />
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  header: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    fontSize: 11,
  },
  reviewCard: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  reviewPoster: {
    width: 44,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reviewPosterImage: {
    width: "100%",
    height: "100%",
  },
  reviewInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  reviewTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    marginLeft: spacing.xs,
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  body: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  editArea: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  editInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  editCancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  editSaveButton: {
    minWidth: 100,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
});
