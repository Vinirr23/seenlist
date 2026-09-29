import { useState } from "react";
import { View, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CommentNode } from "@/lib/social/mediaComments";
import { SpoilerGate } from "@/components/reviews/SpoilerGate";
import { LikeButton } from "@/components/feed/LikeButton";
import { Text, Button, Glass } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { AdaptiveImage } from "@/components/media/AdaptiveImage";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** Conta todas as respostas de um comentário, em qualquer nível (não só as diretas) — é o número que aparece ao lado do balão. */
function countDescendants(node: CommentNode): number {
  let total = node.children.length;
  for (const child of node.children) total += countDescendants(child);
  return total;
}

/**
 * TASK-122/123/129/132/133 — porta de `CommentItem.tsx`, com
 * divergências do web PEDIDAS EXPLICITAMENTE: "Responder" navega
 * (TASK-132); avatar de verdade, curtir com contagem e anexar
 * imagem/GIF (TASK-133) — o web não tem nenhuma das três aqui (só
 * nome em texto, sem curtir, sem imagem no comentário de mídia,
 * mesmo a coluna `image_url` existindo — nunca foi usada no
 * CommentItem do web, só no comentário de Feed).
 *
 * CORREÇÃO (a pedido, mockup aprovado 2026-09-25 — "deixe os
 * comentários do mesmo jeito da referência") — duas mudanças:
 *
 * 1) Data agora fica EMBAIXO do nome (empilhada), não mais alinhada
 *    à direita na mesma linha do nome — igual à referência.
 *
 * 2) Novo prop `flatten`: usado SÓ na tela de lista principal
 *    (`EpisodeCommentsSection`, comentários-raiz). Quando `true`:
 *    - não renderiza as respostas aninhadas dentro do próprio card
 *      (a lista vira "achatada" — só o comentário-raiz por linha,
 *      igual à referência; as respostas só aparecem ao entrar na
 *      tela de conversa de um comentário específico);
 *    - troca o link de texto "Responder" por um contador de
 *      respostas (ícone de balão + número, tocável, mesmo destino de
 *      navegação que "Responder" já usava);
 *    - adiciona o ícone de bandeira no canto superior direito do
 *      card.
 *    Sem `flatten` (padrão, tela de conversa de um comentário), o
 *    comportamento continua exatamente como já era.
 *
 * A bandeira é SÓ VISUAL por enquanto (decisão explícita sua,
 * 2026-09-25) — não grava nada ao tocar. Hoje só existe denúncia de
 * verdade pra post do Feed (`post_reports` + painel
 * `/admin/moderation`); estender isso pra comentário de episódio
 * (tabela `comment_reports` + RLS + o painel mostrando as duas
 * listas) fica como tarefa separada, se/quando você pedir.
 */
