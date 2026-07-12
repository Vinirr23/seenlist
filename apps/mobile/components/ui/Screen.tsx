import { View, StyleSheet, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/lib/theme";

export interface ScreenProps extends ViewProps {
  /** Reserva espaço embaixo pro gesto/barra do sistema. Deixe `false` (padrão) dentro de uma aba — o tab bar do expo-router já cuida disso; use `true` só em telas sem tab bar (login, registro). */
  bottomInset?: boolean;
  padded?: boolean;
}

/**
 * TASK-090 (fundação nativa) — histórico importante (ver sessão de
 * 12/07): `SafeAreaView` (o componente nativo) já travou o app com
 * SIGSEGV nesta base de código. A solução adotada foi trocar por
 * `useSafeAreaInsets()` + padding manual num `View` comum — mantendo
 * essa mesma escolha aqui pra não reintroduzir o bug.
 */
export function Screen({ bottomInset = false, padded = true, style, children, ...props }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.base,
        {
          paddingTop: insets.top,
          paddingBottom: bottomInset ? insets.bottom : 0,
        },
        padded && styles.padded,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
