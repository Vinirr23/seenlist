import { Image, StyleSheet, type StyleProp, type ImageStyle } from "react-native";

/**
 * A PEDIDO (2026-09-29) — "selo de verificação" (blue check / golden
 * check), versão mobile. Mesmo desenho aprovado no mockup web
 * (https://claude.ai/artifact/HuSom21Ch3roVNDjR3EneC — "perfeito"),
 * mas renderizado como PNG pré-exportado em vez de SVG ao vivo:
 * `react-native-svg` não é dependência deste app hoje, e o padrão já
 * estabelecido no código (ver comentário em `components/ui/Glass.tsx`
 * sobre trocar gradiente ao vivo por PNG pré-borrado) é justamente
 * esse — decisão confirmada com o usuário.
 *
 * `require(...)` com nome base (sem @2x/@3x) deixa o Metro/RN
 * escolher a resolução certa pra densidade de tela automaticamente —
 * os arquivos `verified-gold@2x.png`/`@3x.png` etc. já estão ao lado.
 *
 * Como `<Text>` do RN não aceita filho não-textual inline (diferente
 * do `<p>` da web com `<svg>`), este componente é sempre renderizado
 * como irmão do nome dentro de uma `View` com `flexDirection: "row"`
 * — nunca dentro do próprio `<Text>` do nome.
 */

export type VerifiedTier = "gold" | "blue" | null | undefined;

const SOURCES = {
  gold: require("../../assets/badges/verified-gold.png"),
  blue: require("../../assets/badges/verified-blue.png"),
} as const;

interface VerifiedBadgeProps {
  tier: VerifiedTier;
  /** Tamanho em px. Padrão 16 — ajustar por contexto: ~18 cabeçalho de perfil, ~14 linhas de lista, ~13 comentários/posts. */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function VerifiedBadge({ tier, size = 16, style }: VerifiedBadgeProps) {
  if (tier !== "gold" && tier !== "blue") return null;

  return (
    <Image
      source={SOURCES[tier]}
      style={[{ width: size, height: size }, styles.badge, style]}
      resizeMode="contain"
      accessibilityLabel={tier === "gold" ? "Conta oficial verificada" : "Conta verificada"}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    marginLeft: 4,
  },
});
