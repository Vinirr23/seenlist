import { memo, useCallback, useEffect, useRef } from "react";
import { FlatList, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LibraryStatus, SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { isEpisodeWatchedSync, resolveCarouselEpisodes, type EpisodeRef, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import type { SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { Text, Glass } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type CarouselItem =
  | ({ kind: "episode" } & EpisodeRef)
  | { kind: "caught-up"; badge: Exclude<SeriesCaughtUpBadge, null> };

export function EpisodeCarousel({
  seriesId,
  category,
  seasons,
  watched,
  watchedEpisodeIds,
  onToggleEpisode,
  caughtUpBadge,
  categoryColor,
  backdropUrl,
}: {
  seriesId: number;
  category: LibraryStatus | null | undefined;
  seasons: SeriesDetails["seasons"];
  watched: Set<WatchedEpisodeKey>;
  /** CORREÇÃO (2026-08-26 — "motor resistente") — opcional, ver `isEpisodeWatchedSync` (seriesDetails.ts). */
  watchedEpisodeIds?: Set<number>;
  /** `episodeId` opcional (2026-08-26, "motor resistente" — ver seriesDetails.ts). */
  onToggleEpisode: (seasonNumber: number, episodeNumber: number, episodeId?: number) => void;
  /** TASK-170 (ajuste — a pedido) — o card "mais episódios a caminho"/"série encerrada" mora aqui, não depois das temporadas (diferente do web, decisão explícita pro mobile). */
  caughtUpBadge?: SeriesCaughtUpBadge;
  /**
   * A PEDIDO (2026-09-24 — redesenho do card "Em dia"/"Série encerrada",
   * referência: card "Dutton Ranch" com o backdrop da própria série
   * escurecido atrás do texto, opção "Proposta A" do mockup aprovado
   * pelo usuário) — URL já resolvida (`tmdbImageUrl`) do backdrop da
   * série, com fallback pro pôster; quem chama (`app/series/[id].tsx`)
   * já tem os dois (`series.backdropPath`/`series.posterPath`), então
   * a resolução fica lá, igual ao padrão já usado em
   * `app/week-review.tsx`. Opcional: sem imagem, o card cai pro fundo
   * preto liso (mesma cor de card dos episódios), sem quebrar.
   */
  backdropUrl?: string | null;
  /**
   * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15 — "no web, ao colocar
   * uma série em 'assistir depois' fica da cor certa do status, no
   * mobile não está") — os botões redondos de "assistido" deste
   * carrossel sempre usavam `colors.primary` fixo. Cor da categoria
   * ATUAL da série (`getSeriesCategoryColorByStatus`,
   * `lib/seriesCategories.ts`), calculada uma vez em
   * `app/series/[id].tsx` e repassada pra cá — mesmo padrão do
   * `colorClass` no `EpisodeCarousel.tsx` do web.
   */
  categoryColor?: string;
}) {
  const { t } = useTranslation();
  const episodeItems = resolveCarouselEpisodes(category, seasons, watched);
  /** TASK-170 (ajuste — a pedido, "não é pra tirar a rolagem, é pra incluir no final") — mesma FlatList horizontal de sempre, só com um card a mais no final quando a série está em dia/encerrada, no mesmo tamanho dos cards de episódio. */
  const data: CarouselItem[] = [
    ...episodeItems.map((item) => ({ kind: "episode" as const, ...item })),
    ...(caughtUpBadge ? [{ kind: "caught-up" as const, badge: caughtUpBadge }] : []),
  ];
  const listRef = useRef<FlatList<CarouselItem>>(null);
  const renderedSeriesId = useRef<number | null>(null);
  const hasUserScrolled = useRef(false);

  // Ao trocar de série, reseta o controle de "usuário já mexeu na lista manualmente".
  if (renderedSeriesId.current !== seriesId) {
    renderedSeriesId.current = seriesId;
    hasUserScrolled.current = false;
  }

  /**
   * TASK-157/158/159/160/161 (correção definitiva — instável) — ao
   * abrir a tela, a lista horizontal de episódios já abre
   * posicionada no primeiro episódio ainda não marcado como
   * assistido, em vez de sempre começar do episódio 1.
   *
   * Causa raiz de verdade, confirmada com dado real do banco
   * (TASK-161): `onContentSizeChange` só dispara quando o TAMANHO da
   * lista muda — e o tamanho não depende de quais episódios estão
   * marcados como assistidos, só de quantos episódios existem. Se os
   * dados de "assistido" (`watched`, que vem de uma busca separada,
   * assíncrona) ainda não tinham chegado no instante em que a lista
   * terminou de desenhar, a tentativa de rolagem via
   * `onContentSizeChange` calculava a posição com `watched` ainda
   * VAZIO — e como o tamanho da lista não muda depois que os dados
   * de verdade chegam, nunca disparava de novo.
   *
   * Agora: a mesma função de tentativa (`attemptScroll`) é chamada
   * tanto quando o LAYOUT fica pronto (`onContentSizeChange`) quanto
   * toda vez que `watched` muda de verdade (novo resultado da busca)
   * — cobre os dois lados da corrida, não importa qual dos dois
   * chega primeiro.
   */
  function attemptScroll() {
    if (episodeItems.length === 0) return;
    const firstUnwatchedIndex = episodeItems.findIndex(
      ({ seasonNumber, episode }) => !isEpisodeWatchedSync(watched, seasonNumber, episode.episodeNumber, episode.id, watchedEpisodeIds)
    );

    // TASK-173 (achado real, a pedido — "a rolagem recua" ao marcar o
    // último episódio) — quando não sobra episódio não assistido, a
    // rolagem pro card final SEMPRE acontece, mesmo que
    // `hasUserScrolled` já esteja true. Esse guard existe pra não
    // brigar com o usuário navegando livremente pelo carrossel — mas
    // no caso mais comum de todos, marcar o ÚLTIMO episódio exige
    // rolar até ele primeiro, o que já deixava `hasUserScrolled` true
    // e cancelava a rolagem final logo depois, bem na hora que ela
    // mais fazia sentido (mostrar o card de recompensa). Terminar a
    // série é um momento deliberado — vale a pena rolar de qualquer
    // jeito, diferente de "pular pro primeiro não assistido" (que
    // continua respeitando o usuário navegando por conta própria).
    if (firstUnwatchedIndex === -1) {
      if (data.length > 1) {
        listRef.current?.scrollToOffset({ offset: (data.length - 1) * (CARD_WIDTH + GAP), animated: true });
      }
      return;
    }

    if (hasUserScrolled.current) return;
    if (firstUnwatchedIndex > 0) {
      listRef.current?.scrollToOffset({ offset: firstUnwatchedIndex * (CARD_WIDTH + GAP), animated: false });
    }
  }

  useEffect(() => {
    attemptScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, watched, watchedEpisodeIds]);

  if (data.length === 0) return null;

  return (
    <View>
      {/*
        PORTE DO WEB (2026-09-09) — o título era `variant="subtitle"`
        (18px/600). No `EpisodeCarousel.tsx` do web ele é
        `mb-2 text-sm font-medium` = 14px/500, igualzinho aos títulos
        de "Trailer"/"Elenco"/"Galeria" da aba Sobre.
      */}
      <Text style={styles.title}>{t("seriesHome.continueWatchingCarousel")}</Text>
      {/**
       * TASK-162 (a pedido — desempenho em séries com muitos
       * episódios) — antes usava `ScrollView` + `.map()`, que desenha
       * TODOS os cards de uma vez, não importa quantos episódios a
       * série tenha (testado com uma série de 89 episódios — 89 cards
       * montados na memória de uma vez só, mesmo só uns 3-4
       * aparecendo na tela). `FlatList` só desenha o que está perto
       * da área visível (virtualização) — `getItemLayout` (todo card
       * tem a mesma largura) permite calcular a posição de rolagem
       * automática sem precisar medir nada, então a correção de
       * abrir já no episódio certo continua funcionando igual.
       */}
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) =>
          item.kind === "episode" ? `${item.seasonNumber}-${item.episode.episodeNumber}` : `caught-up-${index}`
        }
        style={styles.list}
        contentContainerStyle={styles.row}
        getItemLayout={(_, index) => ({ length: CARD_WIDTH + GAP, offset: (CARD_WIDTH + GAP) * index, index })}
        initialNumToRender={6}
        windowSize={5}
        maxToRenderPerBatch={8}
        onContentSizeChange={attemptScroll}
        onScrollBeginDrag={() => {
          hasUserScrolled.current = true;
        }}
        renderItem={({ item }) =>
          item.kind === "episode" ? (
            <EpisodeCarouselCard
              seriesId={seriesId}
              seasonNumber={item.seasonNumber}
              episodeNumber={item.episode.episodeNumber}
              episodeId={item.episode.id}
              episodeName={item.episode.name}
              stillPath={item.episode.stillPath}
              isWatched={isEpisodeWatchedSync(watched, item.seasonNumber, item.episode.episodeNumber, item.episode.id, watchedEpisodeIds)}
              onToggleEpisode={onToggleEpisode}
              categoryColor={categoryColor}
            />
          ) : (
            <CaughtUpMiniCard badge={item.badge} backdropUrl={backdropUrl} />
          )
        }
      />
    </View>
  );
}

/*
 * CORREÇÃO DE CAUSA RAIZ (2026-09-17, a pedido — "desmarcar e marcar
 * episódio na tela de detalhes ainda está lento", medido de verdade
 * com `performance.now()` — ver o diagnóstico entregue ao usuário) —
 * o próprio React Native denunciou o culpado sozinho, sem precisar
 * adivinhar: `VirtualizedList: You have a large list that is slow to
 * update`, com `dt` de mais de 500ms (chegou a 2717ms num caso). Esta
 * é a `FlatList` horizontal do carrossel de episódios, a ÚNICA lista
 * pesada da tela que nunca tinha ganho a memoização que
 * `SeasonAccordion.tsx` já tem (`SeasonEpisodeRow`, `memo`) — cada
 * toque em QUALQUER episódio (do carrossel OU do acordeão, já que os
 * dois lêem o mesmo `watched`) recriava a árvore inteira do carrossel
 * inline no `.map()`/`renderItem`, e o React redesenhava TODOS os
 * cards visíveis de novo, não só o tocado.
 *
 * Duas causas, as duas resolvidas juntas (uma sozinha não bastaria,
 * mesma lição do `SeasonAccordion`/`watchedRef` — ver comentário
 * grande em `useSeriesDetails.ts`):
 *
 * 1. O card recebia o objeto `episode` INTEIRO como prop — vindo de
 *    `resolveCarouselEpisodes`, que monta um objeto/array NOVO a cada
 *    render (mesmo quando o conteúdo do episódio não mudou nada) — um
 *    `React.memo` comparando esse objeto por referência nunca bateria
 *    igual, então nunca pularia o re-render. Agora os campos que
 *    realmente importam (`episodeNumber`, `episodeId`, `episodeName`,
 *    `stillPath`) vêm como props PRIMITIVAS — aí sim o `memo` compara
 *    de verdade.
 * 2. `onToggle` era uma função NOVA por item a cada render do pai
 *    (`() => onToggleEpisode(...)`, criada dentro do `renderItem`) —
 *    invalidava o `memo` de todo card de novo, mesmo com o item #1
 *    corrigido. Agora quem recebe é `onToggleEpisode` direto (a
 *    própria `toggle`, já estável — ver `watchedRef` em
 *    `useSeriesDetails.ts`) e o card monta sua PRÓPRIA função estável
 *    por dentro, via `useCallback` com dependências primitivas.
 *
 * Resultado: só o card do episódio TOCADO muda de prop (`isWatched`)
 * e só ele re-renderiza — os outros, mesmo continuando montados pela
 * virtualização da `FlatList`, ficam intocados.
 */
const EpisodeCarouselCard = memo(function EpisodeCarouselCard({
  seriesId,
  seasonNumber,
  episodeNumber,
  episodeId,
  episodeName,
  stillPath,
  isWatched,
  onToggleEpisode,
  categoryColor,
}: {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeId?: number;
  episodeName: string;
  stillPath: string | null;
  isWatched: boolean;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number, episodeId?: number) => void;
  categoryColor?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const stillUrl = tmdbImageUrl(stillPath, "w300"); // `w300` como no web — `w185` ficava borrado num card de 144dp (378px reais)
  /**
   * REDESENHO (2026-09-24, a pedido — "quero que faça a mesma coisa,
   * deixe igual a referencia" — mockup aprovado, ver decisões abaixo)
   * — código "T09 | E24" no lugar de "S09E24": a letra agora vem do
   * idioma ativo (`episode.seasonAbbrev`/`episode.episodeAbbrev`),
   * porque o usuário foi explícito: "S se refere a Season que é em
   * inglês T é temporada que é em português, então isso a linguagem
   * que deve definir." O separador " | " também vem da referência.
   */
  const code = `${t("episode.seasonAbbrev")}${String(seasonNumber).padStart(2, "0")} | ${t("episode.episodeAbbrev")}${String(episodeNumber).padStart(2, "0")}`;

  const handleOpen = useCallback(
    () => router.push(`/episodes/${seriesId}/${seasonNumber}/${episodeNumber}`),
    [router, seriesId, seasonNumber, episodeNumber]
  );
  const handleToggle = useCallback(
    () => onToggleEpisode(seasonNumber, episodeNumber, episodeId),
    [onToggleEpisode, seasonNumber, episodeNumber, episodeId]
  );

  return (
    /*
     * CORREÇÃO DE CAUSA RAIZ (2026-09-24, print real — "você deixou os
     * cards preto, é pra manter o padrão do app, glass") — na primeira
     * versão deste redesenho o card virou um retângulo preto SÓLIDO
     * (`colors.background`), perdendo o efeito de vidro que TODO card
     * equivalente no app usa (`SeasonAccordion.tsx` → `Glass
     * variant="light"`, `ContinueWatchingListRow.tsx` → `Glass
     * variant="card"`, o próprio `stillWrapper` daqui antes do
     * redesenho → `Glass variant="medium"`). Raiz: troquei a `View`
     * de fora por uma `View` lisa com cor chapada, em vez de manter o
     * card em `Glass` — mesma família de bug do `OptionSheet.tsx`
     * (sheet flat em vez de vidro, sessão anterior). Fix: o card
     * inteiro agora é `<Glass variant="card">` — a mesma receita do
     * `ContinueWatchingListRow.tsx` (card horizontal mais parecido
     * que já existe no app), no lugar da `View` com fundo chapado.
     */
    <Glass style={styles.card} variant="card">
      {/*
        O botão de "assistido" fica FORA do `Pressable` que abre o
        episódio (mesmo motivo de sempre neste app — dois touchables
        aninhados brigam pelo toque; era assim no layout empilhado
        também, só que numa `View` embaixo em vez de do lado).
      */}
      <Pressable style={styles.cardRow} onPress={handleOpen}>
        <View style={styles.stillWrapper}>
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.still} contentFit="cover" />
          ) : (
            <View style={styles.stillEmpty}>
              <MaterialCommunityIcons name="movie-open-outline" size={20} color={ICONE_VAZIO} />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.code}>{code}</Text>
          <Text numberOfLines={2} variant="muted" style={styles.name}>
            {episodeName}
          </Text>
        </View>
      </Pressable>
      <View style={styles.checkSlot}>
        <EpisodeWatchedButton watched={isWatched} onPress={handleToggle} size="sm" color={categoryColor} pulseOnConfirm />
      </View>
    </Glass>
  );
});

