import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchPostCommentCount } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export function CommentCount({ postId, initial }: { postId: string; initial?: number }) {
  const [count, setCount] = useState<number | null>(initial ?? null);

  useEffect(() => {
    if (initial !== undefined && count === null) setCount(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (initial !== undefined) return; // já veio pronto — não busca de novo
    let cancelled = false;
    fetchPostCommentCount(postId).then((c) => {
      if (!cancelled) setCount(c);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  return (
    <View style={styles.row}>
      {/* CORREÇÃO (auditoria de consistência) — os 3 ícones da fileira de ações do post (curtir/comentar/salvar) tinham 3 tamanhos diferentes (17/16/16 em famílias diferentes). Unificados em 18, mesma família (`MaterialCommunityIcons`), pra alinharem de verdade. */}
      <MaterialCommunityIcons name="comment-outline" size={18} color={colors.muted} />
      <Text style={styles.count}>{count ?? 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  count: {
    fontSize: 12,
    color: colors.muted,
  },
});
