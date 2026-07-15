import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { setSeriesStatus } from "@/lib/seriesDetails";
import { setMovieStatus } from "@/lib/movieDetails";
import { colors, radius } from "@/lib/theme";

/**
 * TASK-142/152 (Explorar, a pedido) — porta de `AddToLibraryButton.tsx`.
 * "Adicionar" aqui é só marcar como "Assistir depois" — a mesma ação
 * que qualquer outro "+" do app já faz.
 *
 * Correção (TASK-152 — atraso, aparecia depois do pôster): não busca
 * mais o próprio status sozinho — recebe `initialStatus` já pronto de
 * quem chama (`DiscoverCarousel.tsx`, buscando todos de uma vez só).
 * Renderiza na mesma hora que o pôster, sem esperar rede nenhuma.
 */
export function AddToLibraryButton({
  mediaType,
  mediaId,
  initialStatus,
}: {
  mediaType: "movie" | "series";
  mediaId: number;
  initialStatus: string | null;
}) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const isAdded = status != null;

  async function handlePress() {
    if (isAdded || isPending) return; // já está na biblioteca — "+" não remove, só adiciona (mesmo padrão do TV Time)
    setIsPending(true);
    try {
      if (mediaType === "series") {
        await setSeriesStatus(mediaId, "want_to_watch", null);
      } else {
        await setMovieStatus(mediaId, "want_to_watch", null);
      }
      setStatus("want_to_watch");
    } catch (error) {
      console.error("[AddToLibraryButton] Falha ao adicionar à biblioteca", error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Pressable style={styles.button} onPress={handlePress} disabled={isPending} hitSlop={6}>
      <View pointerEvents="none">
        <Feather name={isAdded ? "check" : "plus"} size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "rgba(11,14,20,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
});