/**
 * REDESENHO (2026-09-24, a pedido — referência "Dutton Ranch": card
 * com o backdrop da própria série escurecido atrás do texto, título
 * grande e colorido + subtítulo cinza embaixo, tudo centralizado) —
 * antes era uma caixa `stillWrapper` tintada com ícone (`award`/`zap`)
 * + uma linha de texto embaixo, mesmo tamanho do card de episódio
 * empilhado. Layout novo: card do mesmo tamanho/altura do card de
 * episódio horizontal (pra continuar parte da mesma fileira), com a
 * imagem preenchendo o card inteiro (não só uma faixa) e um degradê
 * escurecendo de cima pra baixo (`LinearGradient`, mesma lib já usada
 * em `ContinueWatchingListRow.tsx`) pra garantir contraste do texto —
 * igual à referência. `backdropUrl` é opcional: sem imagem, cai pro
 * mesmo preto sólido do card de episódio, sem quebrar layout.
 *
 * Cor do título: `colors.primary` (âmbar, já o token do app) pra "em
 * dia" e `colors.success` (verde) pra "encerrada" — mantém a mesma
 * associação de cor que a caixa tintada antiga já usava
 * (`miniCardOngoing` azulado/`miniCardEnded` esverdeado), só que sem
 * inventar azul novo (o app não usa azul como cor de status em nenhum
 * outro lugar).
 */
