import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchSeriesStatus, setSeriesStatus } from "@/lib/seriesDetails";
import { fetchMovieStatus, setMovieStatus } from "@/lib/movieDetails";
import { colors, radius } from "@/lib/theme";

/**
 * TASK-142 (Explorar, a pedido) — porta de `AddToLibraryButton.tsx`.
 * "Adicionar" aqui é só marcar como "Assistir depois" — a mesma ação
 * que qualquer outro "+" do app já faz. Não tinha sido portado na
 * leva original do Explorar (só o carrossel e a navegação foram).
 */
export function AddToLibraryButton({ mediaType, mediaId }: { mediaType: "movie" | "series"; mediaId: number }) {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetcher = mediaType === "series" ? fetchSeriesStatus(mediaId) : fetchMovieStatus(mediaId);
    fetcher.then((value) => {
      if (!cancelled) {
        setStatus(value);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaId]);

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

  if (isLoading) return null;

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