export function EpisodeCommentItem({
  comment,
  depth,
  commentsBaseHref,
  onDelete,
  onEdit,
  likeInfoByCommentId,
  flatten = false,
}: {
  comment: CommentNode;
  depth: number;
  commentsBaseHref: string;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  /** TASK-153 — curtidas de todos os comentários já buscadas em lote por quem chama, evita 1 busca por comentário. */
  likeInfoByCommentId?: Map<string, { count: number; hasLiked: boolean }>;
  /** Ver comentário na função acima — usado só pela tela de lista principal. */
  flatten?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const isOwn = session?.user.id === comment.author.userId;
  const displayName = comment.author.displayName ?? comment.author.username;
  const replyCount = flatten ? countDescendants(comment) : 0;

  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body ?? "");
  const [saving, setSaving] = useState(false);
  // FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
  // 2026-09-26) — mesma correção do `PostCommentItem.tsx`: apagar já
  // tinha confirmação + erro, mas nada indicava exclusão em andamento
  // (diferente de editar, que já usa `Button loading={saving}` acima).
  const [deleting, setDeleting] = useState(false);

  async function handleSaveEdit() {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editBody.trim());
      setEditing(false);
    } catch (error) {
      console.error("[EpisodeCommentItem] Falha ao editar comentário", error);
      Alert.alert(t("social.errorEditComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(t("social.confirmDeleteCommentTitle"), t("social.confirmDeleteCommentMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete(comment.id);
          } catch (error) {
            console.error("[EpisodeCommentItem] Falha ao apagar comentário", error);
            Alert.alert(t("social.errorDeleteComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  // PORTE DO WEB (2026-09-04, "vidro que falta") — só o comentário-raiz
  // (depth 0) vira card `<Glass>`; respostas (depth > 0) continuam sem
  // card próprio, só indentação (mesmo critério do `CommentItem.tsx`
  // do web).
  const Container = depth === 0 ? Glass : View;

  return (
    <Container style={depth === 0 ? styles.card : styles.nested}>
      {editing ? (
        <View>
          <TextInput value={editBody} onChangeText={setEditBody} multiline autoFocus style={styles.editInput} />
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
        <View style={styles.row}>
          <View style={styles.headerRow}>
            <Pressable style={styles.authorTouch} onPress={() => router.push(`/u/${comment.author.username}`)}>
              <Avatar uri={comment.author.avatarUrl} name={displayName} style={styles.avatar} textStyle={styles.avatarInitials} />
              <View style={styles.metaCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.authorName}>{displayName}</Text>
                  <VerifiedBadge tier={comment.author.verifiedTier} size={fontSize.md} />
                </View>
                <Text variant="muted" style={styles.date}>
                  {dateFormatter.format(new Date(comment.createdAt))}
                </Text>
              </View>
            </Pressable>
            {/*
              * CORREÇÃO DE RAIZ (a pedido — "use a referência, você
              * está ignorando a referência") — a bandeira ERA
              * `position: "absolute"` com margem fixa no olho, um
              * selo solto por cima do card (por isso ficava pequena e
              * colada na borda). Na referência ela é só mais um item
              * DENTRO da mesma linha do avatar/nome, jogado pro final
              * por `justify-content: "space-between"` — sem nenhum px
              * chutado, o próprio flexbox resolve o alinhamento certo
              * em qualquer tela.
              *
              * CORREÇÃO (a pedido — "centralize a flag em relação ao
              * bloco completo de identidade, não só o nome") —
              * `headerRow` passou de `alignItems: "flex-start"` pra
              * `"center"`: agora a bandeira centraliza verticalmente
              * contra a altura do bloco inteiro (avatar + nome +
              * data), não contra a primeira linha do nome. Sem
              * `paddingTop` chutado.
              */}
            {flatten && (
              <View style={styles.flagTouch}>
                <Feather name="flag" size={24} color={colors.muted} />
              </View>
            )}
          </View>

          <SpoilerGate hidden={comment.containsSpoiler}>
            <View>
              {!!comment.body && <Text style={styles.body}>{comment.body}</Text>}
              {!!comment.imageUrl && <AdaptiveImage uri={comment.imageUrl} maxHeight={320} />}
            </View>
          </SpoilerGate>

          {/* A PEDIDO (mockup 2026-09-25, "bem melhor, pode aplicar") — linha fina separando o texto das ações, igual à referência. */}
          <View style={styles.actionsDivider} />

          {/*
            * CORREÇÃO (a pedido — "coração+contador, comentário+
            * contador, Editar e Apagar devem compartilhar exatamente
            * o mesmo centro vertical") — um único container
            * (`actionsRow`, já `alignItems: "center"`) com os itens
            * soltos direto dentro dele (sem wrapper extra por item
            * além do próprio botão). `LikeButton` é um componente
            * compartilhado (usado no Feed também) — não mexi nele por
            * dentro; em vez disso, o ícone de resposta usa exatamente
            * o mesmo tamanho (18px) e o mesmo `gap` (`spacing.xs`,
            * igual ao `LikeButton`) entre ícone e número, e ambos os
            * ícones ficam dentro de uma caixa fixa 18×18
            * (`actionIconBox`) — o alinhamento passa a depender da
            * caixa, não do desenho interno de cada glifo.
            */}
          <View style={styles.actionsRow}>
            <LikeButton targetType="comment" targetId={comment.id} initial={likeInfoByCommentId?.get(comment.id)} />
            {flatten ? (
              <Pressable style={styles.replyCountButton} onPress={() => router.push(`${commentsBaseHref}/comment/${comment.id}`)}>
                <View style={styles.actionIconBox}>
                  <Feather name="message-circle" size={22} color={colors.muted} />
                </View>
                <Text variant="muted" style={styles.actionLabel}>
                  {replyCount}
                </Text>
              </Pressable>
            ) : (
              depth < 2 && (
                <Pressable onPress={() => router.push(`${commentsBaseHref}/comment/${comment.id}`)}>
                  <Text variant="muted" style={styles.actionLabel}>
                    {t("social.reply")}
                  </Text>
                </Pressable>
              )
            )}
            {isOwn && (
              <>
                <Pressable onPress={() => setEditing(true)} disabled={deleting}>
                  <Text variant="muted" style={styles.actionLabel}>
                    {t("common.edit")}
                  </Text>
                </Pressable>
                <Pressable onPress={handleDelete} disabled={deleting}>
                  <Text style={styles.deleteLabel}>{deleting ? t("common.deleting") : t("social.delete")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {!flatten && comment.children.length > 0 && (
        <View style={styles.childrenWrapper}>
          {comment.children.map((child) => (
            <EpisodeCommentItem
              key={child.id}
              comment={child}
              depth={depth + 1}
              commentsBaseHref={commentsBaseHref}
              onDelete={onDelete}
              onEdit={onEdit}
              likeInfoByCommentId={likeInfoByCommentId}
            />
          ))}
        </View>
      )}
    </Container>
  );
}

// A PEDIDO (mockup "Opção B", 2026-09-25 — "achando a fonte nos
// comentários muito pequenas e os botões também", comparado à
// referência) — 28 → 36. Acompanha o aumento de fonte/ícones abaixo.
const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  // Raio de `radius.md` (10) → `radius.lg` (16): web usa `rounded-2xl`
  // no comentário-raiz (`CommentItem.tsx`). `Glass` não define raio
  // nenhum sozinho, então ele PRECISA ficar aqui.
  card: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  nested: {
    marginTop: spacing.sm,
  },
  childrenWrapper: {
    marginTop: spacing.sm,
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    gap: spacing.sm,
  },
  row: {
    gap: 2,
  },
  // CORREÇÃO (a pedido — "use a referência") — linha do cabeçalho
  // agora é `justify-content: "space-between"`: avatar+nome de um
  // lado, bandeira do outro (quando `flatten`) — sem posicionamento
  // absoluto, sem px chutado.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorTouch: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    flexShrink: 1,
  },
  metaCol: {
    flexDirection: "column",
    gap: 1,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — micro(10) → 12,
  // acompanhando o avatar maior (28 → 36).
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — xs(12) → 16.
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.md` (era literal 16, mesmo valor).
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorName: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — xxs(11) → 13.
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
  date: {
    fontSize: fontSize.xsPlus,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — xs(12) → 16.
  body: {
    marginTop: 2,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.md` (era literal 16, mesmo valor).
    fontSize: fontSize.md,
    color: colors.text,
  },
  // A PEDIDO (mockup 2026-09-25) — linha fina entre o corpo do
  // comentário e a linha de ações, igual à referência.
  actionsDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  // A PEDIDO (mockup 2026-09-25, "alinha os botões dentro do espaço
  // que eles estão") — `flexWrap` evita que Editar/Apagar estourem o
  // card num comentário seu; gap menor (`spacing.lg` → `spacing.md`)
  // dá mais folga antes de precisar quebrar linha.
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: spacing.xs,
    columnGap: spacing.md,
    marginTop: spacing.sm,
  },
  // A PEDIDO (mockup 2026-09-25, "os botões de like | comentários
  // estão muito pequenos") — 11px → 13px. ATUALIZADO (mockup "Opção
  // B", mesmo dia) — 13px → 15px, pra bater com o número do
  // `LikeButton` (também 15px/ícone 22px agora).
  // FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do usuário) — token formalizado `fontSize.smPlus` (era literal 15, mesmo valor).
  actionLabel: {
    fontSize: fontSize.smPlus,
    fontWeight: "600",
  },
  // Mesmo `gap` do `LikeButton` (`spacing.xs`, entre ícone e número) —
  // grupos consistentes, pedido explícito.
  replyCountButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 13px → 15px, acompanha `actionLabel`.
  // FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do usuário) — token formalizado `fontSize.smPlus` (era literal 15, mesmo valor).
  deleteLabel: {
    fontSize: fontSize.smPlus,
    fontWeight: "600",
    color: colors.danger,
  },
  // Caixa fixa pro ícone de resposta — mesmo box/touch target do
  // ícone de curtir (`LikeButton`), pra alinhamento não depender do
  // desenho interno de cada glifo (pedido explícito). 18×18 → 22×22
  // (mockup "Opção B", 2026-09-25), acompanhando o `LikeButton`.
  actionIconBox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // Caixa fixa pra bandeira, mesma lógica do `actionIconBox` acima —
  // o `headerRow` (`alignItems: "center"`) faz o resto do trabalho de
  // centralização vertical contra o bloco avatar+nome+data.
  //
  // AJUSTE FINO (a pedido, 2026-09-25 — "a barra inferior está
  // correta, não altere mais nada; desça a flag ~3-4px pro centro
  // óptico dela alinhar com avatar+nome+data") — `alignItems:
  // "center"` no `headerRow` centraliza os BOUNDS matemáticos da caixa
  // 20×20 contra a altura do bloco de identidade, mas o glifo da
  // bandeira (ícone Feather "flag") não ocupa o quadrado inteiro —
  // sobra mais espaço vazio acima do desenho do que abaixo, então o
  // olho vê ela "alta". `marginTop` pequeno compensa só esse desenho
  // interno do ícone, sem mexer no `justify-content`/`align-items` do
  // container (que resolvem o alinhamento estrutural certo).
  //
  // ATUALIZADO (mockup "Opção B", 2026-09-25) — caixa 20×20 → 24×24 e
  // ícone 20px → 24px (mesma proporção); `marginTop` do ajuste fino
  // acima escalado de 3 → 4 na mesma proporção do aumento.
  flagTouch: {
    width: 24,
    height: 24,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  editInput: {
    minHeight: 60,
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
    marginTop: spacing.xs,
  },
  editCancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  editSaveButton: {
    minWidth: 90,
  },
});
