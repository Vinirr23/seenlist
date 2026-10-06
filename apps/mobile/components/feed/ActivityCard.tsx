import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ActivityItem, ActivityType } from "@/lib/activityFeed";
import type { MergedActivityItem } from "@/lib/useFeedEntries";
import { tmdbImageUrl } from "@/lib/library";
import { fetchMovieStatusDetails, setMovieStatus } from "@/lib/movieDetails";
import { fetchSeriesStatus, setSeriesStatus } from "@/lib/seriesDetails";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Text } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { AnimatedStar } from "./AnimatedStar";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useNow } from "@/lib/useNow";
import { formatRelativeTime } from "@/lib/relativeTime";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

type QuickAddState = "idle" | "checking" | "hasStatus" | "added" | "error";

/**
 * HOOK COMPARTILHADO DE "+" RÁPIDO (2026-10-01, extraído da
 * `CompletedActivityHeroCard` — a pedido, "todo card que apareça,
 * tenha o (+) igual em explorar", escopo confirmado como SÓ os cards
 * de atividade, NUNCA `PostCard`/post social de verdade), agora
 * reaproveitada pelas 3 variantes de card (hero/médio/compacto) em
 * vez de só a hero ter o botão.
 *
 * BUG CORRIGIDO — CAUSA RAIZ (2026-10-02, reportado com 3 prints: "A
 * Hipótese do Amor" já na sua lista mostrando a bandeira vazia, e o
 * post de Re:Zero — seu próprio post de ter terminado a série —
 * mostrando o (+) desmarcado) — antes, o hook SEMPRE nascia em
 * `"idle"` e só conferia o status real no TOQUE do botão (decisão de
 * uma sessão anterior, pra nunca gastar uma consulta por card ao
 * montar a lista). Isso fazia o ícone mentir visualmente: ele promete
 * mostrar se o título já está na sua lista, mas na prática começava
 * sempre "vazio", existisse status ou não.
 *
 * Correção em duas partes, escolhidas com o usuário (trade-off de
 * performance explicado e aprovado):
 *
 * 1) POST PRÓPRIO (ex.: Re:Zero) — SEM NENHUM custo extra: se
 *    `item.userId` é o usuário logado, o próprio fato do post existir
 *    já PROVA que ele tem status pra essa mídia (foi ele quem gerou o
 *    evento que virou o post) — não precisa perguntar nada ao banco,
 *    só comparar com `session.user.id` (já em memória via
 *    `useAuth()`).
 * 2) POST DE OUTRA PESSOA (ex.: "A Hipótese do Amor", postado pela
 *    Mililikinha, mas que TAMBÉM está na lista do usuário atual, por
 *    coincidência) — aí não tem como saber sem perguntar: escolhida a
 *    opção "conferir 1 por 1, ao aparecer" — 1 consulta por card
 *    assim que ele monta (igual à consulta que já existia no toque,
 *    só que também roda uma vez no mount). Custo: em listas longas,
 *    isso é uma chamada a mais por card visível conforme rola o feed.
 *
 * TIPO ALARGADO PRA `QuickAddTarget` (2026-10-02, junto da correção do
 * "mesmo título duplicado no pôster") — só usa 3 campos (`userId`,
 * `mediaId`, `mediaType`), que tanto `ActivityItem` quanto o novo
 * `MergedActivityItem` (`lib/useFeedEntries.ts`) têm — deixa de exigir
 * `ActivityItem` inteiro só pra aceitar os dois sem cast.
 */
type QuickAddTarget = Pick<ActivityItem, "userId" | "mediaId" | "mediaType">;

