import { memo, useEffect, useRef, useState } from "react";
import { View, Pressable, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchDisplaySummariesCached, tmdbImageUrl, type MediaSummary } from "@/lib/library";
// `Glass` saiu: o único uso era o card vazio, que virou material próprio (ver `emptyCard`).
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const PAGE_SIZE = 20;
/**
 * CORREÇÃO (bug real, reportado — "os cards de perfil [...] não estão
 * com o mesmo tamanho do web", 2026-09-03) — era `96×144` (largura
 * fixa 96, proporção ~2:3 aproximada por acaso). O web usa `w-36
 * aspect-[2/3]` (144px de largura, proporção 2:3 exata → 216px de
 * altura) em TODO carrossel de pôster do Perfil/Explorar
 * (`ProfileMediaCarousel.tsx`, `DiscoverCard.tsx`) — mesmo valor já
 * usado certo no `DiscoverCarousel.tsx` deste app (mobile), só este
 * componente (e `PublicMediaCarousel.tsx`, mesmo bug, mesma correção)
 * tinham ficado pra trás com o valor antigo, menor. `POSTER_HEIGHT`
 * fixo saiu — a altura agora vem de `aspectRatio: 2/3` (igual ao
 * `aspect-[2/3]` do web), não de um número fixo independente da
 * largura.
 */
const POSTER_WIDTH = 144;

/**
 * Porta de `ProfileMediaCarousel.tsx` do web — recebe a lista de IDs
 * já ordenada por atividade (`profileMediaCarousel.ts`) e busca
 * resumo (pôster/título) só de quem está visível, em lotes de 20,
 * carregando mais conforme a lista rola até o fim (`FlatList` +
 * `onEndReached`, equivalente ao listener de scroll do web — não tem
 * `IntersectionObserver`/scroll de DOM no React Native).
 */
/**
 * MEMOIZADO (2026-09-17, causa raiz do "delay na mudança de abas" —
 * ver `Glass.tsx`/`app/(tabs)/profile.tsx`) — as props que variam de
 * verdade aqui (`ids`, `isLoadingIds`) vêm de hooks `useState` em
 * `lib/profileMediaCarousel.ts` (`useSeriesActivityIds`/
 * `useMovieActivityIds`/`useFavoriteIds`): a referência do array `ids`
 * só muda quando o PRÓPRIO `setIds` daquele hook roda, nunca por um
 * hook IRMÃO (de outro carrossel, de `useFollowCounts`, etc.)
 * resolvendo e re-renderizando `ProfileScreen` inteiro — então a
 * comparação rasa padrão do `memo()` (sem 2º argumento) já é
 * suficiente pra pular esses re-renders desnecessários.
 */