function CaughtUpMiniCard({ badge, backdropUrl }: { badge: Exclude<SeriesCaughtUpBadge, null>; backdropUrl?: string | null }) {
  const { t } = useTranslation();
  const isEnded = badge === "ended";
  return (
    /*
     * CORREÇÃO DE CAUSA RAIZ #2 (2026-09-25, print real — "esse card
     * especial de 'encerrada' no android ficou certinho, no ios ficou
     * bugado") — a correção anterior (envolver o card INTEIRO num
     * `<Glass variant="card">` por cima da foto) causou uma REGRESSÃO
     * só no iOS, não encontrada antes por só ter sido conferida no
     * Android.
     *
     * Causa raiz de verdade, achada em `Glass.tsx` (não suposição): no
     * Android, `semBlurNoAndroid` (linha ~400) desativa o desfoque de
     * VERDADE pra toda variante que não seja `"dock"` — `variant="card"`
     * cai nesse caso, então no Android o `Glass` NUNCA borra nada, só
     * aplica uma tinta translúcida por cima; por isso a foto continuava
     * nítida por baixo, o resultado "certinho" do Android era um
     * ACIDENTE dessa otimização de performance, não o `Glass`
     * funcionando "direito". No iOS, o comentário no topo do arquivo é
     * explícito — "o `BlurView` do iOS é o `UIVisualEffectView` nativo
     * da Apple... nunca implicado em nenhuma queixa de performance" —
     * ou seja, lá o desfoque é SEMPRE de verdade, pra qualquer variante.
     * Um `Glass` cobrindo o card INTEIRO borra a foto INTEIRA de
     * verdade no iOS, virando a mancha lisa do print.
     *
     * Onde o app já resolve exatamente este caso (foto de fundo +
     * texto por cima, sem borrar a foto inteira) é o `SeriesHeader.tsx`
     * — lá o `Glass` só embrulha os DOIS BOTÕES pequenos (círculos),
     * nunca a foto inteira; o título fica direto sobre a
     * imagem+degradê, sem `Glass`. Fix: mesmo padrão aqui — a foto e o
     * degradê ficam como fundo direto (sem `GlassTargetProvider`/
     * `Glass`, que só fariam sentido se algum elemento pequeno por cima
     * precisasse desfocar a foto — não é o caso), e o texto fica por
     * cima só com a cor sólida da categoria, igual à referência
     * "Dutton Ranch" (que também não tem vidro nesse texto).
     */
    <View style={[styles.card, styles.caughtUpCard]}>
      {backdropUrl ? (
        <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.75)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.caughtUpTextBox}>
        <Text style={[styles.caughtUpTitle, { color: isEnded ? colors.success : colors.primary }]}>
          {isEnded ? t("episode.seriesEnded") : t("episode.upToDateTitle")}
        </Text>
        <Text numberOfLines={2} variant="muted" style={styles.caughtUpSubtitle}>
          {isEnded ? t("episode.seriesEndedSubtitle") : t("episode.upToDateSubtitle")}
        </Text>
      </View>
    </View>
  );
}

