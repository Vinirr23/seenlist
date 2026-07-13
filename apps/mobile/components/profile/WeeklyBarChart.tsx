import { View, StyleSheet } from "react-native";
import type { WeekBucket } from "@/lib/episodesTimeline";
import { colors, radius } from "@/lib/theme";

const CHART_HEIGHT = 80;

/** TASK-117 — porta de WeeklyBarChart.tsx: barras com altura proporcional, sem biblioteca de gráfico nova. Semana sem episódio = barra de altura mínima (cor neutra), não é omitida. */
export function WeeklyBarChart({ weeks }: { weeks: WeekBucket[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <View style={styles.row}>
      {weeks.map((week) => {
        const heightPercent = Math.max(4, (week.count / max) * 100);
        return (
          <View key={week.weekStart} style={styles.column}>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { height: `${heightPercent}%`, backgroundColor: week.count > 0 ? colors.primary : colors.border },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: CHART_HEIGHT,
  },
  column: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  track: {
    height: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
});
