import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { usePostComments } from "@/lib/usePost";
import type { CommentNode } from "@/lib/postComments";
import { fetchLikeInfoFor } from "@/lib/social/likes";
import { PostCommentItem } from "./PostCommentItem";
import { Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { hapticImpact } from "@/lib/haptics";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/** TASK-153 — achata a árvore inteira numa lista simples de ids, pra buscar curtida de todo mundo de uma vez. */
function flattenCommentIds(nodes: CommentNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) ids.push(...flattenCommentIds(node.children));
  }
  return ids;
}

/**
 * TASK-102/131 — porta de `PostCommentsSection.tsx`. Correção
 * (TASK-131): não muda mais o alvo do composer pra responder — só
 * comenta na raiz mesmo; responder a um comentário específico agora
 * abre a tela própria (ver `PostCommentItem.tsx`).
 *
 * FASE 1 (paridade com comentário de Episódio, 2026-09-26) — composer
 * movido pro TOPO (antes ficava embaixo da lista) e virou card `Glass`
 * (mesmo critério do `EpisodeCommentsSection.tsx`, "vidro que falta",
 * 2026-09-04). Estado vazio agora usa a mesma chave de i18n do
 * Episódio (`social.noCommentsYetFull`) — são o mesmo estado
 * equivalente, só a chave antiga (`social.noCommentsYet`, mais curta)
 * não tinha sido trocada quando essa segunda foi criada. NÃO trouxe
 * spoiler/anexar imagem pro composer — recursos do comentário de
 * mídia, não pedidos aqui.
 */
export function PostCommentsSection({ postId }: { postId: string }) {
  const { tree, isLoading, sending, submit, remove, edit } = usePostComments(postId);
  const [body, setBody] = useState("");
  const { t } = useTranslation();

  /** TASK-153 — busca a curtida de TODOS os comentários (em qualquer nível) de uma vez, não um por um. */
  const [likeInfoByCommentId, setLikeInfoByCommentId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  useEffect(() => {
    const ids = flattenCommentIds(tree);
    if (ids.length === 0) return;
    fetchLikeInfoFor("post_comment", ids)
      .then(setLikeInfoByCommentId)
      .catch((error) => console.error("[PostCommentsSection] Falha ao buscar curtidas em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flattenCommentIds(tree).join(",")]);

  async function handleSubmit() {
    if (!body.trim()) return;
    const ok = await submit(body, null);
    if (ok) {
      // A PEDIDO (feedback háptico) — mesma regra do comentário de
      // episódio: toque médio, e só no SUCESSO (antes vibrava ao
      // tocar no botão, mesmo se o envio falhasse depois).
      hapticImpact();
      setBody("");
    }
  }

  return (
    <View style={styles.wrapper}>
      {/*
        * A PEDIDO (2026-09-29, "comentar dentro de um post, tira o vidro
        * e etc... deixa como o resto de feed está") — era `<Glass>`
        * (mesma receita do composer de Episódio); virou `View` simples,
        * sem fundo/borda arredondada, igual ao resto do Feed já
        * redesenhado (`PostCard.tsx`, "feed igual Threads").
        */}
      <View style={styles.composerArea}>
        <View style={styles.inputRow}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t("social.commentPlaceholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={!body.trim() || sending}>
            <Text style={styles.sendButtonText}>{t("common.submit")}</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <AvatarRowSkeleton count={3} />
      ) : tree.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          {t("social.noCommentsYetFull")}
        </Text>
      ) : (
        <View>
          {tree.map((node) => (
            <PostCommentItem key={node.id} comment={node} postId={postId} depth={0} onDelete={remove} onEdit={edit} likeInfoByCommentId={likeInfoByCommentId} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  centerText: {
    paddingVertical: spacing.sm,
  },
  // A PEDIDO (2026-09-29, "tira o vidro, deixa como o resto do feed") —
  // sem fundo/borda arredondada (era `Glass`); só o respiro em volta do
  // campo continua (o próprio `input` já tem sua borda sólida).
  composerArea: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
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
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.background,
  },
});