/**
 * REDESENHO (2026-09-24) — card virou horizontal (imagem + texto +
 * check lado a lado, referência: card "T09 | E01"), então a largura
 * cresceu de 144 (só o suficiente pra a imagem 16:9) pra caber o
 * texto e o check do lado. Altura fixa nova (`CARD_HEIGHT`) porque o
 * card não tem mais altura "automática" (empilhado = imagem +
 * texto); agora os dois lados (imagem quadrada + texto) precisam da
 * mesma altura do card inteiro.
 */
/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-25, print real — "no android o card
 * não ficou bom, temporada e episódio ficou em duas linhas") — o
 * código ("T02 | E01") quebrava linha no Android especificamente.
 * Causa raiz medida, não suposta: a coluna de texto (`info`) só tinha
 * ~96px de largura livre (248 do card − 84 da miniatura − 44 do slot
 * do check − 24 de padding horizontal do `info`), e a fonte
 * monoespaçada do SISTAMA no Android (`FONTE_MONO` cai em
 * `Platform.select({ default: "monospace" })` pra qualquer plataforma
 * que não seja iOS — ver comentário original na constante) é mais
 * larga que a `Menlo` do iOS pro mesmo texto/tamanho — por isso só
 * quebrava no Android, nunca visto no iOS. Fix: aumentei a largura
 * livre da coluna (mais CARD_WIDTH, menos padding no `info`, slot do
 * check mais enxuto — o botão em si é só 28px, `size="sm"`) e travei
 * o código numa linha só (`numberOfLines={1}` no `<Text>`) como rede
 * de segurança, pra nunca mais quebrar mesmo se algum idioma tiver
 * abreviação maior que uma letra.
 */
