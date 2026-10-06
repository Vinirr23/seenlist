import { useState } from "react";
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { isMergedActivityItem, type ActivityGroup, type MergedActivityItem } from "@/lib/useFeedEntries";
import type { ActivityItem, ActivityType } from "@/lib/activityFeed";
import { ActivityTypeChip } from "./ActivityCard";
import { tmdbImageUrl } from "@/lib/library";
import { Text, PressableScale } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useNow } from "@/lib/useNow";
import { formatRelativeTime } from "@/lib/relativeTime";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const POSTER_DISPLAY_LIMIT = 3;
// Grade de referência: SEMPRE 4 colunas (até 3 pôsteres + a pastilha
// "+N"), mesmo quando o grupo tem menos itens que isso — ver comentário
// grande de `tileSize`, abaixo, pra causa raiz completa (2026-10-02,
// 2º report: "grupos de 2 títulos com pôsteres gigantes").
const GRID_COLUMNS = 4;
// Mesma proporção usada nos pôsteres desde sempre (9 rodadas de ajuste,
// ver histórico em `posterWrapBase`) — 91/132.
const POSTER_ASPECT_RATIO = 91 / 132;

/**
 * ACTIVITY GROUP CARD (2026-10-01, reportado — print mostrando a
 * mesma pessoa ("Camila") dominando o Feed inteiro em poucos minutos:
 * 5 atividades automáticas seguidas). Agrupamento de verdade acontece
 * em `lib/useFeedEntries.ts` (`groupConsecutiveActivity` — mesmo
 * usuário, até 15 min de diferença entre ações consecutivas); este
 * componente só decide COMO mostrar um grupo já pronto.
 *
 * DOIS LAYOUTS, igual ao pedido:
 *   - Mesmo tipo de ação em todos os itens do grupo → frase
 *     específica ("terminou N títulos"/"adicionou N à lista"/"avaliou
 *     N títulos") + ícone do tipo, igual ao verbo dos cards normais.
 *   - Tipos diferentes misturados (ex.: 3 "completed" + 2
 *     "watchlist", igual ao print original) → resumo compacto
 *     ("teve bastante atividade") com uma pílula por tipo presente
 *     ("✓ 3 concluídos", "🔖 2 adicionados", "★ 1 avaliado").
 *
 * Em ambos: até `POSTER_DISPLAY_LIMIT` pôsteres lado a lado (toque em
 * cada um leva pro detalhe daquele título específico), com "+N" se
 * houver mais itens no grupo do que cabe.
 *
 * "+N" EXPANDE A LISTA INLINE (2026-10-01, a pedido — antes era só
 * decorativo, tocar não fazia nada) — toque troca `expanded` pra
 * `true` e mostra TODOS os itens do grupo nesta mesma linha, que
 * passa a quebrar (`flexWrap: "wrap"`) em vez de cortar. Com o grupo
 * expandido, o pedaço que antes era o "+N" vira um tile "Ver menos"
 * (mesmo tamanho dos pôsteres) que volta `expanded` pra `false` — a
 * pedido explícito, depois de reportado que não tinha como recolher
 * de novo.
 *
 * SEM botão de watchlist aqui (decisão não confirmada com o usuário,
 * só a mais razoável dentre as não especificadas — um grupo tem N
 * títulos diferentes, um botão só por card não faria sentido sem
 * virar N botões pequenos, o que voltaria a ser ruído visual. Avisar
 * se quiser outra solução.) — pra adicionar à lista um título
 * específico do grupo, abre o próprio título (toque no pôster).
 *
 * SEM Hero aqui de propósito — um item dentro de um grupo NUNCA passa
 * pelo throttle de Hero (`lib/useFeedEntries.ts`, `applyHeroThrottle`
 * só examina `kind: "activity"`, nunca `"activityGroup"`): pedido
 * explícito — "não usaria Hero card quando isso acontecer... Hero
 * deveria aparecer quando uma atividade ISOLADA merece destaque".
 *
 * PÔSTER DUPLICADO QUANDO 1 TÍTULO TEM 2+ AÇÕES (2026-10-06, bug real
 * reportado com print — "interagiu com 4 títulos" mostrando 6
 * pôsteres, "Legítimo Rei" e "Cruzada" repetidos 2x cada) — CAUSA
 * RAIZ: este componente desenhava 1 tile por item CRU de `group.items`,
 * sem checar se 2 itens apontavam pro mesmo título. Corrigido na
 * origem: `lib/useFeedEntries.ts` (`collapseSameMediaItems`, chamada
 * por `groupConsecutiveActivity`) já funde títulos repetidos dentro do
 * cluster ANTES de chegar aqui — `group.items` agora é uma mistura de
 * `ActivityItem` (1 ação só) e `MergedActivityItem` (2+ ações no MESMO
 * título, igual ao usado por `activityMulti`), sempre 1 entrada por
 * título. Este componente só precisa saber desenhar as DUAS formas —
 * `isMergedActivityItem` (type guard) decide qual é qual em cada tile;
 * um `MergedActivityItem` ganha uma tarja de ícones (1 por ação única)
 * sobreposta na base do pôster, pra não perder a informação de "fez
 * mais de uma coisa com esse título" que o agrupamento por tipo único
 * já preservava.
 */
