import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchIsSaved, toggleSavePost } from "@/lib/social/savedPosts";
import { colors } from "@/lib/theme";

export function SaveButton({ postId, initial }: { postId: string; initial?: boolean }) {
  const [isSaved, setIsSaved] = useState(initial ?? false);
  const [busy, setBusy] = useState(false);
  const [hasOwnValue, setHasOwnValue] = useState(initial !== undefined);

  useEffect(() => {
    if (initial !== undefined && !hasOwnValue) {
      setIsSaved(initial);
      setHasOwnValue(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (initial !== undefined) return; // já veio pronto — não busca de novo
    let cancelled = false;
    fetchIsSaved(postId).then((value) => {
      if (!cancelled) setIsSaved(value);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function handlePress() {
    if (busy) return;
    setBusy(true);
    const previous = isSaved;
    setIsSaved(!previous); // otimista
    try {
      await toggleSavePost(postId, previous);
    } catch (error) {
      console.error("[SaveButton] Falha ao salvar/remover", error);
      setIsSaved(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={handlePress} hitSlop={8} style={styles.button}>
      <Feather name="bookmark" size={16} color={isSaved ? colors.primary : colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: "auto",
  },
});
