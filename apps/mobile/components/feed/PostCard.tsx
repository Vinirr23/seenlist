import { memo, useState } from "react";
import { View, TextInput, Pressable, Share, Alert, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Post } from "@/lib/posts";
import { editPost, deletePost } from "@/lib/posts";
import { reportPost } from "@/lib/social/postReports";
import { tmdbImageUrl } from "@/lib/library";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Text, Button } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { LikeButton } from "./LikeButton";
import { AnimatedStar } from "./AnimatedStar";
import { CommentCount } from "./CommentCount";
import { PostCommentsSection } from "./PostCommentsSection";
import { AdaptiveImage } from "@/components/media/AdaptiveImage";
import { PollBlock } from "./PollBlock";
import type { PollData } from "@/lib/social/polls";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useNow } from "@/lib/useNow";
import { formatRelativeTime } from "@/lib/relativeTime";
import { hapticTick, hapticWarning } from "@/lib/haptics";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const SITE_URL = "https://seenlist.app";

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
 *
 * CORREÇÃO DE DESEMPENHO (2026-09-29, reportado — "a rolagem do feed
 * está travando") — causa raiz: `feed.tsx` reconstrói `likeInfoByPostId`/
 * `commentCountByPostId`/`pollDataByPostId` do ZERO (`fetchLikeInfoFor`
 * etc.) toda vez que roda `loadInteractions()` — o que acontece a cada
 * curtida/comentário/voto de enquete em QUALQUER post visível, de
 * QUALQUER pessoa (a assinatura Realtime dispara isso, com debounce de
 * 400ms). Como o Map é novo, `likeInfoByPostId.get(post.id)` devolve
 * um objeto NOVO pra TODO post, mesmo pros que não mudaram nada — sem
 * `memo`, isso forçava o React a re-renderizar TODOS os `PostCard`s
 * visíveis de uma vez a cada evento de atividade no feed, e se isso
 * cair no meio de uma rolagem, compete pelo mesmo frame que o scroll
 * está tentando desenhar. `memo` com comparação por VALOR (não por
 * referência do objeto) resolve sem mudar nenhum comportamento visível
 * — só evita recalcular um card cujos dados de verdade não mudaram.
 */
interface PostCardProps {
  post: Post;
  detail?: boolean;
  onDeleted?: () => void;
  /** TASK-153 — quando quem chama já buscou isso em lote (Feed), passa pronto aqui. */
  likeInfo?: { count: number; hasLiked: boolean };
  commentCount?: number;
  /** TASK-163 — mesmo padrão de likeInfo/commentCount: Feed busca em lote e passa pronto. */
  pollInfo?: PollData;
}

function PostCardComponent({ post, detail = false, onDeleted, likeInfo, commentCount, pollInfo }: PostCardProps) {
  const router = useRouter();
  const { session } = useAuth();
  const posterUrl = post.mediaPosterPath ? tmdbImageUrl(post.mediaPosterPath, "w342") : null;
  const isOwner = session?.user.id === post.userId;
  const { t, locale } = useTranslation();
  const now = useNow(30_000);

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
    hapticTick();
    setSaving(true);
    try {
      await editPost(post.id, trimmed);
      setCurrentBody(trimmed);
      setEditing(false);
    } catch (error) {
      console.error("[PostCard] Falha ao editar post", error);
      Alert.alert(t("feed.errorEditPost"), t("feed.tryAgainShortly"));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    setMenuOpen(false);
    Alert.alert(t("feed.confirmDeletePostTitle"), t("feed.confirmDeletePostMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          hapticWarning();
          try {
            await deletePost(post.id);
            if (detail) router.replace("/(tabs)/feed");
            onDeleted?.();
          } catch (error) {
            console.error("[PostCard] Falha ao apagar post", error);
            Alert.alert(t("feed.errorDeletePost"), t("feed.tryAgainShortly"));
          }
        },
      },
    ]);
  }

  async function handleReport() {
    setMenuOpen(false);
    hapticWarning();
    try {
      await reportPost(post.id, "inadequado");
      setReported(true);
    } catch (error) {
      console.error("[PostCard] Falha ao denunciar", error);
    }
  }

  /**
   * CORREÇÃO (bug real, reportado com pilha de componentes — crash
   * no Feed, "Cannot read property 'prototype' of undefined") —
   * antes, o componente da tag era escolhido em tempo de execução
   * (`const Wrapper = detail ? View : Pressable`) — padrão frágil
   * nesse ambiente (Hermes/bundler), risco real de exatamente esse
   * tipo de erro. Trocado por SEMPRE `Pressable`, só desligando o
   * toque (`disabled`) na tela de detalhe — mesmo resultado visual e
   * de comportamento, sem trocar o componente dinamicamente.
   */
  return (
    // A PEDIDO (2026-09-28, print real — "feed não recebeu glass") —
    // este card ficou de fora do redesign "âmbar/vidro" (Aug/2026)
    // porque o Feed estava desativado nessa época inteira (ver
    // `SEENLIST-HANDOFF.md`, seção "Feed social"); reativar sozinho não
    // corrige isso, então a mesma receita de `ReviewCard.tsx` ("vidro
    // que falta", 2026-09-04) entra aqui agora: `Pressable` cuida só do
    // toque (abrir detalhe), `Glass` cuida do visual (era `View` com
    // `backgroundColor: colors.surface` chapado).
    <Pressable onPress={detail ? undefined : handlePress} disabled={detail}>
      {/*
        * A PEDIDO (2026-09-29 — "deixa o feed igual o feed do threads,
        * sem efeito, separado por linha") — tirado o `Glass` (vidro/blur)
        * inteiro daqui: virou `View` simples, sem fundo nem borda ao
        * redor, só uma linha fina embaixo separando um post do próximo
        * (`styles.card`, `borderBottomWidth`). Resolve de vez, sem
        * precisar de nenhuma versão "vidro falso": nenhum card monta
        * blur nativo nenhum agora, então não sobra custo de composição
        * nenhum por post na rolagem — a causa provável da travadinha
        * reportada. `forceNoBlur` em `Glass.tsx` continua existindo (não
        * removido), só não é mais usado aqui.
        */}
      <View style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.header}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/u/${post.authorUsername}`);
          }}
        >
          <Avatar uri={post.authorAvatarUrl} name={post.authorName} style={styles.avatar} textStyle={styles.avatarInitials} />
          <View style={styles.headerText}>
            {/*
              * CORREÇÃO (2026-09-29, reportado com print comparando com o
              * Threads real — "você colocou horário/dia embaixo do
              * nome, no Threads é do lado do nome") — antes o horário
              * era uma 2ª linha, embaixo de `nameRow`; agora entra DENTRO
              * de `nameRow`, na mesma linha do nome+selo, igual à
              * referência. O `@authorUsername` continua fora (já tirado
              * antes) — o toque no header inteiro leva pro perfil.
              */}
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.authorName}>
                {post.authorName}
              </Text>
              <VerifiedBadge tier={post.authorVerifiedTier} size={fontSize.sm} />
              <Text numberOfLines={1} variant="muted" style={styles.meta}>
                {formatRelativeTime(post.createdAt, now, locale, t("feed.justNow"))}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* CORREÇÃO (Fase 3, achado alto — acessibilidade de botões só-ícone) — `accessibilityLabel`/`accessibilityRole` faltavam aqui. */}
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("profile.moreOptions")}
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
              <Image source={{ uri: posterUrl }} style={styles.reviewPosterImage} contentFit="cover" />
            ) : (
              <Feather name="film" size={16} color={colors.muted} />
            )}
          </View>
          <View style={styles.reviewInfo}>
            <Text numberOfLines={2} style={styles.reviewTitle}>
              {post.mediaTitle}
            </Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <AnimatedStar
                  key={i}
                  index={i}
                  filled={i < (post.rating ?? 0)}
                  size={17}
                  color={colors.primary}
                  emptyColor={colors.border}
                />
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
              <Text variant="muted">{t("common.cancel")}</Text>
            </Pressable>
            <View style={styles.editSaveButton}>
              <Button onPress={handleSaveEdit} loading={saving} disabled={!editBody.trim()}>
                {t("common.save")}
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
      </View>

      {detail && <PostCommentsSection postId={post.id} />}

      {menuOpen && (
        <OptionSheet
          title={post.authorName}
          onDismiss={() => setMenuOpen(false)}
          actions={[
            { label: t("social.share"), onPress: handleShare },
            ...(isOwner
              ? [
                  { label: t("common.edit"), onPress: handleStartEdit },
                  { label: t("common.delete"), danger: true, onPress: handleDelete },
                ]
              : [{ label: reported ? t("feed.reported") : t("feed.report"), danger: true, onPress: handleReport }]),
          ]}
        />
      )}
      </View>
    </Pressable>
  );
}

/**
 * Comparador por VALOR (não por referência) — ver o comentário grande
 * acima, em `PostCardComponent`. `post`/`detail`/`onDeleted` continuam
 * comparados por referência (mudam só quando devem: `post` só troca
 * de verdade num refetch real; `onDeleted`/`refetch` precisa ser
 * estável na origem — ver `usePosts.ts` — senão nenhum `memo` aqui
 * adianta). `pollInfo` é serializado: é pequeno (algumas opções de
 * enquete) e comparar por valor certo aqui é mais barato que
 * re-renderizar o card inteiro à toa.
 */
function arePropsEqual(prev: Readonly<PostCardProps>, next: Readonly<PostCardProps>): boolean {
  if (prev.post !== next.post || prev.detail !== next.detail || prev.onDeleted !== next.onDeleted) {
    return false;
  }
  if ((prev.likeInfo?.count ?? null) !== (next.likeInfo?.count ?? null) || (prev.likeInfo?.hasLiked ?? null) !== (next.likeInfo?.hasLiked ?? null)) {
    return false;
  }
  if ((prev.commentCount ?? null) !== (next.commentCount ?? null)) {
    return false;
  }
  const prevPoll = prev.pollInfo ? JSON.stringify(prev.pollInfo) : null;
  const nextPoll = next.pollInfo ? JSON.stringify(next.pollInfo) : null;
  return prevPoll === nextPoll;
}

export const PostCard = memo(PostCardComponent, arePropsEqual);

const styles = StyleSheet.create({
  // A PEDIDO (2026-09-29, "feed igual Threads") — sem fundo/borda ao redor, só uma linha fina embaixo separando os posts.
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  authorName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  // CORREÇÃO (2026-09-29, "horário do lado do nome, igual Threads") —
  // agora mora dentro de `nameRow` (mesma linha do nome); `flexShrink: 0`
  // pra nunca ser espremido antes do nome truncar primeiro (`authorName`
  // já tem `flexShrink: 1` de propósito, pra ser o único a ceder espaço).
  meta: {
    flexShrink: 0,
    fontSize: fontSize.xxs,
  },
  // A PEDIDO (2026-09-29, "feed igual Threads") — sem caixa/fundo ao redor, só a linha (poster + info) dentro do corpo do post.
  //
  // CAPA MAIOR (2026-10-01, documento de UX — "o Feed precisa mostrar
  // capas maiores (...) praticamente funcionam como ícones") — 44×64
  // → 84×126 (dobro, mesma proporção 2:3 do pôster do TMDB; `posterUrl`
  // também subiu de "w185" pra "w342" pra não esticar uma imagem
  // pequena demais pro tamanho novo). Fica do mesmo porte do pôster do
  // Activity Card (ver `ActivityCard.tsx`) — consistência entre os dois
  // tipos de card que mostram pôster no Feed. NÃO virou o tratamento
  // "backdrop" de tela cheia do mockup do documento — isso exigiria
  // buscar e guardar uma imagem (backdrop) que a tabela `posts` nunca
  // armazenou, dado novo que a mudança pedida ("capas maiores") não
  // exige; mesma decisão consciente já tomada no `ActivityCard.tsx`.
  reviewCard: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  reviewPoster: {
    width: 84,
    height: 126,
    borderRadius: radius.md,
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
    gap: 6,
  },
  // ALINHADO COM `ActivityCard.tsx` (2026-10-01, a pedido — achado da
  // auditoria UI/UX: mesmo papel visual — pôster 84×126 + título ao
  // lado — tratado diferente nos dois lugares: aqui truncava em 1
  // linha com `fontSize.md`; lá (tier "medium") já usava 2 linhas com
  // `fontSize.smPlus`). Era `fontSize.md`/`numberOfLines={1}` (ver a
  // prop, acima).
  reviewTitle: {
    fontSize: fontSize.smPlus,
    fontWeight: "700",
    color: colors.text,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    marginLeft: spacing.xs,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
    fontSize: fontSize.xxs,
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
