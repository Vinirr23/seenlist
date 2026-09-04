import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Pressable, Alert, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyComments, deleteMyComment, type MyComment } from "@/lib/myComments";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/**
 * TASK-116 (correção — Perfil) — porta de `MyCommentsPageView.tsx` +
 * `MyCommentRow.tsx`. Sem "Editar" (o web abre a mídia com o
 * comentário já focado pra editar lá) — aqui só ver e apagar; editar
 * o texto de um comentário antigo é uma ação rara o bastante pra não
 * justificar replicar esse fluxo específico agora.
 *
 * CORREÇÃO (a pedido — mesmo achado #3 já corrigido no Perfil,
 * "sem limite nenhum na busca") — `fetchMyComments` busca TODO
 * comentário que a pessoa já fez, sem limite (correto — não é uma
 * paginação, é "tudo mesmo"), mas antes desenhava tudo de uma vez
 * com `ScrollView`+`.map()`, sem virtualização — pra quem comenta
 * bastante, trava a rolagem. Trocado por `FlatList`.
 */
export default function MyCommentsScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" }),
    [locale]
  );
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  function load() {
    setIsLoading(true);
    fetchMyComments(locale)
      .then(setComments)
      .catch((error) => {
        console.error("[MyCommentsScreen] Falha ao buscar comentários", error);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [locale]);

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
    Alert.alert(t("social.confirmDeleteCommentTitle"), t("social.confirmDeleteCommentMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
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

  const renderItem = useCallback(
    ({ item: comment }: { item: MyComment }) => {
      const posterUrl = tmdbImageUrl(comment.mediaPosterPath, "w185");
      const episodeCode =
        comment.seasonNumber != null && comment.episodeNumber != null ? `T${comment.seasonNumber} · E${comment.episodeNumber}` : null;

      return (
        <View style={styles.row}>
          <Pressable style={styles.rowContent} onPress={() => handleOpen(comment)}>
            <View style={styles.posterWrapper}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
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
                {comment.containsSpoiler ? t("social.spoilerTapToReveal") : comment.body}
              </Text>
            </View>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => handleDelete(comment)}>
            <Feather name="trash-2" size={16} color={colors.danger} />
          </Pressable>
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleOpen/handleDelete são recriadas a cada render mas são estáveis o bastante (mesmo padrão de antes); t/dateFormatter SÃO dependências reais agora, precisam entrar na lista pra não travar num idioma antigo.
    [t, dateFormatter]
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("profile.commentsTitle")}</Text>
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <AvatarRowSkeleton />
        </View>
      ) : isError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadCommentsFailed")} onRetry={load} />
        </View>
      ) : !comments || comments.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf icon="message-circle" message={t("profile.noCommentsYet")} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(comment) => comment.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, styles.list]}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
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
