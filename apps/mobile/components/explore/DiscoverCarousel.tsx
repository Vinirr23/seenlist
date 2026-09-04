import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { DiscoverItem } from "@/lib/discover";
import { fetchLibraryStatusesFor } from "@/lib/discover";
import { tmdbImageUrl } from "@/lib/library";
import { AddToLibraryButton } from "./AddToLibraryButton";
import { PressableScale, Glass } from "@/components/ui";
import { colors, radius, spacing, elevation } from "@/lib/theme";

/**
 * PADRONIZADO COM O WEB (2026-09-02, a pedido — "o tamanho dos cards
 * e tirar os títulos debaixo dos cards, deixe padronizado com web,
 * tudo") — igual a `apps/web/components/explore/DiscoverCard.tsx`:
 * era 112px (aproximação antiga, de antes desta reformulação); web
 * está em 144px (`w-36`) desde a correção "deixa os cards um pouco
 * maiores" de lá.
 */
const CARD_WIDTH = 144;

/**
 * PORTE DO WEB (2026-09-02, reformulação completa da Explorar) —
 * `title` virou `ReactNode` (era `string`), mesmo tipo já usado em
 * `apps/web/components/explore/DiscoverCarousel.tsx`: o novo título
 * "Populares no SeenList" precisa de um ícone de chama (`Ionicons
 * name="flame"`) do lado do texto, e RN não permite `View`/ícone
 * livre dentro de `Text` (só string ou outro `Text` aninhado) — por
 * isso a renderização abaixo trocou de `<Text>{title}</Text>` pra um
 * `<View>{title}</View>` "burro" (só layout), e quem chama passa o
 * `<Text>` (título simples) ou um `<View style={{flexDirection:
 * "row"}}>` com ícone+texto (título com destaque) já pronto.
 *
 * `viewAllHref` (2026-09-02, a pedido — "no web, explorar tem uma
 * seta '>' [...] você não adicionou isso ao mobile") — igual ao web
 * (`DiscoverCarousel.tsx`, prop de mesmo nome): quando presente, o
 * cabeçalho INTEIRO vira tocável e navega pra tela "ver todos" daquela
 * lista, com uma seta `chevron-right` ao lado do título. Sem essa
 * prop, o cabeçalho continua só texto, sem toque nenhum — mesmo
 * comportamento de sempre (nem todo carrossel do app tem uma tela "ver
 * todos" — ver `PosterGrid`/carrosséis do Perfil).
 */
