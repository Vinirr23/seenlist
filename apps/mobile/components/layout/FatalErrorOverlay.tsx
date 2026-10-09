import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";
import { onGlobalError } from "@/lib/globalErrorHandler";

/**
 * DIAGNÓSTICO TEMPORÁRIO (2026-10-09) — ver comentário completo em
 * `lib/globalErrorHandler.ts`. Este componente é a PARTE VISÍVEL do
 * diagnóstico: fica montado sempre (irmão do `<Stack>`, mesmo nível
 * do `<ErrorBoundary>` em `app/_layout.tsx`) e não renderiza nada até
 * `globalErrorHandler` capturar um erro marcado como FATAL — aí
 * cobre a tela inteira com o erro completo (mensagem + stack, sem
 * cortar nenhuma linha, diferente do `ErrorBoundary` normal) pra dar
 * tempo de printar e mandar antes de tocar em "Fechar".
 *
 * Reaproveita o MESMO padrão de `ErrorBoundary.tsx` (ScrollView com
 * `contentContainerStyle` centralizado) — mesmo bug de conteúdo
 * cortado se não tivesse.
 */
export function FatalErrorOverlay() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(
    () =>
      onGlobalError((caughtError, isFatal) => {
        if (isFatal) setError(caughtError);
      }),
    []
  );

  if (!error) return null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Feather name="alert-triangle" size={40} color={colors.warning} />
        <Text style={styles.title}>Erro fatal capturado (diagnóstico)</Text>
        <Text variant="muted" style={styles.subtitle}>
          Isso normalmente fecharia o app sem nenhum aviso. Printa esta tela inteira (rola se precisar) e manda —
          depois toca em "Fechar" pra tentar continuar (pode ficar instável até reabrir o app).
        </Text>
        <Text variant="muted" style={styles.errorDetail} selectable>
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </Text>
        <Button onPress={() => setError(null)}>Fechar</Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  errorDetail: {
    textAlign: "left",
    fontSize: fontSize.xxs,
    marginBottom: spacing.sm,
  },
});