function useQuickAdd(item: QuickAddTarget) {
  const { session } = useAuth();
  const isOwnPost = Boolean(session?.user?.id) && session!.user.id === item.userId;
  const [state, setState] = useState<QuickAddState>(isOwnPost ? "hasStatus" : "idle");

  useEffect(() => {
    if (isOwnPost) return;
    let cancelled = false;

    async function checkInitialStatus() {
      try {
        const hasStatus =
          item.mediaType === "movie"
            ? Boolean((await fetchMovieStatusDetails(item.mediaId)).status)
            : Boolean(await fetchSeriesStatus(item.mediaId));
        if (!cancelled && hasStatus) {
          setState("hasStatus");
        }
      } catch (error) {
        console.error("[ActivityCard] Falha ao conferir status inicial", error);
      }
    }

    checkInitialStatus();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnPost, item.mediaId, item.mediaType]);

  async function handleQuickAdd(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (state !== "idle") return;
    setState("checking");
    try {
      if (item.mediaType === "movie") {
        const { status } = await fetchMovieStatusDetails(item.mediaId);
        if (status) {
          setState("hasStatus");
          return;
        }
        await setMovieStatus(item.mediaId, "want_to_watch", null);
      } else {
        const status = await fetchSeriesStatus(item.mediaId);
        if (status) {
          setState("hasStatus");
          return;
        }
        await setSeriesStatus(item.mediaId, "want_to_watch", null);
      }
      setState("added");
    } catch (error) {
      console.error("[ActivityCard] Falha ao adicionar rápido à lista", error);
      setState("error");
    }
  }

  return { state, handleQuickAdd };
}

/**
 * BOTÃO "+" — versão "inline" (2026-10-01, a pedido) pros cards
 * médio/compacto: mesmos 3 estados visuais do botão da hero
 * (idle/checking/concluído), mas SEM o fundo semitransparente sobre
 * imagem (não tem imagem de fundo imprevisível atrás, é o fundo do
 * app mesmo) — usa `colors.surface` em vez de
 * `"rgba(11,14,20,0.55)"`. Fica no canto superior direito do card
 * (posição absoluta), igual à hero.
 *
 * ÍCONE TROCADO DE "+"/CHECK PRA BOOKMARK (2026-10-01, feedback de
 * design explícito — "o + aparece demais e começa a virar ruído
 * visual; se significa watchlist, eu prefiro bookmark e, se o título
 * já estiver na lista, mostrar o estado preenchido") — mesma ação de
 * sempre (adiciona à "assistir depois"), só o ícone/estado visual
 * mudou: contorno (`bookmark-outline`) quando ainda não tem status,
 * preenchido (`bookmark`, cor âmbar) quando já tem QUALQUER status
 * (não só quando ESTE botão adicionou — `hasStatus` cobre "já estava
 * na lista/assistindo/terminado antes de tocar aqui" também).
 */
function QuickAddButtonInline({ item }: { item: QuickAddTarget }) {
  const { t } = useTranslation();
  const { state, handleQuickAdd } = useQuickAdd(item);
  const addDone = state === "hasStatus" || state === "added";
  const addBusy = state === "checking";

  return (
    <Pressable
      style={styles.quickAddButtonInline}
      onPress={handleQuickAdd}
      disabled={state !== "idle"}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t("feed.quickAddToWatchlist")}
    >
      {addBusy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : addDone ? (
        <Ionicons name="bookmark" size={18} color={colors.primary} />
      ) : (
        <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
      )}
    </Pressable>
  );
}

/**
 * ACTIVITY CARD (2026-10-01, documento de UX — "transformaria ações
 * do SeenList em posts visuais", prioridade #1 escolhida) — card
 * SEM curtida/comentário/apagar (não é um post de verdade, é um
 * reflexo de `series_status`/`movie_status`/`reviews` — ver
 * `lib/activityFeed.ts`): só avatar+nome+ação. Toque no poster/título
 * leva pro detalhe da mídia; toque no nome/avatar leva pro perfil
 * (mesma divisão do `PostCard`).
 *
 * HIERARQUIA POR IMPORTÂNCIA (2026-10-01, feedback de design explícito
 * — "a importância da ação passa a determinar o peso visual") —
 * substituiu a divisão anterior (só "completed" vs. resto). Três
 * níveis agora:
 *   - "completed" ELEGÍVEL pra hero (ver `heroEligible`, calculado em
 *     `lib/useFeedEntries.ts` — no máx. 1 em cada 5-7 itens, pedido
 *     explícito: "se houver muitos finished, o feed vira uma
 *     sequência de banners enormes") → `CompletedActivityHeroCard`
 *     (pôster em tela cheia).
 *   - "completed" NÃO elegível (throttled) → `StandardActivityCard`
 *     tier="medium" (2026-10-06, reportado com print — mesmo caso do
 *     "watchlist" abaixo: pôster pequeno demais e desproporcional ao
 *     lado de "avaliou" no mesmo Feed. ANTES ficava em "compact" de
 *     propósito, pra parecer "rebaixado" pelo throttle de Hero — mas
 *     na prática, lado a lado de verdade, isso só lia como
 *     inconsistência visual, não hierarquia. Removida a última
 *     diferença de tamanho entre os 3 tipos de ActivityCard padrão).
 *   - "rated" (tem estrelas) → tier="medium" (pôster maior, mesmo
 *     tamanho já usado em `PostCard.tsx` pra review com texto).
 *   - "watchlist" → tier="medium" (2026-10-02, reportado com print —
 *     "o card 'adicionou à lista' ficou minúsculo e desproporcional
 *     perto do 'avaliou'" — ANTES era tier="compact", visivelmente
 *     menor que "rated" sem motivo de hierarquia pedido por ninguém;
 *     agora os três tipos usam o mesmo tamanho de pôster).
 *
 * BOTÃO "+" (2026-10-01, a pedido — "todo card que apareça, tenha o
 * (+) igual em explorar", escopo confirmado: SÓ cards de atividade) —
 * as 3 variantes (hero/médio/compacto) têm o botão agora, via
 * `useQuickAdd`/`QuickAddButtonInline` acima.
 */
