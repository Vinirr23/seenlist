import { useEffect, useState } from "react";
import { ScrollView, View, Image, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyComments, deleteMyComment, type MyComment } from "@/lib/myComments";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * TASK-116 (correção — Perfil) — porta de `MyCommentsPageView.tsx` +
 * `MyCommentRow.tsx`. Sem "Editar" (o web abre a mídia com o
 * comentário já focado pra editar lá) — aqui só ver e apagar; editar
 * o texto de um comentário antigo é uma ação rara o bastante pra não
 * justificar replicar esse fluxo específico agora.
 */
export default function MyCommentsScreen() {
  const router = useRouter();
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  function load() {
    setIsLoading(true);
    fetchMyComments()
      .then(setComments)
      .catch((error) => {
        console.error("[MyCommentsScreen] Falha ao buscar comentários", error);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  function handleOpen(comment: MyComment) {
    if (comment.seasonNumber != null && comment.episodeNumber != null) {
      router.push(`/episodes/${comment.mediaId}/${comment.seasonNumber}/${comment.episodeNumber}`);
    } else if (comment.mediaType === "movie") {
      router.push(`/movies/${comment.mediaId}`);
    } else {
      router.push(`/series/${comment.mediaId}`);
    }
  }

  function handleDelete(comment: MyComment) {
    Alert.alert("Apagar este comentário?", "Não dá pra desfazer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyComment(comment.id);
            load();
          } catch (error) {
            console.error("[MyCommentsScreen] Falha ao apagar comentário", error);
          }
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Comentários</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text variant="muted">Carregando…</Text>
        ) : isError ? (
          <Text variant="muted">Não foi possível carregar seus comentários agora.</Text>
        ) : !comments || comments.length === 0 ? (
          <Text variant="muted">Você ainda não fez nenhum comentário.</Text>
        ) : (
          <View style={styles.list}>
            {comments.map((comment) => {
              const posterUrl = tmdbImageUrl(comment.mediaPosterPath, "w185");
              const episodeCode =
                comment.seasonNumber != null && comment.episodeNumber != null ? `T${comment.seasonNumber} · E${comment.episodeNumber}` : null;

              return (
                <View key={comment.id} style={styles.row}>
                  <Pressable style={styles.rowContent} onPress={() => handleOpen(comment)}>
                    <View style={styles.posterWrapper}>
                      {posterUrl ? (
                        <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
                      ) : (
                        <Feather name="film" size={16} color={colors.muted} />
                      )}
                    </View>
                    <View style={styles.info}>
                      <Text numberOfLines={1} variant="muted" style={styles.mediaTitle}>
                        {comment.mediaTitle}
                        {episodeCode ? ` · ${episodeCode}` : ""}
                      </Text>
                      <Text variant="muted" style={styles.date}>
                        {dateFormatter.format(new Date(comment.createdAt))}
                      </Text>
                      <Text numberOfLines={3} style={styles.body}>
                        {comment.containsSpoiler ? "Contém spoiler — toque para ver" : comment.body}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => handleDelete(comment)}>
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
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
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  posterWrapper: {
    width: 44,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  mediaTitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  date: {
    fontSize: 11,
    marginTop: 1,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
});