export function ActivityGroupCard({ group }: { group: ActivityGroup }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  // `!` — `ActivityGroup` só existe pra um cluster de 2+ itens
  // (`groupConsecutiveActivity`/`collapseSameMediaItems`, em
  // `lib/useFeedEntries.ts`); `group.items` nunca é vazio. Achado real
  // ao rodar `tsc --noEmit` de verdade no projeto (`noUncheckedIndexedAccess`),
  // mesmo idioma já usado em `lib/anilist.ts:151`/
  // `ProfileRecommendationsPreview.tsx:143`.
  const head = group.items[0]!;
  const [expanded, setExpanded] = useState(false);
  // MEDIDO, NÃO ADIVINHADO, e agora ÚNICO PRA TUDO (2026-10-02 — 2
  // reports seguidos sobre o mesmo cálculo).
  //
  // 1º report: "não dá pra deixar a grade expandida do mesmo tamanho
  // da grade com 3 posts e um vazio?" — corrigido medindo a largura
  // REAL da `postersRow` (`onLayout`) e dividindo em `GRID_COLUMNS`
  // colunas, só pro modo expandido; o recolhido continuou usando
  // `flex: 1` (dividia a largura pelos tiles REALMENTE presentes).
  //
  // 2º report, CAUSA RAIZ do 1º fix: "grupos de 2 títulos com
  // pôsteres gigantes, maiores que o Hero" — o `flex: 1` do recolhido
  // divide a largura disponível pelos tiles que EXISTEM na linha, não
  // por um número fixo de colunas. Com 3+ itens, sempre há 3 ou 4
  // tiles (pôsteres + "+N") disputando a largura, resultado compacto.
  // Com só 1-2 itens, não há pastilha "+N" (`extraCount` é 0), então
  // sobram só 1-2 tiles pra dividir a linha INTEIRA entre si — cada um
  // vira ~50-100% da largura da tela, bem maior que o Hero.
  //
  // Correção definitiva: todo tile (recolhido OU expandido, pôster,
  // "+N" ou "Ver menos") usa o MESMO tamanho MEDIDO abaixo — a largura
  // real da linha dividida sempre por `GRID_COLUMNS` (4), nunca pelo
  // número de itens presentes. Um grupo de 2 fica com 2 tiles do
  // tamanho "padrão" (igual ao de um grupo de 3+) e sobra espaço vazio
  // na linha — exatamente o pedido ("padronizaria os pôsteres... pra
  // algo próximo do tamanho usado nos grupos de 3, inclusive com 2").
  // Também elimina de vez o próprio `flex: 1` do recolhido, raiz do
  // bug — sem mais nenhuma troca fixo↔flexível entre os modos, então o
  // hack de incluir o modo na `key` (ver abaixo) deixou de ser
  // necessário, mas continua por segurança/zero custo.
  const [rowWidth, setRowWidth] = useState(0);

  function handleRowLayout(e: LayoutChangeEvent) {
    setRowWidth(e.nativeEvent.layout.width);
  }

  const tileWidth = rowWidth > 0 ? (rowWidth - spacing.xs * (GRID_COLUMNS - 1)) / GRID_COLUMNS : null;
  // Antes da 1ª medição (só no 1º frame): fallback conservador, nunca
  // chega a aparecer na prática (`postersRow` sempre mede on-mount).
  const tileSize = tileWidth ? { width: tileWidth, height: tileWidth / POSTER_ASPECT_RATIO } : { width: 76, height: 110 };

  function handlePressMore(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    setExpanded(true);
  }

  function handlePressLess(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    setExpanded(false);
  }

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${head.userUsername}`);
  }

  function handlePressItem(item: ActivityItem | MergedActivityItem) {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  // Ações de 1 item do grid — 1 só (`ActivityItem`) ou várias, já
  // deduplicadas (`MergedActivityItem.actions`, ver `isMergedActivityItem`
  // no topo do arquivo) — usado tanto pra `counts` (abaixo) quanto pra
  // desenhar a tarja de ícones de um tile fundido.
  function actionsOf(item: ActivityItem | MergedActivityItem): ActivityType[] {
    return isMergedActivityItem(item) ? item.actions : [item.activityType];
  }

  // `allSameType` exige, além do mesmo tipo em todo item, que NENHUM
  // item seja um `MergedActivityItem` — um título com 2+ ações já é por
  // definição "misto" (ver comentário grande do componente, acima); não
  // faz sentido entrar no resumo "mesmo tipo em todos" (frase +
  // contagem de TÍTULOS) junto de itens de 1 ação só.
  const hasMergedItem = group.items.some(isMergedActivityItem);
  const types = new Set(group.items.flatMap(actionsOf));
  const allSameType = !hasMergedItem && types.size === 1;
  const visiblePosters = expanded ? group.items : group.items.slice(0, POSTER_DISPLAY_LIMIT);
  const extraCount = group.items.length - visiblePosters.length;
  const canCollapse = expanded && group.items.length > POSTER_DISPLAY_LIMIT;

  // Tally de AÇÕES (não de títulos) — um `MergedActivityItem` contribui
  // 1x pra cada tipo único entre suas `actions` (ex.: "terminou +
  // avaliou" soma 1 em `completed` E 1 em `rated`); mesma semântica de
  // antes da correção de 2026-10-06, só agora olhando `actionsOf(item)`
  // em vez de `item.activityType` direto, pra não quebrar com itens
  // fundidos. `group.items.length` (usado no cabeçalho/contador "N
  // títulos", mais abaixo) já está correto desde a correção — é a
  // contagem de ENTRADAS, e entradas agora são sempre 1 por título.
  const counts = {
    completed: group.items.filter((i) => actionsOf(i).includes("completed")).length,
    watchlist: group.items.filter((i) => actionsOf(i).includes("watchlist")).length,
    rated: group.items.filter((i) => actionsOf(i).includes("rated")).length,
  };

  // Tipo único do resumo "mesmo tipo em todos" — lido de `types` (já
  // computado via `actionsOf`, cobre os 2 formatos de item), não mais
  // de `head.activityType` direto: `head` pode ser um
  // `MergedActivityItem` em outros ramos (quando `allSameType` é
  // `false`), que não tem esse campo — só é lido aqui, guardado por
  // `allSameType` (que já garante `types.size === 1` e nenhum item
  // fundido), então sempre existe quando usado.
  const singleActivityType: ActivityType | null = allSameType ? [...types][0] ?? null : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable style={styles.header} onPress={handlePressUser}>
          <Avatar uri={head.userAvatarUrl} name={head.userName} style={styles.avatar} textStyle={styles.avatarInitials} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.authorName}>
                {head.userName}
              </Text>
              <VerifiedBadge tier={head.userVerifiedTier} size={fontSize.sm} />
              <Text numberOfLines={1} variant="muted" style={styles.meta}>
                {formatRelativeTime(head.createdAt, now, locale, t("feed.justNow"))}
              </Text>
            </View>
            {allSameType && singleActivityType ? (
              <View style={styles.verbRow}>
                {/* PASTILHA COLORIDA POR TIPO (2026-10-06) — ver comentário grande em `ActivityTypeChip`, `ActivityCard.tsx`. */}
                <ActivityTypeChip type={singleActivityType} size={16} iconSize={9} />
                <Text variant="muted" style={[styles.verb, { marginLeft: 2 }]}>
                  {t(
                    singleActivityType === "watchlist"
                      ? "feed.activityGroupWatchlist"
                      : singleActivityType === "completed"
                        ? "feed.activityGroupCompleted"
                        : "feed.activityGroupRated",
                    { count: group.items.length }
                  )}
                </Text>
              </View>
            ) : (
              <Text variant="muted" style={styles.verb}>
                {t("feed.activityGroupMixedVerb", { count: group.items.length })}
              </Text>
            )}
          </View>
        </Pressable>
      </View>

      {!allSameType && (
        <View style={styles.pillsRow}>
          {/* PASTILHA COLORIDA POR TIPO (2026-10-06) — ver comentário grande em `ActivityTypeChip`, `ActivityCard.tsx`. */}
          {counts.completed > 0 && (
            <View style={styles.pill}>
              <ActivityTypeChip type="completed" size={14} iconSize={8} />
              <Text style={styles.pillText}>{t("feed.activityGroupMixedCompleted", { count: counts.completed })}</Text>
            </View>
          )}
          {counts.watchlist > 0 && (
            <View style={styles.pill}>
              <ActivityTypeChip type="watchlist" size={14} iconSize={8} />
              <Text style={styles.pillText}>{t("feed.activityGroupMixedWatchlist", { count: counts.watchlist })}</Text>
            </View>
          )}
          {counts.rated > 0 && (
            <View style={styles.pill}>
              <ActivityTypeChip type="rated" size={14} iconSize={8} />
              <Text style={styles.pillText}>{t("feed.activityGroupMixedRated", { count: counts.rated })}</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.postersRow, expanded && styles.postersRowExpanded]} onLayout={handleRowLayout}>
        {visiblePosters.map((item) => {
          const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w185") : null;
          return (
            // FEEDBACK DE TOQUE (2026-10-01, a pedido — achado da
            // auditoria UI/UX: pôster clicável sem nenhum retorno
            // visual ao toque) — `PressableScale` em vez de
            // `Pressable` puro; `posterInner` carrega
            // `alignItems`/`justifyContent` (centraliza o ícone de
            // fallback) porque o `Animated.View` interno do
            // `PressableScale` não herda isso do `style` passado (só
            // `flex: 1` — mesmo padrão já usado em
            // `EpisodeWatchedButton.tsx`/`checkWrap`).
            //
            // TAMANHO ÚNICO (recolhido OU expandido — ver comentário
            // grande de `tileSize`, no topo do componente, pra todo o
            // histórico/causa raiz).
            //
            // `key` inclui o modo (2026-10-02, bug real corrigido na
            // época — "o card vazio fica bugado depois de
            // expandir/recolher", quando o recolhido ainda usava
            // `flex: 1` e o expandido tamanho fixo medido; a troca
            // fixo↔flexível no mesmo nó nativo confundia o layout do
            // React Native). Hoje os dois modos usam o MESMO mecanismo
            // de tamanho, então o bug não pode mais acontecer — a `key`
            // ficou só como segurança de zero custo, não removida.
            <PressableScale
              key={`${item.id}-${expanded ? "expanded" : "collapsed"}`}
              style={[styles.posterWrapBase, tileSize]}
              onPress={() => handlePressItem(item)}
            >
              <View style={styles.posterInner}>
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
                ) : (
                  <Feather name="film" size={16} color={colors.muted} />
                )}
                {isMergedActivityItem(item) && (
                  // TARJA DE ÍCONES (2026-10-06, ver comentário grande
                  // do componente, no topo) — 1 ícone por ação única
                  // deste título (mesmo critério de ícone/cor usado em
                  // `MultiActionActivityCard`, `ActivityCard.tsx`),
                  // sobreposta na base do pôster: é a única forma
                  // compacta de preservar "fez mais de uma coisa com
                  // esse título" dentro de um grid de pôsteres lado a
                  // lado (sem linha de texto própria por item).
                  <View style={styles.mergedBadgeStrip}>
                    {/* PASTILHA COLORIDA POR TIPO (2026-10-06) — ver comentário grande em `ActivityTypeChip`, `ActivityCard.tsx`. Era ícone branco liso (contraste genérico contra qualquer pôster); a pastilha colorida já garante contraste sozinha (círculo sólido + ícone escuro dentro), então ganha a mesma identidade visual do resto do Feed sem perder legibilidade. */}
                    {[...new Set(item.actions)].map((action) => (
                      <ActivityTypeChip key={action} type={action} size={14} iconSize={8} />
                    ))}
                  </View>
                )}
              </View>
            </PressableScale>
          );
        })}
        {extraCount > 0 && (
          // "+N" só aparece quando NÃO expandido (`extraCount` sempre 0
          // quando `expanded`) — mesmo `tileSize` MEDIDO dos pôsteres
          // (ver comentário grande de `tileSize`, no topo do
          // componente), não mais uma variante flexível própria.
          <Pressable
            style={[styles.morePillBase, tileSize]}
            onPress={handlePressMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("feed.activityGroupShowMore", { count: extraCount })}
          >
            <Text style={styles.morePillText}>+{extraCount}</Text>
          </Pressable>
        )}
        {canCollapse && (
          <Pressable
            style={[styles.morePillBase, tileSize]}
            onPress={handlePressLess}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("feed.activityGroupShowLess")}
          >
            <Feather name="chevron-up" size={18} color={colors.primary} />
            <Text style={styles.lessPillText}>{t("feed.activityGroupShowLess")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  header: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  authorName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    flexShrink: 0,
    fontSize: fontSize.xxs,
  },
  verbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  verb: {
    fontSize: fontSize.xs,
  },
  // `marginBottom` novo (2026-10-01, feedback de design — "daria um
  // pouco mais de espaço entre os chips e os posters... hoje quase
  // encosta nas capas") — +4px de respiro antes de `postersRow`.
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  // Contraste aumentado (2026-10-01, feedback de design — "'2
  // finished' e '1 rated' estão pequenos demais e com baixo
  // contraste. Eles precisam continuar secundários, mas legíveis") —
  // era `fontSize.micro`/`colors.muted`; subiu um degrau em tamanho e
  // cor, sem virar destaque (continuam menores/mais discretas que o
  // texto principal do card).
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.text,
  },
  // `flexWrap` (2026-10-01, junto da expansão do "+N") — com o grupo
  // inteiro visível (ex.: 15 itens), uma única linha sem quebra
  // sairia da tela; `gap` já cobre o espaçamento nas duas direções
  // quando quebra pra mais de uma linha.
  //
  // RECOLHIDO NÃO QUEBRA (2026-10-02) — `flexWrap: "wrap"` saiu do
  // estilo base (padrão é "nowrap"); só é religado via
  // `postersRowExpanded` quando `expanded === true` (grade "Ver
  // tudo", que precisa quebrar linha de propósito). Com todo tile
  // usando o mesmo `tileSize` MEDIDO (4 colunas, ver comentário grande
  // no topo do componente) em vez de `flex: 1`, a linha recolhida
  // nunca ultrapassa a largura real da tela — não tem mais como
  // quebrar.
  postersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  postersRowExpanded: {
    flexWrap: "wrap",
  },
  // Ajustado NOVE vezes (2026-10-01, feedback de design) — era 44×64
  // (tier compacto puro); 1ª rodada 56×82; (...); 9ª rodada —
  // "foi muito, reverte esses 1%" — de volta a 91×132 (valor da 7ª
  // rodada). Essa PROPORÇÃO (`POSTER_ASPECT_RATIO`, 91/132) é o que
  // sobrevive de todo esse histórico — o TAMANHO fixo em si não é mais
  // usado desde 2026-10-02 (ver `tileSize`, no topo do componente):
  // nenhum modo (recolhido ou expandido) tem `width`/`height` fixos
  // aqui, só `width`/`height` MEDIDOS aplicados por fora.
  //
  // RENOMEADO DE `posterWrap` (2026-10-02, 3 reports em sequência —
  // "3 em vez de 4 por linha" com 91×132 fixo; "não dá pra ficar do
  // mesmo tamanho do recolhido?" com 76×110 fixo; "grupos de 2 títulos
  // com pôsteres gigantes" quando o recolhido ainda dividia a largura
  // só pelos tiles PRESENTES via `flex: 1`) — vira só a parte do
  // estilo que NÃO muda (cor/borda/raio/corte); `width`/`height` vêm
  // de fora via `tileSize`, o MESMO em qualquer modo e qualquer
  // quantidade de itens no grupo (sempre a largura da `postersRow`
  // dividida em `GRID_COLUMNS` colunas — nunca pelo número de tiles
  // realmente presentes, essa era a causa raiz do 3º report).
  posterWrapBase: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  // Ver comentário de `PressableScale`/`posterInner`, acima — mesmo
  // `alignItems`/`justifyContent` que `posterWrap` tinha antes, só
  // movidos pra dentro do `Animated.View` real (via este `View`).
  posterInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  // Tarja de ícones de um tile fundido (2026-10-06, ver comentário
  // grande do componente, no topo) — faixa semi-transparente colada na
  // base do pôster, ícones brancos (contraste garantido em qualquer
  // pôster, claro ou escuro) centralizados. `position: "absolute"`
  // dentro de `posterInner` (que tem `position: "relative"` por padrão
  // no React Native, nenhum `View` precisa declarar isso explicitamente).
  mergedBadgeStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  // Usada pela pastilha "+N" (recolhido) E "Ver menos" (expandido) —
  // `width`/`height` vêm de fora via `tileSize` (2026-10-02 — ver
  // comentário grande no topo do componente), o MESMO tamanho MEDIDO
  // dos pôsteres, em qualquer modo, senão a grade fica com um tile de
  // tamanho diferente dos outros.
  morePillBase: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  morePillText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  // Tile "Ver menos" (2026-10-01, a pedido — mesmo tamanho/estilo do
  // "+N", reaproveita `morePill`) — texto menor que `morePillText`
  // (que é só "+12", bem mais curto) pra caber em 2 linhas sem cortar.
  lessPillText: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
});