export function DiscoverCarousel({
  title,
  items,
  isLoading,
  viewAllHref,
}: {
  title: ReactNode;
  items: DiscoverItem[];
  isLoading: boolean;
  viewAllHref?: string;
}) {
  const router = useRouter();
  /**
   * TASK-152 — busca o status de TODOS os itens visíveis de uma vez
   * (2 consultas no total, não uma por pôster) assim que a lista
   * chega — cada `AddToLibraryButton` já nasce sabendo se precisa
   * mostrar "+" ou "check", sem atraso individual.
   */
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [statusesLoaded, setStatusesLoaded] = useState(false);

  /**
   * CORREÇÃO (a pedido — "mostra tudo, inclusive o que já tá na
   * Biblioteca, depois remonta certo") — desde que os itens passaram
   * a chegar instantâneos (cache local, `useDiscoverList.ts`), essa
   * busca de status (que sempre existiu, TASK-152) ficou "sobrando"
   * visível: antes as duas buscas terminavam quase juntas e esse
   * instante de itens não filtrados ficava escondido atrás do
   * esqueleto de carregamento dos ITENS; agora que os itens não
   * esperam mais nada, o flash apareceu.
   *
   * `statusesLoaded` agora volta pra `false` no INÍCIO de cada nova
   * busca (não só na primeira vez) — a tela espera o status também
   * estar pronto antes de trocar o esqueleto pelos itens de verdade,
   * mesmo em atualizações silenciosas depois da primeira. Lista vazia
   * conta como "carregado" na hora (nada pra esperar) — senão travaria
   * no esqueleto pra sempre.
   */
  useEffect(() => {
    if (items.length === 0) {
      setStatusesLoaded(true);
      return;
    }
    setStatusesLoaded(false);
    let cancelled = false;
    fetchLibraryStatusesFor(items.map((item) => ({ mediaType: item.mediaType, id: item.id })))
      .then((result) => {
        if (cancelled) return;
        setStatuses(result);
        setStatusesLoaded(true);
      })
      .catch((error) => {
        console.error("[DiscoverCarousel] Falha ao buscar status em lote", error);
        if (!cancelled) setStatusesLoaded(true); // não trava no esqueleto pra sempre se der erro — cai pra lista sem filtrar
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.mediaType}-${i.id}`).join(",")]);

  /**
   * CORREÇÃO (a pedido, mesmo achado já corrigido no Explorar do web
   * — "por que fica aparecendo coisa que já está marcada?") —
   * reaproveita o MESMO lote de status já buscado pra mostrar o selo
   * de "+"/"check" (não dispara consulta nova): qualquer item que já
   * tenha status na Biblioteca some da lista de descoberta.
   */
  const visibleItems = statusesLoaded ? items.filter((item) => !statuses.has(`${item.mediaType}-${item.id}`)) : items;
  const showSkeleton = isLoading || !statusesLoaded;

  return (
    <View style={styles.section}>
      {viewAllHref ? (
        <Pressable style={styles.titleRow} onPress={() => router.push(viewAllHref as never)}>
          <View style={styles.titleGrow}>{title}</View>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      ) : (
        <View style={styles.titleRow}>
          <View style={styles.titleGrow}>{title}</View>
        </View>
      )}

      {showSkeleton ? (
        <View style={styles.row}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {visibleItems.map((item) => (
            <DiscoverCard key={`${item.mediaType}-${item.id}`} item={item} status={statuses.get(`${item.mediaType}-${item.id}`) ?? null} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DiscoverCard({ item, status }: { item: DiscoverItem; status: string | null }) {
  const router = useRouter();
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");

  function handlePress() {
    if (item.mediaType === "series") {
      router.push(`/series/${item.id}`);
      return;
    }
    router.push(`/movies/${item.id}`);
  }

  return (
    /**
     * REMOVIDO (2026-09-02, a pedido — mesmo pedido do web em
     * 2026-09-01, "tire os nomes dos títulos debaixo das capas, o
     * padrão é apenas as capas") — existia um `<Text>` com o título
     * embaixo do pôster aqui; removido pra bater com
     * `DiscoverCard.tsx` do web, que já não mostra título nenhum (só
     * a capa) em NENHUM carrossel do app (Explorar, Perfil).
     *
     * Pôster virou `Glass` (era `View` com `colors.surface` opaco) —
     * mesma troca feita no web na mesma data ("vidro" — borda clara +
     * blur/saturação + fundo com gradiente translúcido, em vez de cor
     * sólida), pro card ficar padronizado com o resto da tela
     * (`GenreChips`/`ExploreTabs`, já em vidro) e com o web.
     */
    <PressableScale style={styles.card} onPress={handlePress}>
      <Glass style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={20} color={colors.muted} />
          </View>
        )}
        <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} initialStatus={status} />
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24) em
  // `titleRow`/`row`. Este componente é usado "cru" (sem container
  // extra) no Explorar, e com margem negativa cancelando o padding do
  // pai em Filmes/Séries (`popularSection`) — nos dois casos, este
  // `paddingHorizontal` é o que efetivamente vira a borda de tela do
  // carrossel; por isso acompanha a mesma padronização pra `spacing.md`
  // (16), igual ao resto da tela.
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  titleGrow: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  card: {
    // CORREÇÃO (auditoria de consistência) — mesma elevação do
    // pôster de `PosterGrid.tsx`: os dois são "pôster de mídia numa
    // lista", não faz sentido um ter profundidade e o outro não.
    // Sombra vai no wrapper de FORA (o de dentro tem `overflow:
    // hidden`, que cortaria a sombra).
    ...elevation.low,
    width: CARD_WIDTH,
    borderRadius: radius.md,
  },
  posterWrapper: {
    position: "relative",
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonCard: {
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
