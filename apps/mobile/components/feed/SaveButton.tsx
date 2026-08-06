import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchIsSaved, toggleSavePost } from "@/lib/social/savedPosts";
import { hapticTick } from "@/lib/haptics";
import { colors } from "@/lib/theme";

export function SaveButton({ postId, initial }: { postId: string; initial?: boolean }) {
  const [isSaved, setIsSaved] = useState(initial ?? false);
  const [busy, setBusy] = useState(false);

  /**
   * CORREÇÃO (bug real — mesmo achado do `LikeButton`) — a condição
   * antiga (`!hasOwnValue`) travava o valor depois da primeira vez:
   * atualização de fora era descartada em silêncio dali em diante.
   */
  useEffect(() => {
    if (initial === undefined) return;
    setIsSaved((current) => (current === initial ? current : initial));
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
    hapticTick();
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
      {/*
        * CORREÇÃO (auditoria de consistência — mesmo achado do
        * coração e das estrelas) — `Feather` só tem ícone de
        * CONTORNO: salvar só mudava a cor da linha, nunca preenchia.
        * O web usa `fill="currentColor"` aqui (`PostCard.tsx`).
        * `MaterialCommunityIcons` (mesmo pacote, sem dependência
        * nova) tem "bookmark"/"bookmark-outline".
        */}
      <MaterialCommunityIcons
        name={isSaved ? "bookmark" : "bookmark-outline"}
        size={18}
        color={isSaved ? colors.primary : colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: "auto",
  },
});
