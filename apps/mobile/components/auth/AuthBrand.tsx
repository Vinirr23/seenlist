import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Text } from "@/components/ui";
import { radius, spacing } from "@/lib/theme";

/**
 * CORREÇÃO (auditoria de consistência) — achado real: logo e nome
 * "SeenList" existiam SÓ na tela de Login (registrado como pendência
 * numa sessão anterior: "adicionados na tela de login — só lá, por
 * enquanto"). Criar conta e Esqueci a senha abriam sem nenhuma
 * identidade visual, o que é justamente onde a primeira impressão
 * mais pesa — quem está criando conta ainda não conhece o produto.
 *
 * Componente compartilhado em vez de copiar o bloco em 3 arquivos:
 * mudar a logo ou o espaçamento passa a valer nas três telas de uma
 * vez. `compact` reduz o tamanho pras telas que têm mais conteúdo
 * embaixo (Criar conta tem 3 campos, não 2).
 */
export function AuthBrand({ compact }: { compact?: boolean }) {
  const size = compact ? 56 : 80;

  return (
    <View style={styles.brand}>
      <Image source={require("@/assets/images/logo.png")} style={{ width: size, height: size, borderRadius: radius.lg }} />
      <Text variant={compact ? "subtitle" : "title"} style={styles.brandName}>
        SeenList
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  brandName: {
    marginTop: spacing.sm,
  },
});
