import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "./Text";
import { GelSurface } from "./Glass";
import { PressableScale } from "./PressableScale";

export type ButtonVariant = "primary" | "secondary" | "outline";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  children: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /**
   * NOVO (2026-09-22, achado real — o botão "Continuar com Google" no
   * web tem o logo oficial colorido do Google do lado do texto
   * (`components/auth/GoogleButton.tsx` do web, `<GoogleIcon />`); a
   * versão mobile nunca portou isso, só o texto — reportado pelo
   * usuário ao comparar com o botão nativo da Apple, que já vem com
   * ícone por ser componente oficial da Apple. Opcional e sem efeito
   * nenhum nos outros botões do app (todos continuam sem ícone).
   */
  icon?: ReactNode;
}

/**
 * TASK-090 (fundação nativa) — equivalente nativo do `packages/ui/
 * src/Button.tsx` do web (que usa `<button>`/`className`, incompatível
 * com React Native). Mesmos tokens de cor, comportamento próprio de
 * toque (`Pressable`) em vez de CSS `:hover`/`:disabled`.
 *
 * CORREÇÃO (a pedido, 2026-09-27, print real comparando o botão "Salvar"
 * do Editar perfil com o botão "0 comentários" — "o botão save que é em
 * âmbar, devia ter o mesmo efeito que o botão comments, que é o
 * padrão") — CAUSA RAIZ: `variant="primary"` sempre foi cor CHAPADA
 * (`colors.primary` sólido), enquanto o `GelSurface` (o "gel" âmbar com
 * degradê/brilho/borda, calibrado pixel a pixel contra o web — ver
 * `Glass.tsx`) até aqui só existia em pontos AVULSOS: StatisticsCard
 * ("Ver detalhes"), EmptyLibraryHero, EmptyShelf, criar lista,
 * comentários de episódio, aba ativa do Explorar, "Editar" do perfil
 * público — nunca no `<Button>` compartilhado, que é o botão de ação
 * PRINCIPAL (Entrar, Cadastrar, Esqueci senha, Enviar feedback, Salvar
 * do editar perfil, onboarding, responder comentário etc., ~10 telas).
 *
 * Dadas 3 opções de escopo (só o "Salvar" × esta correção global × um
 * variant novo opt-in), o usuário escolheu a global: `variant="primary"`
 * agora RENDERIZA como `GelSurface` (em vez de só ganhar a cor), então
 * todo botão primário do app passa a ter o mesmo efeito de uma vez, sem
 * precisar tocar tela por tela. `secondary`/`outline` NÃO mudam — não
 * fazem parte do pedido, continuam cor chapada/`Pressable` como sempre.
 *
 * A troca de `Pressable` por `PressableScale` no caminho `primary`
 * segue o mesmo padrão já estabelecido pros outros usos de `GelSurface`
 * no app (`u/[username]/index.tsx`, `EditProfileScreen` etc. — sempre
 * `PressableScale` por fora, nunca `Pressable` cru), em vez do feedback
 * antigo por opacidade (`state.pressed && styles.pressed`).
 */
export function Button({ children, variant = "primary", loading = false, disabled, style, icon, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;

  const content = loading ? (
    <ActivityIndicator color={variant === "primary" ? colors.background : colors.primary} size="small" />
  ) : (
    <>
      {icon}
      <Text variant="label" style={variant === "primary" ? styles.primaryText : styles.otherText}>
        {children}
      </Text>
    </>
  );

  if (variant === "primary") {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        style={[isDisabled && styles.disabled, style as object]}
        {...props}
      >
        <GelSurface webCalibrated style={styles.base}>
          {content}
        </GelSurface>
      </PressableScale>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        state.pressed && !isDisabled && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: colors.background,
  },
  otherText: {
    color: colors.text,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
