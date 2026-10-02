import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * TASK-150 (expansão pro resto do app) — "phantom" de card de post
 * (Feed, tela de post, atividade do Explorar): avatar + nome + corpo
 * de texto + imagem.
 *
 * VARIANTE `bare` (2026-10-01, a pedido — achado da auditoria UI/UX:
 * "skeleton de carregamento não se parece com o Feed real") — CAUSA
 * RAIZ: este componente sempre desenhou cada "fantasma" dentro de uma
 * caixa (`borderWidth`/`colors.surface`/`radius.md`), mas o Feed
 * (`PostCard.tsx`/`ActivityCard.tsx`) deixou de usar esse estilo em
 * 2026-09-29 ("feed igual Threads") — virou borderless, só uma linha
 * fina embaixo separando os itens. O Feed é o ÚNICO lugar que mostra
 * este skeleton sem ser dentro de uma caixa; `app/posts/[id].tsx`
 * (tela de detalhe do post) e `FeedTabContent.tsx` continuam chamando
 * sem a prop nova, então o visual deles não muda — `bare` é opt-in,
 * default `false` preserva tudo que já existia. Conteúdo interno
 * (avatar+2 linhas) NÃO mudou — só a moldura externa.
 */
export function PostCardSkeleton({ count = 3, bare = false }: { count?: number; bare?: boolean }) {
  return (
    <View style={bare ? undefined : styles.wrapper}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={bare ? styles.cardBare : styles.card}>
          <View style={styles.headerRow}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <View style={styles.headerInfo}>
              <Skeleton width="40%" height={12} />
              <Skeleton width="25%" height={10} style={styles.secondLine} />
            </View>
          </View>
          <Skeleton width="100%" height={12} style={styles.bodyLine} />
          <Skeleton width="70%" height={12} style={styles.bodyLine} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  // Variante `bare` — mesma receita de `PostCard.tsx`/`ActivityCard.tsx`: sem caixa/fundo/radius, só a linha fina embaixo separando um "fantasma" do próximo.
  cardBare: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
    gap: 6,
  },
  secondLine: {
    marginTop: 2,
  },
  bodyLine: {
    marginTop: spacing.sm,
  },
});
