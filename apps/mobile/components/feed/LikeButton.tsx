import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchHasLiked, fetchLikeCount, toggleLike, type LikeTargetType } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export function LikeButton({ targetType, targetId }: { targetType: LikeTargetType; targetId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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
