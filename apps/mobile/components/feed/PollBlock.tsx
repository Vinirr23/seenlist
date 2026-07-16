import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fetchPollData, votePoll, type PollData } from "@/lib/social/polls";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-163 — bloco de enquete dentro do PostCard. Antes de votar,
 * mostra só as opções (sem números — decisão confirmada: resultado só
 * aparece pra quem já votou). Depois de votar (nesta sessão ou em
 * qualquer sessão anterior — `votedOptionId` vem do banco, não de
 * estado local), mostra barra de progresso com % em cada opção e
 * marca a escolhida. Voto é definitivo: uma vez votado, não existe
 * mais caminho de volta pra tela de opções nesta UI.
 */
export function PollBlock({ postId, initial }: { postId: string; initial?: PollData }) {
  const [data, setData] = useState<PollData | null>(initial ?? null);
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setData(initial);
      return;
    }
    let cancelled = false;
    fetchPollData(postId).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, initial]);

  async function handleVote(optionId: string) {
    if (voting || data?.votedOptionId) return;
    setVoting(optionId);
    // Otimista: já mostra o resultado antes da resposta do servidor, mesmo padrão de LikeButton.
    setData((prev) =>
      prev
        ? {
            ...prev,
            votedOptionId: optionId,
            totalVotes: prev.totalVotes + 1,
            options: prev.options.map((o) => (o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o)),
          }
        : prev
    );
    try {
      await votePoll(postId, optionId);
    } catch (error) {
      console.error("[PollBlock] Falha ao votar", error);
      // Desfaz o otimismo — busca o estado real de novo (voto pode ter falhado por vários motivos, não só duplicidade).
      const fresh = await fetchPollData(postId);
      setData(fresh);
    } finally {
      setVoting(null);
    }
  }

  if (!data || data.options.length === 0) return null;

  const hasVoted = !!data.votedOptionId;

  return (
    <View style={styles.container}>
      {data.options.map((option) => {
        const percent = hasVoted && data.totalVotes > 0 ? Math.round((option.voteCount / data.totalVotes) * 100) : 0;
        const isChosen = option.id === data.votedOptionId;

        if (!hasVoted) {
          return (
            <Pressable
              key={option.id}
              style={styles.optionButton}
              onPress={() => handleVote(option.id)}
              disabled={voting !== null}
            >
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          );
        }

        return (
          <View key={option.id} style={styles.resultRow}>
            <View style={[styles.resultBar, { width: `${percent}%` }, isChosen && styles.resultBarChosen]} />
            <View style={styles.resultContent}>
              <View style={styles.resultLabel}>
                {isChosen && <Feather name="check-circle" size={13} color={colors.primary} />}
                <Text style={[styles.optionText, isChosen && styles.optionTextChosen]}>{option.text}</Text>
              </View>
              <Text variant="muted" style={styles.percentText}>
                {percent}%
              </Text>
            </View>
          </View>
        );
      })}

      {hasVoted && (
        <Text variant="muted" style={styles.totalText}>
          {data.totalVotes} {data.totalVotes === 1 ? "voto" : "votos"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  optionTextChosen: {
    fontWeight: "700",
    color: colors.primary,
  },
  resultRow: {
    position: "relative",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  resultBar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.border,
  },
  resultBarChosen: {
    backgroundColor: "rgba(232, 163, 61, 0.25)",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  resultLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  percentText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  totalText: {
    fontSize: 11,
    marginTop: 2,
  },
});
