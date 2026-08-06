import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchHasLiked, fetchLikeCount, toggleLike, type LikeTargetType } from "@/lib/social/likes";
import { hapticTick } from "@/lib/haptics";
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

  /**
   * CORREÇÃO (bug real, achado por diagnóstico na tela — "curtida
   * não atualiza em tempo real") — o Realtime SEMPRE funcionou: o
   * canal conectava (`SUBSCRIBED`) e os eventos chegavam (contador
   * de eventos subindo). O problema era aqui: a condição antiga era
   * `if (initial && count === null)`, ou seja, o componente só
   * aceitava o valor de fora ENQUANTO ainda não tinha número
   * nenhum. Depois da primeira vez, toda atualização vinda do
   * Realtime era silenciosamente descartada — o pai re-renderizava
   * com o dado novo e este componente continuava mostrando o
   * antigo.
   *
   * Agora sincroniza sempre que o valor de fora muda de verdade. A
   * comparação campo a campo evita voltar atrás na atualização
   * otimista: ao curtir, o número muda na hora localmente, e o `initial`
   * ainda vem com o valor velho por um instante até a busca em lote
   * terminar — sem essa checagem, o número "piscaria" de volta.
   */
  useEffect(() => {
    if (!initial) return;
    setCount((current) => (current === initial.count ? current : initial.count));
    setHasLiked((current) => (current === initial.hasLiked ? current : initial.hasLiked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.count, initial?.hasLiked]);

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
    hapticTick();
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
      {/*
        * CORREÇÃO (bug real, reportado — "like não fica preenchido
        * com cor, diferente do web") — `Feather` é uma família de
        * ícone SÓ de contorno: não tem versão preenchida, então
        * curtir só mudava a COR da linha, nunca preenchia o coração.
        * O web usa `lucide-react` com `fill="currentColor"`, que
        * preenche de verdade. `MaterialCommunityIcons` já vem no
        * mesmo pacote `@expo/vector-icons` que o app já usa (nenhuma
        * dependência nova) e tem os dois: "heart" (preenchido) e
        * "heart-outline" (contorno) — agora bate com o web.
        */}
      <MaterialCommunityIcons
        name={hasLiked ? "heart" : "heart-outline"}
        size={18}
        color={hasLiked ? colors.primary : colors.muted}
      />
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
