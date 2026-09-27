import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Pressable, Alert, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyComments, deleteMyComment, type MyComment } from "@/lib/myComments";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text, GlassTargetProvider, Glass, AmbientGlow, ScreenHeader } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

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
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" }),
    [locale]
  );
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
  // 2026-09-26) — achado real: apagar comentário aqui não indicava
  // exclusão em andamento nem tratava falha (só `console.error`, sem
  // aviso pra pessoa) — guarda o id do item sendo apagado (lista tem
  // vários itens, cada um com seu próprio botão).
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          setDeletingId(comment.id);
          try {
            await deleteMyComment(comment.id);
            load();
          } catch (error) {
            console.error("[MyCommentsScreen] Falha ao apagar comentário", error);
            Alert.alert(t("social.errorDeleteComment"), t("common.tryAgainShortly"));
          } finally {
            setDeletingId(null);
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
        // PORTE DO WEB (2026-09-04, "vidro que falta") — cada linha vira
        // "glass-row" (web, `MyCommentRow.tsx`: "virou glass-row, mesmo
        // padrão de ExploreActivityTab.tsx/ProfileSectionRow.tsx, em vez
        // de linha lisa com `border-b`") — por isso a borda de baixo
        // saiu daqui: agora cada linha é um cartão com borda própria.
        <Glass style={styles.row}>
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
          <Pressable hitSlop={8} onPress={() => handleDelete(comment)} disabled={deletingId === comment.id}>
            {deletingId === comment.id ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Feather name="trash-2" size={16} color={colors.danger} />
            )}
          </Pressable>
        </Glass>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleOpen/handleDelete são recriadas a cada render mas são estáveis o bastante (mesmo padrão de antes); t/dateFormatter/deletingId SÃO dependências reais agora, precisam entrar na lista pra não travar num idioma antigo nem esconder o spinner do item certo.
    [t, dateFormatter, deletingId]
  );

  return (
    <Screen padded={false}>
      {/* CORREÇÃO (Fase 3, achado alto — ScreenHeader não chegou a esta tela) — era um cabeçalho manual, divergente das ~24 telas já convertidas na Fase 2. */}
      <ScreenHeader title={t("profile.commentsTitle")} />

      {/* PORTE DO WEB (2026-09-04, "vidro que falta") — mesmo campo de manchas de `MyCommentsPageView.tsx` do web (ver `lib/glowBlobs.ts`). */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
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
            contentContainerStyle={[styles.content, styles.list, { paddingBottom: espacoDoDock }]}
          />
        )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — a borda de baixo saiu
  // (era o separador da lista lisa); agora cada linha é um `<Glass>`
  // com borda/blur próprios, e o respiro entre elas vem do `list.gap`.
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    // Web usa `rounded-2xl` (16px) na glass-row = `radius.lg`.
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (eram literais 11, mesmo valor).
  mediaTitle: {
    fontSize: fontSize.xxs,
    fontWeight: "600",
  },
  date: {
    fontSize: fontSize.xxs,
    marginTop: 1,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
});
