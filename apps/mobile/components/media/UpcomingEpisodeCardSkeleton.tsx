import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * CORREÇÃO (bug real, reportado — "'em breve' não está igual a web",
 * 2026-09-04) — este esqueleto era uma lista simples de 3 linhas, sem
 * nenhuma trilha (ponto + linha) nem agrupamento por selo de data —
 * o formato real da tela (ver `series/index.tsx`) tem os dois. Mesma
 * causa raiz que o WEB já teve e corrigiu antes ("o esqueleto está
 * errado... nunca foi atualizado pra acompanhar aquele redesign",
 * `EmBreveSection.tsx`/`EmBreveSkeleton`) — o mobile nunca tinha
 * recebido a correção equivalente. Porta fiel de `EmBreveSkeleton` do
 * web: 2 grupos fantasmas (selo + trilha + linhas — 2 cards no 1º
 * grupo, 1 no 2º), pôster/padding/raio no MESMO tamanho do card real
 * corrigido (`UpcomingEpisodeCard.tsx`: 70×80, `padding: 10`,
 * `radius.lg`).
 */
export function UpcomingEpisodeCardSkeleton() {
  return (
    <View style={styles.groupList}>
      {[0, 1].map((groupIndex) => {
        const rowCount = groupIndex === 0 ? 2 : 1;
        return (
          <View key={groupIndex}>
            <View style={styles.pillWrapper}>
              <Skeleton width={96} height={24} borderRadius={radius.full} />
            </View>
            <View>
              {Array.from({ length: rowCount }, (_, index) => {
                const hasNext = index < rowCount - 1;
                return (
                  <View key={index} style={styles.timelineRow}>
                    <View style={styles.track}>
                      <View style={styles.trackDot} />
                      {hasNext && <View style={styles.trackLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.card}>
                        <Skeleton width={70} height={80} borderRadius={4} />
                        <View style={styles.info}>
                          <Skeleton width="75%" height={14} />
                          <Skeleton width="50%" height={12} style={styles.line} />
                          <Skeleton width="35%" height={11} style={styles.line} />
                        </View>
                      </View>
                      {hasNext && <View style={styles.spacer} />}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groupList: {
    gap: spacing.lg,
  },
  pillWrapper: {
    alignItems: "center",
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  track: {
    width: 12,
    alignItems: "center",
  },
  trackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  trackLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
  },
  spacer: {
    height: 10,
  },
  card: {
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 10,
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  line: {
    marginTop: 0,
  },
});