export const ProfileMediaCarousel = memo(function ProfileMediaCarousel({
  icon,
  label,
  href,
  mediaType,
  ids,
  isLoadingIds,
  emptyLabel,
  emptyHref,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  href: string;
  mediaType: "movie" | "series";
  ids: number[];
  isLoadingIds: boolean;
  emptyLabel?: string;
  emptyHref?: string;
}) {
  const router = useRouter();
  const { locale } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(0);
  const [summaryMap, setSummaryMap] = useState<Record<number, MediaSummary>>({});
  const fetchedUpTo = useRef(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    fetchedUpTo.current = 0;
    setSummaryMap({});
    setVisibleCount(Math.min(PAGE_SIZE, ids.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, locale]);

  useEffect(() => {
    if (visibleCount <= fetchedUpTo.current) return;
    const newIds = ids.slice(fetchedUpTo.current, visibleCount);
    fetchedUpTo.current = visibleCount;
    fetchDisplaySummariesCached(mediaType === "movie" ? newIds : [], mediaType === "series" ? newIds : [], locale).then((result) => {
      const newMap = mediaType === "movie" ? result.movies : result.series;
      setSummaryMap((prev) => ({ ...prev, ...newMap }));
    });
  }, [visibleCount, ids, mediaType, locale]);

  function loadMore() {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, ids.length));
  }

  if (isLoadingIds) {
    return (
      <View style={styles.section}>
        <View style={[styles.sectionTitle, styles.sectionTitleStandalone]}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[0, 1, 2, 3, 4]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.row}
          renderItem={() => <View style={styles.skeleton} />}
        />
      </View>
    );
  }

  if (ids.length === 0) {
    // "Séries"/"Filmes" vazios: não mostra nada (biblioteca vazia,
    // não é um convite a fazer nada específico). Só favoritos (que
    // passam emptyLabel) mostram o card de convite.
    if (!emptyLabel) return null;
    return (
      <View style={styles.section}>
        <View style={[styles.sectionTitle, styles.sectionTitleStandalone]}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <Pressable onPress={() => router.push(emptyHref ?? href)}>
          {/*
            * NÃO é `Glass` de propósito (2026-09-04, a pedido) — ver
            * `emptyCard` nos estilos.
            */}
          <View style={styles.emptyCard}>
            <Feather name="plus" size={24} color={colors.muted} />
            <Text style={styles.emptyText}>{emptyLabel}</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  const visibleIds = ids.slice(0, visibleCount);

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => router.push(href)}>
        <View style={styles.sectionTitle}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </Pressable>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={visibleIds}
        keyExtractor={(id) => String(id)}
        contentContainerStyle={styles.row}
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        renderItem={({ item: id }) => {
          const summary = summaryMap[id];
          const posterUrl = tmdbImageUrl(summary?.posterPath ?? null, "w185");
          const itemHref = mediaType === "movie" ? `/movies/${id}` : `/series/${id}`;
          return (
            <Pressable style={styles.poster} onPress={() => router.push(itemHref)}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
              ) : summary ? (
                <View style={styles.posterPlaceholder}>
                  <Feather name="film" size={20} color={colors.muted} style={{ opacity: 0.4 }} />
                </View>
              ) : (
                <View style={styles.skeleton} />
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  /**
   * CORREÇÃO (2026-09-04, auditoria mobile × web) — duas coisas:
   *
   * 1. `marginBottom` era `spacing.lg` (24); o web usa `mb-8` = 32 nas
   *    TRÊS `<section>` deste componente (carregando, vazio e normal).
   *    Como são 4 carrosséis no Perfil, os 8px a menos se acumulavam e
   *    apertavam o ritmo da tela inteira.
   * 2. O `paddingHorizontal` saiu daqui. O web usa `-mx-4 … px-4` na
   *    trilha de rolagem: ela SANGRA até a borda da tela e só o
   *    conteúdo começa a 16px — assim o último pôster some na borda em
   *    vez de parar 16px antes. Com o padding na seção, a `FlatList`
   *    era recortada. Agora o respiro vai em `contentContainerStyle`
   *    da lista (`row`) e nos cabeçalhos (`sectionPadded`), que é o
   *    equivalente exato.
   */
  section: {
    marginBottom: spacing.xl,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); o web usa `mb-3` (`ProfileMediaCarousel.tsx`, cabeçalho clicável) = 12px — sem token exato, valor literal. */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    /** 16 de borda de tela (a `section` não pada mais — a trilha sangra) + `px-1` (4) do web. */
    paddingHorizontal: spacing.md + spacing.xs,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.xs` (4); o web usa `gap-2` (`ProfileMediaCarousel.tsx`, ícone+título) = 8px. */
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    /*
     * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-16, print real — "Séries"
     * aparecia mais recuado da borda que "Minhas listas"/"Séries
     * favoritas", medido no pixel: 80px contra 42px de início do ícone,
     * ~38px de diferença real, não ilusão de ótica dos glifos).
     *
     * O `paddingHorizontal` estava AQUI **e** em `sectionHeader`, logo
     * abaixo — e no estado "com itens" um envolve o outro
     * (`<Pressable style={sectionHeader}><View style={sectionTitle}>`),
     * então a borda de tela era somada DUAS vezes (20 + 20 = 40px em vez
     * de 20px). O estado vazio/carregando usa só `sectionTitle` (sem o
     * `sectionHeader` por fora — não é clicável), por isso nunca mostrou
     * o bug: e é exatamente por isso que "Séries favoritas" (vazia no
     * print) parecia correta enquanto "Séries" (com itens, com o
     * cabeçalho clicável) saía deslocada.
     *
     * Fix: o respiro de borda sai daqui (só teria efeito real dentro do
     * `sectionHeader`, que já o aplica) e vai para `sectionTitleStandalone`
     * — assim cada estado carrega o padding exatamente UMA vez: o
     * clicável no `sectionHeader`, o parado aqui embaixo.
     */
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); os estados "carregando"/vazio no web usam o MESMO `mb-3` (12px) do cabeçalho clicável (`ProfileMediaCarousel.tsx`), não um valor menor à parte. */
  sectionTitleStandalone: {
    marginBottom: 12,
    /** Ver o comentário longo em `sectionTitle`, acima — o padding de borda mudou pra cá. */
    paddingHorizontal: spacing.md + spacing.xs,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `fontSize.md` (16) / `"700"`; o web usa `text-lg font-extrabold` (`ProfileMediaCarousel.tsx`, título de cada carrossel) = 18px / peso 800. */
  sectionTitleText: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.text,
    /** `tracking-tight` do web = -0.025em; a 18px dá -0.45px. */
    letterSpacing: -0.45,
    /**
     * CORREÇÃO (2026-09-15, item deixado de fora de propósito em
     * 2026-09-03, retomado agora) — o título aqui não tinha NENHUMA
     * sombra; no web (`ProfileMediaCarousel.tsx`, os 3 estados —
     * carregando/vazio/normal) o `<h2>` tem `text-shadow` em TRÊS
     * camadas — `0_0_2px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.75),
     * 0_1px_6px_rgba(0,0,0,0.6)` — pra dar legibilidade ao título
     * sentado direto sobre o brilho azul ambiente (sem card de vidro
     * por baixo, igual ao comentário do web: "mesmo motivo/ajuste de
     * ProfileListsPreview.tsx").
     *
     * `Text` do React Native só aceita UMA camada de sombra
     * (`textShadowColor`/`Offset`/`Radius` — sem lista, diferente do
     * `text-shadow` do CSS que aceita várias). Não dá pra reproduzir
     * as 3 camadas literalmente; usado um valor único que aproxima a
     * soma visual das 3 (raio maior que a menor camada, cor bem
     * escura e opaca) — mais fiel ao efeito (halo escuro atrás do
     * texto) do que deixar sem sombra nenhuma, que era o estado daqui
     * antes desta correção.
     */
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    /** CORREÇÃO (2026-09-04) — era `radius.md` (10); web `rounded-2xl` = 16. */
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    /**
     * BORDA DE VIDRO DA CAPA (2026-09-04, a pedido — "ao redor de toda
     * capa de série/filme tem uma borda fina que reflete").
     *
     * No web a caixa do pôster é uma superfície de vidro de verdade
     * (`ProfileMediaCarousel.tsx`: `border border-white/10` +
     * `backdrop-blur-[14px]` + a receita `0.16/0.09`) — a imagem cobre o
     * miolo, então o que sobra visível é exatamente essa borda. Aqui a
     * caixa não tinha borda nenhuma. Só o `border-white/10` literal.
     */
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    /** CORREÇÃO (2026-09-04) — era `radius.md` (10); web `rounded-2xl` = 16. */
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.xs` (4); o web usa `gap-2` (`ProfileMediaCarousel.tsx`, card de convite vazio) = 8px. */
  /**
   * MATERIAL PRÓPRIO, NÃO É VIDRO (2026-09-04, a pedido — "os cards
   * vazios no web não usam o mesmo material dos outros").
   *
   * Conferido no `ProfileMediaCarousel.tsx` do web: a classe do card
   * vazio é `rounded-2xl border border-dashed border-border
   * bg-surface/40` — e só. SEM `backdrop-blur`, SEM `radial-gradient`,
   * sem sombra interna, sem highlight. É uma superfície translúcida
   * plana, não vidro.
   *
   * Aqui estava usando `<Glass>`, que trazia junto blur, véu navy,
   * brilho de canto e a moldura de 1px — acabamento que o web reserva
   * pros cards de conteúdo (Estatísticas, Recomendações). Trocado por
   * `View` com os valores literais do web:
   *   - fundo   `bg-surface/40`      → `colors.surface` (#131826) a 40%
   *   - borda   `border-dashed border-border` → 1px tracejada, `colors.border`
   * O resto (raio, padding, gap, conteúdo) não mudou.
   */
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(19,24,38,0.4)",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    /** A `section` não pada mais (a trilha sangra), então a borda de tela vem aqui. */
    marginHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
