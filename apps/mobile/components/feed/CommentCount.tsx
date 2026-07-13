import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchPostCommentCount } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export function CommentCount({ postId }: { postId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPostCommentCount(postId).then((c) => {
      if (!cancelled) setCount(c);
    });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  return (
    <View style={styles.row}>
      <Feather name="message-circle" size={16} color={colors.muted} />
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
