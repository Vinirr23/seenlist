import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
 * cobre a tela inteira com o erro completo.
 *
 * `useSafeAreaInsets()` (não `<SafeAreaView>` nativo — mesma regra
 * documentada em `Screen.tsx`/`OfflineBanner.tsx`: o componente
 * nativo já travou o app com SIGSEGV nesta base de código).
 *
 * CORREÇÃO (2026-10-09, reportado pelo usuário — "não consigo
 * acessar as primeiras mensagens", vídeo mostrando scroll infinito
 * preso numa cadeia repetida `guardedLoadModule → metroRequire →
 * anonymous → loadModuleImplementation`) — a primeira versão botava
 * TUDO (ícone + título + `error.message` + `error.stack` inteiro)
 * dentro de UM `ScrollView` só. Quando a pilha é gigante (ex.: um
 * `require` circular entre módulos gera centenas/milhares de frames
 * repetidos — exatamente o padrão do vídeo), `error.message` fica lá
 * no topo do mesmíssimo scroll, só que rolar manualmente até lá por
 * trás de milhares de linhas de pilha é impraticável na prática.
 *
 * Agora a mensagem fica FIXA (fora de qualquer scroll, sempre
 * visível assim que a tela aparece, sem precisar rolar nada) e só a
 * pilha (potencialmente enorme) fica num `ScrollView` PRÓPRIO, com
 * altura limitada ao espaço restante da tela — a mensagem nunca
 * desce escondida atrás dela.
 */
export function FatalErrorOverlay() {
  const [error, setError] = useState<Error | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(
    () =>
      onGlobalError((caughtError, isFatal) => {
        if (isFatal) setError(caughtError);
      }),
    []
  );

  if (!error) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Feather name="alert-triangle" size={32} color={colors.warning} />
        <Text style={styles.title}>Erro fatal capturado (diagnóstico)</Text>
        <Text variant="muted" style={styles.subtitle}>
          Isso normalmente fecharia o app sem nenhum aviso. A mensagem abaixo não rola — printa ela primeiro. A pilha
          de chamadas (pode ser longa) fica na área com scroll logo abaixo.
        </Text>
        <Text variant="muted" style={styles.message} selectable>
          {error.message || "(sem mensagem — ver pilha abaixo)"}
        </Text>
      </View>

      <ScrollView style={styles.stackScroll} contentContainerStyle={styles.stackContent}>
        <Text variant="muted" style={styles.stackText} selectable>
          {error.stack ?? "(sem pilha de chamadas)"}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={() => setError(null)}>Fechar</Button>
      </View>
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
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    fontSize: fontSize.xxs,
  },
  message: {
    textAlign: "left",
    alignSelf: "stretch",
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.xs,
  },
  stackScroll: {
    flex: 1,
    marginTop: spacing.xs,
  },
  stackContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  stackText: {
    textAlign: "left",
    fontSize: fontSize.xxs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
