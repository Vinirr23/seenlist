import { Component, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Achado real de auditoria: o app inteiro não tinha NENHUM error
 * boundary — um erro de renderização não tratado em qualquer tela
 * (um `undefined` inesperado, formato de resposta de API diferente
 * do esperado) travava o app sem nenhuma mensagem pro usuário. Error
 * boundary no React só pode ser componente de classe (não existe
 * equivalente em hook) — `getDerivedStateFromError`/`componentDidCatch`
 * são a API oficial do React pra isso, não uma escolha de estilo.
 *
 * Isso não previne o bug em si, só evita a tela morta — a causa real
 * continua precisando ser investigada quando aparecer no
 * `console.error` (visível no terminal do Metro/log do Sentry, se um
 * dia existir um).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Feather name="alert-triangle" size={40} color={colors.muted} />
          <Text style={styles.title}>Algo deu errado</Text>
          <Text variant="muted" style={styles.subtitle}>
            Essa tela travou de um jeito inesperado. Tenta de novo — se continuar acontecendo, conta pra gente em
            Configurações → Enviar feedback.
          </Text>
          <Button onPress={() => this.setState({ error: null })}>Tentar de novo</Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
