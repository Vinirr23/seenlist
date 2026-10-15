import type { ReactNode } from "react";
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * FASE 2 (consistência visual sistêmica, 2026-09-26) — a auditoria
 * achou 24 telas reimplementando o mesmo cabeçalho "seta + título" à
 * mão, com pequenas divergências acidentais entre elas (padding,
 * cor/tamanho do ícone, tipografia do título, hitSlop). Referência
 * escolhida a pedido: `apps/mobile/app/settings/index.tsx` — é o único
 * lugar que já tinha essa estrutura exatamente assim (ícone
 * `colors.muted`, título com peso 700 num tamanho próprio, padding
 * simétrico 16/16). As outras ~21 telas convergem pra este componente
 * como estavam (mesmo hitSlop=8, mesmo ícone `arrow-left` tamanho 20),
 * ganhando a mesma cor de ícone e tipografia de título da referência.
 *
 * `right` é um slot opcional — 3 das 24 telas têm um elemento extra ao
 * lado do título (ex.: "marcar todas como lidas", apagar lista, toggle
 * de visualização). As outras 21 simplesmente não passam essa prop.
 *
 * NÃO usar em telas hero/detail (banner/imagem de fundo, abas dentro
 * do próprio cabeçalho, etc.) — essas têm necessidades visuais
 * diferentes e foram deixadas de fora de propósito.
 *
 * `style` é escape hatch pontual — hoje só usado por
 * `movies/[id]/reviews.tsx`/`series/[id]/reviews.tsx`, que têm uma
 * linha divisória embaixo do cabeçalho (`border-b border-white/10` do
 * web, comentário de 2026-09-09) que nenhuma outra tela desse grupo
 * tem. Diferença real de necessidade visual, não acidental — por isso
 * não virou padrão do componente, só um jeito de encaixar sem forçar
 * as outras 23 telas a carregarem uma borda que não têm.
 */
export function ScreenHeader({
  title,
  titleIcon,
  onBack,
  right,
  style,
}: {
  title: string;
  /**
   * SELO AO LADO DO TÍTULO (2026-10-14, a pedido — "Lista compartilhada
   * · N participantes" virou redundante depois do selo azul + pilha de
   * avatares no `metaRow` de `app/lists/[id].tsx`; mockup aprovado:
   * https://claude.ai/artifact/MJ5sSF1aeAVguYsuabZoVf). Slot opcional —
   * `undefined` em todas as ~24 outras telas que usam este componente,
   * sem nenhuma mudança visual nelas.
   */
  titleIcon?: ReactNode;
  /** Sobrescreve o back padrão (`router.back()`) — nenhuma das 24 telas precisa disso hoje, existe só como escape hatch. */
  onBack?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={[styles.header, style]}>
      {/* CORREÇÃO (Fase 3, achado alto — acessibilidade de botões só-ícone) — `accessibilityLabel`/`accessibilityRole` faltavam aqui, o que atinge de uma vez as ~24 telas que usam este componente. */}
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
        <Feather name="arrow-left" size={20} color={colors.muted} />
      </Pressable>
      {/*
        `titleRow` (não o `Text` sozinho) leva o `flex: 1` agora — assim
        o selo fica GRUDADO ao nome (mockup aprovado), em vez de ser
        empurrado pro fim da linha, que é o que aconteceria se ficasse
        como irmão de um `Text` já com `flex: 1` sozinho.
      */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {titleIcon}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    // CORREÇÃO (2026-10-14) — `flex: 1` saiu daqui e foi pro `titleRow`
    // (ver comentário no JSX) — sem isso o selo opcional (`titleIcon`)
    // ficaria colado na borda direita do cabeçalho, longe do nome.
    flexShrink: 1,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.lgPlus` (era literal 20, mesmo valor — a referência que motivou o token, ver `settings/index.tsx`).
    fontSize: fontSize.lgPlus,
    fontWeight: "700",
    color: colors.text,
  },
});
