import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MediaTarget } from "@/lib/social/mediaComments";
import { useEpisodeComments, useEpisodeSpoilerProtection } from "@/lib/social/useEpisodeComments";
import { EpisodeCommentItem } from "./EpisodeCommentItem";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-122/129/132 (episódio, correção) — árvore de respostas de
 * verdade + proteção automática contra spoiler + composer no topo.
 * Correção (TASK-132, a pedido — diverge do web de propósito): não
 * troca mais o alvo do composer pra responder — só comenta na raiz
 * mesmo; responder a um comentário específico agora abre uma tela
 * própria (ver `commentsBaseHref` + `EpisodeCommentItem.tsx`), igual
 * ao Feed.
 */
export function EpisodeCommentsSection({ seriesId, target }: { seriesId: number; target: MediaTarget }) {
  const { tree, isLoading, sending, submit, remove, edit } = useEpisodeComments(target);
  const autoHideSpoilers = useEpisodeSpoilerProtection(seriesId, target.seasonNumber ?? 0, target.episodeNumber ?? 0);
  const commentsBaseHref = `/episodes/${target.mediaId}/${target.seasonNumber}/${target.episodeNumber}`;

  const [body, setBody] = useState("");
  const [markSpoiler, setMarkSpoiler] = useState(false);

  async function handleSubmit() {
    if (!body.trim()) return;
    const ok = await submit(body, markSpoiler, null);
    if (ok) {
      setBody("");
      setMarkSpoiler(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.composerArea}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Escreva um comentário..."
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

      {isLoading ? (
        <Text variant="muted" style={styles.centerText}>
          Carregando comentários...
        </Text>
      ) : tree.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          Nenhum comentário ainda. Seja o primeiro a comentar.
        </Text>
      ) : (
        <View>
          {tree.map((node) => (
            <EpisodeCommentItem
              key={node.id}
              comment={node}
              depth={0}
              autoHideSpoilers={autoHideSpoilers}
              commentsBaseHref={commentsBaseHref}
              onDelete={remove}
              onEdit={edit}
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
  composerArea: {
    marginBottom: spacing.md,
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
