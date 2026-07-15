import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchHasLiked, fetchLikeCount, toggleLike, type LikeTargetType } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export function LikeButton({
  targetType,
  targetId,
  initial,
}: {
  targetType: LikeTargetType;
  targetId: string;
  /** TASK-153 — quando quem chama já buscou isso em lote (ex.: Feed), passa pronto aqui e o componente não busca sozinho. */
  initial?: { count: number; hasLiked: boolean };
}) {
  const [count, setCount] = useState<number | null>(initial?.count ?? null);
  const [hasLiked, setHasLiked] = useState(initial?.hasLiked ?? false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial && count === null) {
      setCount(initial.count);
      setHasLiked(initial.hasLiked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (initial) return; // já veio pronto — não busca de novo
    let cancelled = false;
    Promise.all([fetchLikeCount(targetType, targetId), fetchHasLiked(targetType, targetId)]).then(([c, liked]) => {
      if (!cancelled) {
        setCount(c);
        setHasLiked(liked);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  async function handlePress() {
    if (busy || count === null) return;
    setBusy(true);
    const wasLiked = hasLiked;
    // Otimista: atualiza a tela antes da resposta do servidor, desfaz se der erro.
    setHasLiked(!wasLiked);
    setCount(wasLiked ? count - 1 : count + 1);
    try {
      await toggleLike(targetType, targetId, wasLiked);
    } catch (error) {
      console.error("[LikeButton] Falha ao curtir/descurtir", error);
      setHasLiked(wasLiked);
      setCount(count);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={styles.button} onPress={handlePress} hitSlop={8}>
      <Feather name="heart" size={16} color={hasLiked ? colors.primary : colors.muted} />
      <Text style={[styles.count, hasLiked && styles.countActive]}>{count ?? 0}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  count: {
    fontSize: 12,
    color: colors.muted,
  },
  countActive: {
    color: colors.primary,
  },
});