const CARD_WIDTH = 268;
const CARD_HEIGHT = 84;
const STILL_SIZE = CARD_HEIGHT;
/** `gap-3` = 12 no web; aqui era `spacing.sm` = 8. */
const GAP = 12;
/** `text-muted/40` — o `muted` (#8C93A8) a 40%. */
const ICONE_VAZIO = "rgba(140,147,168,0.4)";
/** `-mx-4 ... px-4` — a fileira sangra até a borda da tela e o recuo volta por dentro, então o primeiro card encosta na margem e os seguintes somem na borda ao rolar. */
const SANGRIA = spacing.md;

const styles = StyleSheet.create({
  /** `mb-2 text-sm font-medium text-text`. */
  title: {
    marginBottom: 8,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  list: {
    marginHorizontal: -SANGRIA,
  },
  row: {
    gap: GAP,
    paddingHorizontal: SANGRIA,
    paddingBottom: 4, // `pb-1`
  },
  /**
   * CORREÇÃO (2026-09-24 — "mantenha o padrão do app, glass") — sem
   * `backgroundColor` chapado: a cor/tinta do card vem inteiramente da
   * receita `card` do `Glass` (ver `lib/theme.ts`, `glassVariants.card`)
   * que agora envolve esta `View` (ela virou o `style` do `<Glass>`,
   * não mais de uma `View` lisa). `flexDirection: "row"` pra imagem +
   * texto + check ficarem lado a lado; `overflow: "hidden"` corta o
   * blur/imagem nos cantos arredondados.
   */
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  /** A parte clicável (abre o episódio): imagem + código/nome. O check fica FORA (ver comentário em `EpisodeCarouselCard`). */
  cardRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  stillWrapper: {
    width: STILL_SIZE,
    height: STILL_SIZE,
    flexShrink: 0,
  },
  stillEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  still: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    gap: 4,
  },
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-25, print real — "o '|' tá muito
   * afastado, deixa igual home/séries mais junto") — este card e o
   * `ContinueWatchingListRow.tsx` (Home) montam o MESMO texto
   * (`"T01 | E19"`, mesmo `" | "` literal), mas aqui o "|" aparecia bem
   * mais separado das letras. Causa raiz, achada comparando os dois
   * estilos lado a lado (não suposição): este `code` usava
   * `fontFamily: FONTE_MONO` (monoespaçada — cada caractere, inclusive
   * o espaço ao redor do "|", ocupa a MESMA largura fixa, alargando
   * artificialmente o separador) + `letterSpacing: 0.2` por cima. O
   * `code` do Home (`ContinueWatchingListRow.tsx`, linha ~639) não tem
   * nenhum dos dois — é só texto normal em negrito. Fix: padronizado
   * com o Home, removendo a fonte monoespaçada e o `letterSpacing`
   * (a constante `FONTE_MONO` não tem mais nenhum uso depois disso).
   */
  code: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  /** Nome do episódio agora pode quebrar em até 2 linhas (era 1 linha truncada) — a referência mostra o título em 2 linhas ao lado do código. */
  name: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
  },
  /** Espaço fixo pro botão de assistido, centralizado na altura do card — igual à posição do check na referência. */
  checkSlot: {
    width: 38,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  /**
   * Card "Em dia"/"Série encerrada" — mesma altura/formato do card de
   * episódio, mas sem `Glass` (ver comentário grande em
   * `CaughtUpMiniCard` — causa raiz #2, regressão só no iOS): a foto
   * de fundo (`Image`, absoluta) e o degradê (`LinearGradient`,
   * absoluto) ficam direto dentro desta `View`, sem nenhum `Glass` por
   * cima cobrindo a foto inteira. `position: relative` pra os dois
   * absolutos se ancorarem nela; `alignItems`/`justifyContent: center`
   * centraliza o texto por cima.
   */
  caughtUpCard: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    /** Fallback pra quando `backdropUrl` vem `null` (série sem imagem no TMDB) — sem isso o card ficaria transparente, mostrando o que tiver atrás na tela. */
    backgroundColor: colors.background,
  },
  caughtUpTextBox: {
    paddingHorizontal: 14,
    alignItems: "center",
  },
  caughtUpTitle: {
    fontSize: fontSize.md,
    fontWeight: "800",
    textAlign: "center",
  },
  caughtUpSubtitle: {
    marginTop: 2,
    fontSize: fontSize.xs,
    fontWeight: "500",
    textAlign: "center",
  },
});
