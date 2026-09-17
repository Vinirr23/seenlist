import { memo } from "react";
import { View, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { PressableScale, Glass } from "@/components/ui";
import { colors, radius, spacing, elevation, scrim } from "@/lib/theme";

const COLUMNS = 3;
const GAP = spacing.sm;

export interface PosterGridProps {
  items: LibraryItem[];
  onPressItem?: (item: LibraryItem) => void;
  /** TASK-116 — cor da barra inferior (categoria do Perfil). Quando presente, substitui a barra de progresso — o web nunca mostra as duas juntas. */
  barColor?: string;
}

/**
 * TASK-091/116/120 — equivalente nativo do `PosterGrid.tsx` do web.
 * Duas variantes, igual ao web: com barra de PROGRESSO (Séries/
 * Filmes, abas principais) ou com barra de COR fixa por categoria
 * (Perfil → Séries/Filmes/Favoritos) — nunca as duas ao mesmo tempo.
 *
 * Correção (TASK-120): a largura do pôster era calculada UMA VEZ, no
 * carregamento do módulo (`Dimensions.get("window")` fora de
 * qualquer componente) — no Android, isso às vezes roda antes da
 * ponte nativa terminar de informar o tamanho real da tela, dando um
 * valor errado e congelado (aparecia como 2 colunas espremidas em
 * vez de 3). `useWindowDimensions()` dentro do componente resolve
 * isso: recalcula a cada render, com o valor certo.
 *
 * Correção (TASK-139): mesmo com a largura certa, a divisão por 3
 * quase sempre dá um número quebrado (ex.: 105.333...). Aparelhos
 * diferentes arredondam esse tipo de fração de jeitos ligeiramente
 * diferentes na hora de desenhar na tela — em alguns, a soma de "3
 * pôsteres + 2 espaços" podia passar por uma margem mínima da
 * largura disponível, empurrando o 3º pôster pra fileira de baixo
 * sozinho (2 colunas visíveis, não 3) — só nesses aparelhos
 * específicos, nunca em outros. `Math.floor()` arredonda pra baixo
 * SEMPRE, garantindo que a soma nunca ultrapassa o espaço
 * disponível, em nenhum aparelho.
 *
 * CORREÇÃO (a pedido — inconsistência real com o web, "organização"
 * reportada com print) — título/ano embaixo do pôster foram
 * removidos daqui. O `PosterGrid.tsx` do web nunca mostra esse texto,
 * em NENHUM contexto (Séries, Filmes, Perfil) — só pôster, e (no
 * Perfil) a barra de cor da categoria. O mobile mostrava sempre,
 * inconsistente com o web em todo lugar que usa este componente.
 */
/**
 * MEMOIZADO (2026-09-17, réplica do fix do Perfil/Séries — "pode
 * replicar nas outras abas") — `onPressItem` precisa vir estável
 * (`useCallback`) de quem chama pra este `memo()` valer alguma coisa;
 * `items`/`barColor` já costumam vir de listas memoizadas no pai.
 */
export const PosterGrid = memo(function PosterGrid({ items, onPressItem, barColor }: PosterGridProps) {
  const { width } = useWindowDimensions();
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — era `spacing.lg * 2` (48, borda de tela dos
  // dois lados); as telas que usam este grid tiveram seu
  // `paddingHorizontal` mudado pra `spacing.md` (16) — sem atualizar
  // aqui, o cálculo ficaria pensando que a área disponível é 16px
  // menor do que realmente é, encolhendo os pôsteres à toa.
  const cardWidth = Math.floor((width - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <PosterGridItem key={`${item.mediaType}-${item.id}`} item={item} onPress={onPressItem} barColor={barColor} cardWidth={cardWidth} />
      ))}
    </View>
  );
});

export const POSTER_GRID_COLUMNS = COLUMNS;
export const POSTER_GRID_GAP = GAP;

/** Calcula a largura do pôster do jeito certo (ver correções TASK-120/139 acima) — reaproveitado pelas versões virtualizadas (`FlatList`/`SectionList`) usadas nas telas "ver tudo" do Perfil, que podem ter centenas de itens. */
export function usePosterCardWidth(): number {
  const { width } = useWindowDimensions();
  // CORREÇÃO (2026-09-03) — mesmo ajuste do `cardWidth` acima (borda
  // de tela padronizada pra `spacing.md`).
  return Math.floor((width - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
}

export const PosterGridItem = memo(function PosterGridItem({
  item,
  onPress,
  barColor,
  cardWidth,
}: {
  item: LibraryItem;
  onPress?: (item: LibraryItem) => void;
  barColor?: string;
  cardWidth: number;
}) {
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");
  const progressPercent =
    !barColor && item.progress && item.progress.totalEpisodes > 0
      ? Math.round((item.progress.watchedEpisodes / item.progress.totalEpisodes) * 100)
      : null;

  return (
    <PressableScale style={[styles.card, { width: cardWidth }]} onPress={() => onPress?.(item)}>
      {/*
        PORTE DO WEB (2026-09-09) — era um retângulo sólido
        (`colors.surface`). No `PosterGrid.tsx` do web a caixa do pôster
        é vidro:
        `rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]`
        sobre `radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16),
        transparent 60%), rgba(255,255,255,0.09)`.
      
        Isso é a receita `medium`, parada por parada — inclusive a
        geometria do brilho (raios 70/80, centro 20%/15%). Ela foi
        derivada exatamente daqui, então não precisou de receita nova.
      */}
      <Glass style={styles.posterWrapper} variant="medium">
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={24} color={colors.muted} />
          </View>
        )}
        {progressPercent !== null && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
        {!!barColor && <View style={[styles.progressTrack, { height: 5, backgroundColor: barColor }]} />}
      </Glass>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  /* `rounded-lg` = 8 no web; era `radius.md` = 10 (a escala do app não tem 8). */
  card: {
    ...elevation.low,
    borderRadius: 8,
  },
  /** Borda e fundo saíram: quem desenha é o `Glass` (receita `medium`). */
  posterWrapper: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: "hidden",
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
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: scrim.overImage,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
});
