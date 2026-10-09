import { Component, type ReactNode } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
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
  override state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  override render() {
    if (this.state.error) {
      return (
        <View style={styles.screen}>
          {/*
           * CAUSA RAIZ (2026-10-09, descoberta durante a investigação
           * do crash de "Ver todas as avaliações") — este container
           * era `flex: 1` + `justifyContent: "center"` SEM
           * `ScrollView`. Quando o conteúdo (ícone + título + subtítulo
           * + `error.message` + 6 linhas de `componentStack` + botão)
           * é mais alto que a tela, o RN centraliza mesmo assim — o
           * topo do conteúdo (bem onde fica `error.message`, a parte
           * que a gente precisava ler) fica cortado pra fora da tela,
           * sem nenhum jeito de rolar pra ver. Não era o print mal
           * enquadrado — a própria tela de erro era incapaz de
           * mostrar mensagens longas. Corrigido envolvendo tudo num
           * `ScrollView` com `contentContainerStyle` centralizado
           * (`flexGrow: 1` + `justifyContent: "center"` no CONTEÚDO,
           * não no scroll) — centraliza quando cabe, rola quando não
           * cabe.
           */}
          <ScrollView contentContainerStyle={styles.container}>
            <Feather name="alert-triangle" size={40} color={colors.muted} />
            <Text style={styles.title}>Algo deu errado</Text>
            <Text variant="muted" style={styles.subtitle}>
              Essa tela travou de um jeito inesperado. Tenta de novo — se continuar acontecendo, conta pra gente em
              Configurações → Enviar feedback.
            </Text>
            {/*
             * A PEDIDO (diagnóstico temporário) — mostra o motivo E a
             * pilha de componentes na própria tela, pra printar e
             * mandar. A mensagem sozinha ("Cannot read property
             * 'prototype' of undefined") não dizia QUAL componente —
             * `componentStack` mostra a árvore de componentes que
             * estava renderizando na hora do erro, de cima pra baixo,
             * o suficiente pra apontar o arquivo certo.
             */}
            <Text variant="muted" style={styles.errorDetail} selectable>
              {this.state.error.message}
              {this.state.componentStack ? `\n${this.state.componentStack.trim().split("\n").slice(0, 6).join("\n")}` : ""}
            </Text>
            <Button onPress={() => this.setState({ error: null, componentStack: null })}>Tentar de novo</Button>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  errorDetail: {
    textAlign: "center",
    fontSize: fontSize.xxs,
    marginBottom: spacing.sm,
  },
});
