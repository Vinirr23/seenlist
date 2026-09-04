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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. Este é o padding
  // padrão do `<Screen>` (usado quando `padded` não é `false`) — hoje
  // só entra em jogo nos estados de carregamento/erro das telas de
  // detalhe (`<Screen><MediaDetailSkeleton /></Screen>`, `<Screen>
  // <PageError /></Screen>`), já que as telas com conteúdo próprio
  // usam `padded={false}` e cuidam do próprio padding — sem esta
  // troca, a borda "pularia" de 16 pra 24px ao trocar do skeleton pro
  // conteúdo real.
  padded: {
    paddingHorizontal: spacing.md,
  },
});