export function ActivityCard({ item, heroEligible = false }: { item: ActivityItem; heroEligible?: boolean }) {
  if (item.activityType === "completed") {
    if (heroEligible) return <CompletedActivityHeroCard item={item} />;
    return <StandardActivityCard item={item} tier="medium" />;
  }
  if (item.activityType === "rated") return <StandardActivityCard item={item} tier="medium" />;
  return <StandardActivityCard item={item} tier="medium" />;
}

/**
 * IDENTIDADE VISUAL POR TIPO DE AÇÃO (2026-10-06, a pedido — "cada
 * post tivesse seu próprio padrão visual: avaliou, adicionou e
 * terminou, tendo seu próprio padrão") — mockups apresentados
 * (https://claude.ai/artifact/Pq61Ub5s7gzpw2PGUa74im, 3 opções) e de
 * escopo (https://claude.ai/artifact/EZyHEAmTkAWn2tRZGwCvJ7, "tudo
 * vira card" vs. "só as activities"), ambos decididos pelo usuário:
 * opção C (fundo com leve lavagem de cor) + escopo "só as 3
 * activities" — `PostCard.tsx` (post de review com texto, tem Like/
 * Comment) continua exatamente como está, de propósito.
 *
 * Cada tipo usa uma cor que JÁ tinha algum significado no app, não
 * uma nova inventada: "avaliou" = `colors.primary` (mesma cor das
 * estrelas), "terminou" = `colors.success` (mesma cor do ✓ que já
 * existia na linha do verbo), "adicionou" = `colors.info` (única
 * cor nova, nunca usada em activity antes — ver comentário de
 * `colors.info` em `lib/theme.ts`).
 */
/**
 * EXPORTADO (2026-10-06, a pedido — "padronizar os outros posts, os
 * ícones continuam os mesmos... quero que coloque os ícones iguais
 * aos que fizemos agora") — `ActivityGroupCard.tsx` (pílulas de grupo
 * misto, cabeçalho de grupo mesmo-tipo, ícones sobre o pôster quando
 * um título tem várias ações) e `MultiActionActivityCard`, abaixo
 * neste arquivo, reaproveitam a MESMA cor por tipo, pra não divergir
 * de novo (cada paleta duplicada em outro arquivo é mais uma chance
 * de ficar dessincronizada).
 */
export const ACTIVITY_ACCENT: Record<ActivityType, { base: string; wash: readonly [string, string] }> = {
  rated: { base: colors.primary, wash: ["rgba(232,163,61,0.14)", "rgba(232,163,61,0)"] },
  watchlist: { base: colors.info, wash: ["rgba(58,133,206,0.14)", "rgba(58,133,206,0)"] },
  completed: { base: colors.success, wash: ["rgba(52,199,123,0.14)", "rgba(52,199,123,0)"] },
};

/**
 * ÍCONE PADRÃO POR TIPO (2026-10-06) — mesma pastilha circular
 * preenchida (cor do tipo, ícone na cor do fundo do app) usada em
 * `StandardActivityCard`, agora reaproveitada por QUALQUER lugar do
 * Feed que precise mostrar "qual ação foi essa" — centraliza o
 * mapeamento tipo→ícone (`bookmark`/`check`/`star`) num só lugar,
 * evitado de ficar 4 cópias do mesmo `item.activityType === "..."`
 * espalhadas pelo código.
 */
