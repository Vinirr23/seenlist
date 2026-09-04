import { useCallback, useState } from "react";
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyListsWithPreview, type ListWithPreview } from "@/lib/lists";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Skeleton, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const CARD_SIZE = 112;

/**
 * Porta de `ProfileListsPreview.tsx` do web — "Minhas listas" ganha o
 * efeito "baralho" (pôsteres empilhados/levemente rotacionados) em
 * vez de uma linha só com contador. Mesma regra: índice 0 é o item
 * mais recente (a consulta já vem ordenada assim), fica na frente
 * sem rotação; os de trás alternam o lado, tipo um baralho de
 * verdade.
 *
 * Correção (bug real, reportado) — buscava só na montagem
 * (`useEffect` com deps vazias); como a aba Perfil fica montada em
 * segundo plano (o React Navigation não desmonta abas ao trocar),
 * criar/editar uma lista em outra tela e voltar pro Perfil nunca
 * disparava uma busca nova. Trocado por `useFocusEffect` (mesmo
 * padrão já usado em `ProfileRecommendationsPreview`), que busca de
 * novo toda vez que a aba ganha foco.
 */
export function ProfileListsPreview() {
  const router = useRouter();
  const { locale } = useTranslation();
  const [lists, setLists] = useState<ListWithPreview[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchMyListsWithPreview(locale)
        .then((data) => {
          if (!cancelled) setLists(data);
        })
        .catch((error) => {
          console.error("[ProfileListsPreview] Falha ao buscar listas", error);
          if (!cancelled) setLists([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [locale])
  );

  return (
    <View style={styles.section}>
      {/* PADRONIZAÇÃO (2026-09-03, auditoria "implementar tudo que não
        * envolve redesign") — cabeçalho agora é clicável (Pressable +
        * chevron), levando pra `/lists`, igual ao padrão já usado em
        * `ProfileMediaCarousel.tsx` ("Séries"/"Filmes"/favoritos). Antes
        * só os cards individuais navegavam — o título "Minhas listas"
        * em si não era um link, inconsistente com o resto do Perfil. */}
      <Pressable style={styles.sectionHeader} onPress={() => router.push("/lists")}>
        <View style={styles.sectionTitle}>
          <Feather name="check-square" size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>Minhas listas</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </Pressable>

      {isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={CARD_SIZE} height={CARD_SIZE} />
          ))}
        </ScrollView>
      ) : !lists || lists.length === 0 ? (
        <Pressable onPress={() => router.push("/lists")}>
          <Glass style={styles.emptyCard}>
            <Feather name="plus" size={22} color={colors.muted} />
            <Text style={styles.emptyText}>Criar sua primeira lista</Text>
          </Glass>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {lists.map((list) => (
            <Pressable key={list.id} style={styles.card} onPress={() => router.push(`/lists/${list.id}`)}>
              <View style={styles.deck}>
                {list.previewPosters.length === 0 ? (
                  <View style={styles.deckEmpty}>
                    <Feather name="check-square" size={22} color={colors.muted} style={{ opacity: 0.4 }} />
                  </View>
                ) : (
                  list.previewPosters.slice(0, 4).map((posterPath, index, arr) => {
                    const posterUrl = tmdbImageUrl(posterPath, "w185");
                    const zIndex = arr.length - index;
                    const rotation = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1) * index * 4;
                    const translateY = index === 0 ? 0 : index * -3;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.deckPoster,
                          { zIndex, transform: [{ translateY }, { rotate: `${rotation}deg` }] },
                        ]}
                      >
                        {posterUrl && <Image source={{ uri: posterUrl }} style={styles.deckPosterImage} contentFit="cover" />}
                      </View>
                    );
                  })
                )}
              </View>
              <Text numberOfLines={1} style={styles.listName}>
                {list.name}
              </Text>
              <Text variant="muted" style={styles.listCount}>
                {list.itemCount} {list.itemCount === 1 ? "item" : "itens"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. `marginBottom`
  // (ritmo vertical entre seções) NÃO foi tocado — fora do escopo.
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.xs` (4); o web usa `gap-2` (`ProfileListsPreview.tsx`, ícone+título) = 8px. */
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  /** fontSize.md (16) / "700" já batem com o web (`text-base font-bold` = 16px/700, `ProfileListsPreview.tsx`) — menor/menos peso que o título dos carrosséis de pôster (`ProfileMediaCarousel.tsx`, 18px/800) de propósito, os dois são diferentes no próprio web. */
  sectionTitleText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); o web usa `gap-3` (`ProfileListsPreview.tsx`, fileira de listas) = 12px — sem token exato, valor literal. */
  row: {
    gap: 12,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.xs` (4); o web usa `gap-2` (`ProfileListsPreview.tsx`, card de convite vazio) = 8px. */
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  card: {
    width: CARD_SIZE,
  },
  deck: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  deckEmpty: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  deckPoster: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  deckPosterImage: {
    width: "100%",
    height: "100%",
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `fontSize.sm` (14) era maior que o web: `text-xs font-medium` (`ProfileListsPreview.tsx`, nome da lista) = 12px/500. `marginTop: 6` já batia com `mt-1.5` (6px) — não mudou. */
  listName: {
    marginTop: 6,
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.text,
  },
  listCount: {
    fontSize: 11,
  },
});
