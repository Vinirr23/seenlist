import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchPostCommentCount } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

export function CommentCount({ postId, initial }: { postId: string; initial?: number }) {
  const [count, setCount] = useState<number | null>(initial ?? null);

  /**
   * CORREÇÃO (bug real — mesmo achado do `LikeButton`: "comentário
   * não atualiza em tempo real") — a condição antiga
   * (`count === null`) fazia o componente aceitar o valor de fora só
   * ENQUANTO ainda não tinha número nenhum. Depois da primeira vez,
   * toda atualização vinda do Realtime era descartada em silêncio.
   */
  useEffect(() => {
    if (initial === undefined) return;
    setCount((current) => (current === initial ? current : initial));
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
      {/* CORREÇÃO (auditoria de consistência, 2026-09-04) — os ícones da fileira de ações do post tinham tamanhos diferentes. Unificados em 18, mesma família (`MaterialCommunityIcons`), pra alinharem de verdade.
        * ATUALIZADO (auditoria de consistência, 2026-09-25 — "propagar padrão já aprovado") — o `LikeButton` (ao lado, na mesma fileira) subiu de 18 → 22px em 2026-09-25 ("Opção B" dos comentários); este ícone tinha ficado pra trás, desalinhando o par curtir/comentar no rodapé do post. */}
      <MaterialCommunityIcons name="comment-outline" size={22} color={colors.muted} />
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
  // ATUALIZADO (auditoria de consistência, 2026-09-25) — 12 → 15, acompanhando o `count` do `LikeButton` ao lado (mesma fileira, mesmo papel de texto).
  // FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do usuário) — token formalizado `fontSize.smPlus` (era literal 15, mesmo valor).
  count: {
    fontSize: fontSize.smPlus,
    color: colors.muted,
  },
});
