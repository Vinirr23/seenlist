import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import type { CommentNode } from "@/lib/social/mediaComments";
import { fetchLikeInfoFor } from "@/lib/social/likes";
import { EpisodeCommentItem } from "./EpisodeCommentItem";
import { Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { PageError } from "@/components/media/PageError";
import { spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** TASK-153 — achata a árvore inteira (comentário + respostas, em qualquer nível) numa lista simples de ids, pra buscar curtida de todo mundo de uma vez. */
function flattenCommentIds(nodes: CommentNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) ids.push(...flattenCommentIds(node.children));
  }
  return ids;
}

/**
 * TASK-122/129/132/133 (episódio) — árvore de respostas. Só LISTA — ver
 * `app/episodes/[seriesId]/[season]/[episode]/comments.tsx` pelo
 * composer e pelo `useEpisodeComments(target)` (chamado lá, uma única
 * vez, e passado aqui como props).
 *
 * CORREÇÃO (a pedido — mesma mudança já aplicada no web, "quero um
 * aviso antes de entrar") — a oclusão automática por progresso
 * (`useEpisodeSpoilerProtection`) saiu daqui. Antes, cada comentário
 * de quem ainda não tinha assistido o episódio aparecia escondido
 * individualmente dizendo "contém spoiler" (mesmo sem ser spoiler de
 * verdade). Agora o aviso é ÚNICO, ANTES de entrar nessa tela (o
 * botão "Comentário" na tela do episódio pergunta antes de navegar)
 * — aqui dentro, só o `containsSpoiler` MANUAL de cada comentário
 * (marcado por quem escreveu) continua escondendo.
 *
 * COMPOSER REMOVIDO DAQUI (2026-10-06, a pedido — "na tela de
 * comentários de um episódio tem o (+) e no topo uma quadrado pra
 * escrever comentário que é redundante já que o botão abre um sheet
 * com o mesmo propósito") — a caixa de escrever comentário que vivia
 * aqui (texto + imagem + "contém spoiler" + "Enviar") foi removida
 * por ser redundante com o sheet do "+" (`EpisodeCommentComposerButton`,
 * em `comments.tsx`). CAUSA RAIZ da redundância: o "+" genérico do
 * Feed (`CreatePostButton`) tinha sido adicionado nesta tela JUNTO
 * com este composer que já existia — dois jeitos de escrever a MESMA
 * coisa, e o "+" nem submetia como comentário de episódio de verdade
 * (publicava no Feed geral). Agora só existe um caminho: o "+", que
 * chama o `submit` de `useEpisodeComments` de verdade.
 */
export function EpisodeCommentsSection({
  tree,
  isLoading,
  isError,
  retry,
  remove,
  edit,
  commentsBaseHref,
}: {
  tree: CommentNode[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  remove: (commentId: string) => Promise<void>;
  edit: (commentId: string, body: string) => Promise<void>;
  commentsBaseHref: string;
}) {
  const { t } = useTranslation();

  /** TASK-153 — busca a curtida de TODOS os comentários (em qualquer nível da árvore) de uma vez, não um por um. */
  const [likeInfoByCommentId, setLikeInfoByCommentId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  useEffect(() => {
    const ids = flattenCommentIds(tree);
    if (ids.length === 0) return;
    fetchLikeInfoFor("comment", ids)
      .then(setLikeInfoByCommentId)
      .catch((error) => console.error("[EpisodeCommentsSection] Falha ao buscar curtidas em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flattenCommentIds(tree).join(",")]);

  return (
    <View style={styles.wrapper}>
      {isLoading ? (
        <AvatarRowSkeleton count={3} />
      ) : isError ? (
        // CORREÇÃO (Fase 3, achado alto — falha de rede não pode parecer
        // "nenhum comentário ainda") — mesmo padrão `PageError`+retry do
        // resto do app; reaproveita `error.loadCommentsFailed`, já usada
        // em `app/profile/comments.tsx` pro mesmo tipo de falha.
        <PageError message={t("error.loadCommentsFailed")} onRetry={retry} />
      ) : tree.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          {t("social.noCommentsYetFull")}
        </Text>
      ) : (
        <View>
          {/*
            * CORREÇÃO (mockup 2026-09-25, "deixe os comentários do mesmo
            * jeito da referência") — `flatten` faz o `EpisodeCommentItem`
            * mostrar só o comentário-raiz (sem as respostas abertas
            * dentro da própria lista), com contador de respostas +
            * bandeira (só visual, ver comentário no próprio componente).
            * As respostas continuam existindo — só passam a aparecer na
            * tela de conversa do comentário (`comment/[commentId].tsx`),
            * não aqui.
            */}
          {tree.map((node) => (
            <EpisodeCommentItem
              key={node.id}
              comment={node}
              depth={0}
              commentsBaseHref={commentsBaseHref}
              onDelete={remove}
              onEdit={edit}
              likeInfoByCommentId={likeInfoByCommentId}
              flatten
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  centerText: {
    paddingVertical: spacing.sm,
  },
});
