import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchIsSaved, toggleSavePost } from "@/lib/social/savedPosts";
import { colors } from "@/lib/theme";

export function SaveButton({ postId }: { postId: string }) {
  const [isSaved, setIsSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIsSaved(postId).then((value) => {
      if (!cancelled) setIsSaved(value);
    });
    return () => {
      cancelled = true;
    };
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