export function ActivityTypeChip({ type, size = 18, iconSize = 10 }: { type: ActivityType; size?: number; iconSize?: number }) {
  const accent = ACTIVITY_ACCENT[type];
  return (
    <View style={[styles.verbChip, { width: size, height: size, borderRadius: size / 2, backgroundColor: accent.base }]}>
      <Feather name={type === "watchlist" ? "bookmark" : type === "completed" ? "check" : "star"} size={iconSize} color={colors.background} />
    </View>
  );
}

function StandardActivityCard({ item, tier }: { item: ActivityItem; tier: "medium" | "compact" }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w342") : null;
  const accent = ACTIVITY_ACCENT[item.activityType];

  const verb =
    item.activityType === "rated"
      ? t("feed.activityRated")
      : item.activityType === "watchlist"
        ? t("feed.activityWatchlist")
        : item.mediaType === "series"
          ? t("feed.activityCompletedSeries")
          : t("feed.activityCompletedMovie");

  function handlePressMedia() {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${item.userUsername}`);
  }

  return (
    <View style={tier === "medium" ? styles.cardWrapper : undefined}>
      <Pressable
        onPress={handlePressMedia}
        style={[tier === "medium" ? styles.coloredCard : styles.card, tier === "compact" && styles.cardCompact]}
      >
        {tier === "medium" && (
          <LinearGradient
            colors={accent.wash}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        )}
        <View style={styles.headerRow}>
          <Pressable style={styles.header} onPress={handlePressUser}>
            <Avatar uri={item.userAvatarUrl} name={item.userName} style={styles.avatar} textStyle={styles.avatarInitials} />
            <View style={styles.headerText}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.authorName}>
                  {item.userName}
                </Text>
                <VerifiedBadge tier={item.userVerifiedTier} size={fontSize.sm} />
                <Text numberOfLines={1} variant="muted" style={styles.meta}>
                  {formatRelativeTime(item.createdAt, now, locale, t("feed.justNow"))}
                </Text>
              </View>
              <View style={styles.verbRow}>
                {/*
                 * PADRONIZADO (2026-10-06, a pedido — "o icone de
                 * assistido não ficou padrão com o resto") — o tier
                 * "médio" já usava o selo (`verbChip`+`accent.base`,
                 * igual ao `ActivityTypeChip` — só reescrito à mão
                 * aqui em vez de chamar o componente); o "compacto"
                 * usava um `Feather` solto, SEM selo, e só tinha ícone
                 * pros tipos "watchlist"/"completed" — tipo "rated"
                 * (avaliou) não mostrava ícone NENHUM nesse tier, bug
                 * real encontrado ao padronizar (não só cosmético).
                 * Agora as duas variantes chamam o mesmo
                 * `ActivityTypeChip`, só com tamanho menor no
                 * compacto (mesmo valor das pílulas de
                 * `ActivityGroupCard`) — elimina as duas divergências
                 * de uma vez.
                 */}
                <ActivityTypeChip type={item.activityType} size={tier === "medium" ? 18 : 14} iconSize={tier === "medium" ? 10 : 8} />
                <Text variant="muted" style={[styles.verb, tier === "medium" && { color: accent.base, fontWeight: "700" }]}>
                  {verb}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View style={styles.mediaRow}>
          <View style={tier === "medium" ? styles.posterMedium : styles.posterCompact}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
            ) : (
              <Feather name="film" size={tier === "medium" ? 22 : 16} color={colors.muted} />
            )}
          </View>
          <View style={styles.mediaInfo}>
            <Text numberOfLines={2} style={styles.mediaTitle}>
              {item.mediaTitle}
            </Text>
            {item.activityType === "rated" && (
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <AnimatedStar
                    key={i}
                    index={i}
                    filled={i < Math.round(item.rating ?? 0)}
                    size={16}
                    color={colors.primary}
                    emptyColor={colors.border}
                  />
                ))}
                <Text style={styles.ratingText}>{(item.rating ?? 0).toFixed(1)}/5</Text>
              </View>
            )}
          </View>
        </View>

        <QuickAddButtonInline item={item} />
      </Pressable>

      {/*
        LINHA DIVISÓRIA PRÓPRIA, NÃO PRESA AO CARD (2026-10-06) — testado
        como borda do próprio `coloredCard` primeiro e rejeitado pelo
        usuário ("não colocou a linha entre os cards"): uma borda presa
        à base do card fica quase invisível contra o próprio fundo
        tingido/gradiente dele. Como elemento IRMÃO, fora do Pressable
        colorido, ela sempre repousa sobre o fundo normal da tela —
        mesma solução validada no mockup
        (https://claude.ai/artifact/EZyHEAmTkAWn2tRZGwCvJ7).
      */}
      {tier === "medium" && <View style={styles.cardDivider} />}
    </View>
  );
}

/**
 * CARD DE "MESMO TÍTULO, VÁRIAS AÇÕES" (2026-10-02, reportado com
 * print — "terminar e avaliar o título, duplica o poster dele, quando
 * deveria aparecer tipo um hero e as ações") — ver comentário grande
 * de `mergeSameMediaCluster`/`MergedActivityItem`, em
 * `lib/useFeedEntries.ts`, pra causa raiz completa: quando o mesmo
 * usuário faz 2+ ações sobre o MESMO título numa janela curta (ex.:
 * terminou e avaliou a mesma série em sequência), essas ações já
 * chegam aqui FUNDIDAS num `MergedActivityItem` em vez de virarem um
 * `ActivityGroup` (grade de pôsteres — pensada pra títulos
 * DIFERENTES, duplicava o pôster quando era o mesmo título).
 *
 * LAYOUT — Opção B de 3 mockups apresentados ao usuário (mockup:
 * https://claude.ai/artifact/FPZR3Vd2rzYEpSLqz8qCcC), escolhida por
 * pedido explícito: mesmo tamanho de card do `tier="medium"` comum
 * (nada de virar um Hero em tela cheia por causa disso — múltiplas
 * ações não deveriam pesar MAIS que uma única "completed" elegível a
 * Hero), com uma linha de verbo COMBINADA acima do pôster (ex. "✓ ★
 * terminou e avaliou", um ícone por ação + os verbos unidos pelo
 * conector localizado `feed.activityMultiVerbJoiner`) — igual ao
 * pedido: "adiciona acima do pôster o 'assistiu e avaliou' com os
 * símbolos". Estrelas aparecem se "rated" estiver entre as ações,
 * igual ao `StandardActivityCard` tier="medium".
 *
 * Ícones/verbos deduplicados (`uniqueActions`) — defensivo pro caso
 * raro de 2 ações do MESMO tipo no cluster (ex.: avaliou, reavaliou
 * dentro da janela); sem isso o verbo sairia repetido ("avaliou e
 * avaliou").
 */
export function MultiActionActivityCard({ item }: { item: MergedActivityItem }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w342") : null;
  const uniqueActions = [...new Set(item.actions)];
  const hasRated = uniqueActions.includes("rated");

  const verbFor = (action: ActivityItem["activityType"]) =>
    action === "rated"
      ? t("feed.activityRated")
      : action === "watchlist"
        ? t("feed.activityWatchlist")
        : item.mediaType === "series"
          ? t("feed.activityCompletedSeries")
          : t("feed.activityCompletedMovie");

  const combinedVerb = uniqueActions.map(verbFor).join(` ${t("feed.activityMultiVerbJoiner")} `);

  function handlePressMedia() {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${item.userUsername}`);
  }

  return (
    <Pressable onPress={handlePressMedia} style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable style={styles.header} onPress={handlePressUser}>
          <Avatar uri={item.userAvatarUrl} name={item.userName} style={styles.avatar} textStyle={styles.avatarInitials} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.authorName}>
                {item.userName}
              </Text>
              <VerifiedBadge tier={item.userVerifiedTier} size={fontSize.sm} />
              <Text numberOfLines={1} variant="muted" style={styles.meta}>
                {formatRelativeTime(item.createdAt, now, locale, t("feed.justNow"))}
              </Text>
            </View>
            <View style={styles.verbRow}>
              {/*
                PASTILHA COLORIDA POR TIPO (2026-10-06, a pedido — "pra
                padronizar os outros posts, os ícones continuam os
                mesmos... quero que coloque os ícones iguais aos que
                fizemos agora") — era ícone de contorno solto, igual ao
                padrão antigo do `StandardActivityCard` antes da Opção
                C; trocado pela mesma `ActivityTypeChip` (ver
                `ACTIVITY_ACCENT`, acima neste arquivo), pra não ficar 1
                estilo de ícone no card normal e outro aqui.
              */}
              {uniqueActions.map((action) => (
                <ActivityTypeChip key={action} type={action} size={16} iconSize={9} />
              ))}
              <Text variant="muted" style={[styles.verb, { marginLeft: 2 }]}>
                {combinedVerb}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.mediaRow}>
        <View style={styles.posterMedium}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
          ) : (
            <Feather name="film" size={22} color={colors.muted} />
          )}
        </View>
        <View style={styles.mediaInfo}>
          <Text numberOfLines={2} style={styles.mediaTitle}>
            {item.mediaTitle}
          </Text>
          {hasRated && (
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <AnimatedStar
                  key={i}
                  index={i}
                  filled={i < Math.round(item.rating ?? 0)}
                  size={16}
                  color={colors.primary}
                  emptyColor={colors.border}
                />
              ))}
              <Text style={styles.ratingText}>{(item.rating ?? 0).toFixed(1)}/5</Text>
            </View>
          )}
        </View>
      </View>

      <QuickAddButtonInline item={item} />
    </Pressable>
  );
}

