import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { setSeriesStatus } from "@/lib/seriesDetails";
import { setMovieStatus } from "@/lib/movieDetails";
import { hapticTick } from "@/lib/haptics";
import { PressableScale } from "@/components/ui";
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
    hapticTick();
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
    <PressableScale style={styles.buttonWrap} onPress={handlePress} disabled={isPending} hitSlop={6}>
      {/*
        * CORREÇÃO (2026-09-16, achado no teste real em iPhone via
        * TestFlight — "esses cards não tem o (+)") — era `<Glass>`
        * (blur de verdade) aqui dentro do `<Glass>` do pôster
        * (`DiscoverCarousel.tsx`, `posterWrapper`). Confirmado ao vivo
        * no aparelho: um `Glass` sozinho renderiza certo no iOS
        * (pílulas do Perfil, botão "Ver detalhes" — ambos com
        * conteúdo visível), mas Glass ANINHADO dentro de outro Glass
        * não desenha nada — mesma família do bug de `BlurView`
        * aninhado que já tinha causado crash (SIGSEGV) no Android,
        * documentado em `components/ui/Glass.tsx`; no iOS, em vez de
        * travar, o conteúdo simplesmente não aparecia.
        *
        * Troca: `View` comum, sem blur, com a MESMA borda âmbar de 2px
        * e o mesmo fundo escuro semi-transparente (`rgba(11,14,20,
        * 0.55)`) que o `Glass` já usava como base — numa badge de
        * 26×26px o blur por trás praticamente não se notava mesmo,
        * então a perda visual é mínima e ganha-se confiabilidade nas
        * duas plataformas.
        */}
      <View style={styles.button}>
        <View pointerEvents="none">
          <Feather name={isAdded ? "check" : "plus"} size={16} color={colors.primary} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  button: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "rgba(11,14,20,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