/**
 * CARD GRANDE DE "TERMINOU/ASSISTIU" (2026-10-01, a pedido — porte de
 * layout visual de outro app, aprovado pelo usuário: pôster em tela
 * cheia + botão "+" de adicionar rápido). AVISO DE DESEMPENHO (regra
 * permanente do projeto) — pôster aqui é `w500` (era `w342` no card
 * pequeno, ainda maior que o antigo `w185` dos posts comuns): imagem
 * MAIOR por card nesta lista virtualizada custa mais memória/banda
 * que o card pequeno de antes. Com o THROTTLE de hero (2026-10-01,
 * feedback de design — "limitaria a um Hero a cada 5-7 itens"), esses
 * cards "w500" ficaram ainda mais raros no Feed (no máx. 1 em cada 6,
 * ver `HERO_MIN_GAP` em `lib/useFeedEntries.ts`) — o resto dos
 * "completed" cai pro card compacto (`w342`, igual aos outros).
 *
 * BOTÃO "+" — adiciona à "assistir depois" sem abrir a tela do
 * título, só pra quem AINDA não tem status nenhum pra essa mídia
 * (confere antes de escrever via `useQuickAdd`, acima — nunca REBAIXA
 * quem já está "assistindo"/"assistido"/"terminado" de volta pra
 * "assistir depois"). Busca o status atual só NO TOQUE do botão, não
 * ao montar o card.
 */
function CompletedActivityHeroCard({ item }: { item: ActivityItem }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w500") : null;
  const { state: quickAdd, handleQuickAdd } = useQuickAdd(item);

  function handlePressMedia() {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${item.userUsername}`);
  }

  const verb = item.mediaType === "series" ? t("feed.activityCompletedSeries") : t("feed.activityCompletedMovie");
  const addDone = quickAdd === "hasStatus" || quickAdd === "added";
  const addBusy = quickAdd === "checking";

  return (
    <Pressable onPress={handlePressMedia} style={styles.heroCard}>
      <View style={styles.heroImageWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroImageFallback]}>
            <Feather name="film" size={32} color={colors.muted} />
          </View>
        )}

        <LinearGradient colors={["rgba(11,14,20,0.75)", "rgba(11,14,20,0)"]} locations={[0, 1]} style={styles.heroTopScrim} pointerEvents="none" />
        <LinearGradient
          colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.6)", colors.background]}
          locations={[0, 0.55, 1]}
          style={styles.heroBottomScrim}
          pointerEvents="none"
        />

        <Pressable style={styles.heroHeader} onPress={handlePressUser} hitSlop={4}>
          <Avatar uri={item.userAvatarUrl} name={item.userName} style={styles.heroAvatar} textStyle={styles.heroAvatarInitials} />
          <View style={styles.heroHeaderText}>
            {/*
             * CORREÇÃO (2026-10-01, reportado com print — "por que o
             * horário aqui está embaixo em vez de do lado do nome, como
             * é o padrão?") — CAUSA RAIZ: este cabeçalho (Hero) foi
             * montado à parte (2026-10-01, baseado num layout de
             * referência de outro app) e nunca recebeu a correção que
             * `PostCard.tsx` já tinha (2026-09-29, "horário do lado do
             * nome, igual Threads") — o horário vivia num `<Text>`
             * PRÓPRIO, fora de `heroNameRow`, por isso caía numa 2ª
             * linha embaixo do nome+selo. Agora entra DENTRO de
             * `heroNameRow`, mesma posição/comportamento de
             * `PostCard.tsx`/`StandardActivityCard` (`flexShrink: 0` —
             * nunca é espremido antes do nome truncar primeiro).
             */}
            <View style={styles.heroNameRow}>
              <Text numberOfLines={1} style={styles.heroAuthorName}>
                {item.userName}
              </Text>
              <VerifiedBadge tier={item.userVerifiedTier} size={fontSize.sm} />
              <Text numberOfLines={1} style={styles.heroMeta}>
                {formatRelativeTime(item.createdAt, now, locale, t("feed.justNow"))}
              </Text>
            </View>
          </View>
        </Pressable>

        {/*
         * MANTIDO "+"/CHECK NA HERO, NÃO BOOKMARK (2026-10-01, pedido
         * explícito — "essas hero 'watched' quero que tenha o (+) já
         * que os demais posts são a bandeirinha") — o bookmark
         * (`QuickAddButtonInline`, acima) virou a linguagem visual dos
         * cards médio/compacto; a Hero fica diferente de propósito,
         * com o ícone original "+"/check + a caixa que muda de cor
         * (borda/fundo âmbar → verde) pra indicar o estado concluído,
         * já que aqui não tem outro ícone de bookmark por perto
         * competindo por atenção (ao contrário dos cards pequenos, que
         * já mostram um bookmark no `verbRow` pra "adicionou à
         * lista").
         */}
        <Pressable
          style={[styles.quickAddButton, addDone && styles.quickAddButtonDone]}
          onPress={handleQuickAdd}
          disabled={quickAdd !== "idle"}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("feed.quickAddToWatchlist")}
        >
          {addBusy ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : addDone ? (
            <Feather name="check" size={16} color={colors.background} />
          ) : (
            <Feather name="plus" size={16} color={colors.primary} />
          )}
        </Pressable>

        <View style={styles.heroFooter}>
          <View style={styles.heroTitleRow}>
            {/*
             * PADRONIZADO (2026-10-06, a pedido — "o icone de assistido
             * não ficou padrão com o resto") — era um `Feather
             * check-circle` avulso, verde mas sem o fundo/pílula; a Hero
             * tinha ficado de fora da rodada de padronização de ícones
             * (`ActivityGroupCard`/`MultiActionActivityCard`) por ser um
             * componente à parte dentro deste mesmo arquivo. Mesmo selo
             * `ActivityTypeChip` (círculo preenchido + ícone) do resto
             * do Feed — `type="completed"` sempre certo aqui, já que
             * esta Hero só existe pra atividade de "assistiu" (`heroEligible`).
             */}
            <ActivityTypeChip type="completed" size={16} iconSize={9} />
            <Text numberOfLines={2} style={styles.heroTitle}>
              {item.mediaTitle}
            </Text>
          </View>
          <Text style={styles.heroVerb}>{verb}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * IDENTIDADE VISUAL POR TIPO (2026-10-06, ver comentário grande em
   * `ACTIVITY_ACCENT`, acima) — tier "médio" (hoje, único alcançável
   * pelas 3 activities de `StandardActivityCard`) trocou a receita
   * "linha reta igual Threads" por card próprio: cantos arredondados,
   * fundo com leve lavagem da cor da ação (`LinearGradient`, pintado
   * por cima via `coloredCard` abaixo), espaço em volta
   * (`cardWrapper`) e uma linha divisória PRÓPRIA, fora do card
   * (`cardDivider`) — nunca presa à borda dele, ver comentário no JSX.
   */
  cardWrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  coloredCard: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingRight: 40,
    overflow: "hidden",
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  verbChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  // Mesma receita visual de `PostCard.tsx` ("feed igual Threads") — sem fundo/borda ao redor, só a linha fina embaixo separando do próximo item.
  // `paddingRight` reserva espaço pro botão de watchlist (posição absoluta, canto superior direito) não cobrir nome/hora compridos.
  // Hoje só alcançável pelo tier "compacto" (nenhuma chamada passa mais — ver `ACTIVITY_ACCENT`/`ActivityCard()` — mantido por segurança, caso o tier volte a ser usado).
  card: {
    paddingVertical: spacing.md,
    paddingRight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // Tier "compacto" (2026-10-01, feedback de design — "reduziria um
  // pouco a altura vertical dos posts simples; hoje há bastante espaço
  // vazio entre título e divisor") — o pôster compacto (44×64) é bem
  // mais baixo que o padding vertical de `card` reservava; reduzido só
  // pra este tier (o "médio", com pôster 126 de altura, continua
  // usando o padding normal — ele precisa do espaço).
  cardCompact: {
    paddingVertical: spacing.sm,
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
  mediaRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // Tier "médio" (2026-10-01, hierarquia por importância — "avaliou") — mesmo tamanho já usado em `PostCard.tsx` (`reviewPoster`) pra consistência visual entre os dois lugares do Feed que mostram pôster com texto ao lado.
  posterMedium: {
    width: 84,
    height: 126,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Tier "compacto" (2026-10-01, hierarquia por importância — "adicionou à lista" e "terminou" fora do throttle de hero) — pôster pequeno, peso visual mínimo.
  posterCompact: {
    width: 44,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  mediaInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  mediaTitle: {
    fontSize: fontSize.smPlus,
    fontWeight: "700",
    color: colors.text,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    marginLeft: spacing.xs,
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.muted,
  },

  // --- Botão de watchlist inline (médio/compacto) ---
  // SIMPLIFICADO (2026-10-01, feedback de design — "o + aparece demais
  // e começa a virar ruído visual") — era uma caixinha com borda +
  // fundo (`colors.surface`/borderWidth 1.5), competindo visualmente
  // com o resto do card. Virou só o ícone (contorno/preenchido, ver
  // `QuickAddButtonInline` acima), sem caixa ao redor — ainda com área
  // de toque confortável via `hitSlop`.
  // AUMENTADO (2026-10-02, a pedido — "aumenta um pouco o botão
  // bandeira de adicionar") — ícone 15→18, área de toque 28×28→32×32.
  quickAddButtonInline: {
    position: "absolute",
    top: spacing.md,
    right: spacing.sm,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // --- CompletedActivityHeroCard (card grande de "terminou/assistiu") ---
  heroCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  /**
   * BUG REAL CORRIGIDO (2026-10-01, reportado — "ficou muito grande")
   * — era `2/3` (proporção de pôster de verdade, alto e estreito):
   * com a largura do card inteira, isso virava um card quase do
   * tamanho da tela. A referência enviada pelo usuário é bem mais
   * baixa/larga (~4:3) — a imagem (mesmo pôster, `contentFit: "cover"`
   * já corta o excesso) passa a preencher uma caixa mais curta, igual
   * à referência, em vez do pôster inteiro em pé.
   */
  heroImageWrapper: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroTopScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
  },
  // Caixa mais baixa (ver `heroImageWrapper`) = menos altura sobrando pro texto embaixo — percentual maior pra manter título/verbo legíveis sem precisar de tanto espaço vertical quanto na caixa alta original.
  heroBottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  heroHeader: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: 56, // espaço pro botão "+" no canto, pra não sobrepor nome comprido
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatarInitials: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    color: colors.muted,
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroAuthorName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  // Ver comentário de correção acima — agora inline em `heroNameRow`
  // (era uma 2ª linha, com `marginTop: 1`). `flexShrink: 0` igual ao
  // `meta` de `PostCard.tsx`/`StandardActivityCard` — nunca cede
  // espaço antes do nome truncar primeiro.
  heroMeta: {
    flexShrink: 0,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  quickAddButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "rgba(11,14,20,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  // BUG REAL CORRIGIDO (2026-10-01, reportado — "ao marcar o botão
  // ficou preenchido em verde, o padrão do app é âmbar") — era
  // `colors.success` (verde), inconsistente com o resto do app: o
  // "+"/check da Hero é a única cor de destaque que existe sobre a
  // imagem, então devia seguir a mesma cor-marca (`colors.primary`,
  // âmbar) que todo o resto do app usa pra ação/destaque — verde aqui
  // ficava parecendo um sistema de cores à parte, não o SeenList.
  quickAddButtonDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  heroFooter: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  heroVerb: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
});
