import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Modal, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem, WatchProvider } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { fetchMovieDetails } from "@/lib/movieDetails";
import { fetchLibraryStatusesFor, type DiscoverItem } from "@/lib/discover";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { Text, Glass } from "@/components/ui";
import { StarRating } from "@/components/reviews/StarRating";
import { colors, radius, spacing, scrim, fontSize, elevation } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * NOVO (a pedido, 2026-10-15 — "O que assistir?": resolver a
 * indecisão de abrir "Assistir a seguir" com muitas opções e fechar o
 * app sem assistir nada) — único arquivo novo desta feature: a folha
 * (mesmo esqueleto de `Modal transparent animationType="slide"` +
 * overlay + `Glass variant="dark"` já usado em `RecommendSheet.tsx`/
 * `RecommendationQuickActionsSheet.tsx`) E a lógica de escolha, as
 * duas no mesmo arquivo de propósito — não é reusada em nenhum outro
 * lugar do app, então não precisa virar hook/serviço separado.
 *
 * ESCOLHA — REFEITA (2026-10-16, a pedido — "limita a próxima
 * sugestão da lista aos 3 mais bem avaliados e depois disso, a
 * sugestão deve vir de populares no TMDB que ainda não foi assistido
 * pelo usuário") — a escolha original (bayesiana, top 30% por nota
 * ponderada pela quantidade de votos) foi SUBSTITUÍDA por duas fases
 * bem mais diretas, nessa ordem:
 *
 * FASE 1 — os `TOP_LIBRARY_POOL_SIZE` (3) filmes de nota REAL mais
 * alta dentro do próprio "Assistir a seguir" do usuário (`items`),
 * sorteando um dentre os que ainda não foram mostrados nesta sessão
 * da folha (pequena aleatoriedade preservada, mas o POOL agora é
 * literalmente os 3 melhores, não mais 30% da lista).
 *
 * FASE 2 — assim que os 3 da fase 1 já foram todos mostrados, a folha
 * passa a sugerir filmes POPULARES do TMDB (`popular_movies`, mesma
 * lista já usada no carrossel "Populares" da Explorar) que o usuário
 * AINDA NÃO ASSISTIU (`movie_status.status <> 'watched'`, conferido
 * via `fetchLibraryStatusesFor` — já existia, reaproveitado, nenhuma
 * query nova) — e, por decisão própria (não pedida explicitamente,
 * mas evita um caso estranho: sugerir algo que já está bem na frente
 * do usuário, na própria grade "Assistir a seguir" visível atrás da
 * folha), também excluindo qualquer filme já presente em `items`
 * (`libraryIds` abaixo). Nunca mais volta pra fase 1 depois de
 * esgotar os 3 (não faz sentido voltar a repetir o "melhor da lista"
 * depois de já ter mostrado os 3).
 *
 * `SuggestionItem` é um tipo PRÓPRIO desta tela (não `LibraryItem`) —
 * criado porque a fase 2 trabalha com `DiscoverItem` (TMDB populares,
 * sem vínculo com a biblioteca do usuário: sem `status`/`createdAt`/
 * etc. que `LibraryItem` exige) e precisava de um formato comum que
 * sirva pras DUAS fases sem forçar campos falsos em `LibraryItem`.
 */

/** Quantos dos melhores avaliados da PRÓPRIA lista entram na fase 1 — literal, não mais uma fração da lista. */
const TOP_LIBRARY_POOL_SIZE = 3;

/**
 * Formato comum às duas fases — só os campos que a folha de fato
 * renderiza. `runtimeMinutes` nasce `null` pra um item vindo do TMDB
 * populares (ver `fromDiscoverItem`, `DiscoverItem` não traz duração)
 * e é preenchido depois, assim que `fetchMovieDetails` (já chamado
 * pra "onde assistir") resolve — ver o `useEffect` mais abaixo.
 */
interface SuggestionItem {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  runtimeMinutes: number | null;
  voteAverage: number | null;
}

function fromLibraryItem(item: LibraryItem): SuggestionItem {
  return {
    id: item.id,
    title: item.title,
    year: item.year,
    posterPath: item.posterPath,
    runtimeMinutes: item.runtimeMinutes ?? null,
    voteAverage: item.voteAverage ?? null,
  };
}

function fromDiscoverItem(item: DiscoverItem): SuggestionItem {
  return {
    id: item.id,
    title: item.title,
    year: item.year,
    posterPath: item.posterPath,
    runtimeMinutes: null,
    voteAverage: item.voteAverage,
  };
}

/**
 * NOVO (2026-10-17, feedback de revisão — "por que esse filme foi
 * escolhido pra mim", justificativa curta abaixo do título) —
 * `"top-rated"` cobre TODA a fase 1 agora (o pool já É literalmente os
 * melhores avaliados, não precisa mais distinguir um 2º nível
 * "bem avaliado, mas não exatamente o melhor"); `"popular"` é novo,
 * cobre a fase 2 (TMDB populares) — motivo diferente, já que não é
 * mais sobre a nota da lista do usuário.
 */
export type SuggestionReason = "top-rated" | "popular" | null;

export function WhatToWatchSheet({ items, onClose }: { items: LibraryItem[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale } = useTranslation();

  // Fase 1 — os 3 melhores avaliados da PRÓPRIA lista (ver comentário
  // grande no topo do arquivo). Calculado uma vez por abertura da
  // folha (`items` não muda enquanto ela está aberta).
  const topLibraryPool = useMemo(
    () =>
      items
        .filter((item): item is LibraryItem & { voteAverage: number } => item.voteAverage != null)
        .sort((a, b) => b.voteAverage - a.voteAverage)
        .slice(0, TOP_LIBRARY_POOL_SIZE),
    [items]
  );
  // Ids já na biblioteca do usuário — excluídos da fase 2 (ver
  // comentário grande no topo do arquivo, racional de não sugerir via
  // TMDB algo que já está na própria grade "Assistir a seguir").
  const libraryIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  // Fase 2 — populares do TMDB, mesma lista já usada no carrossel
  // "Populares" da Explorar (`DiscoverCarousel`/`useDiscoverList`,
  // já com cache local stale-while-revalidate próprio). Buscada desde
  // já (não só quando a fase 1 esgota) porque o hook já é barato
  // (cache local) e assim a fase 2 começa pronta pro caso comum de o
  // usuário clicar "Outra sugestão" várias vezes seguidas.
  const popularMovies = useDiscoverList("popular_movies");

  // Confere quais dos populares o usuário JÁ assistiu
  // (`movie_status.status === "watched"`, via `fetchLibraryStatusesFor`
  // — já existia, reaproveitado) — `null` = ainda não conferido (fase
  // 2 fica vazia até resolver, nunca sugere sem essa checagem feita).
  const [watchedPopularIds, setWatchedPopularIds] = useState<Set<number> | null>(null);

  useEffect(() => {
    if (popularMovies.items.length === 0) return;
    let cancelled = false;
    fetchLibraryStatusesFor(popularMovies.items.map((item) => ({ mediaType: "movie" as const, id: item.id })))
      .then((statusMap) => {
        if (cancelled) return;
        const watched = new Set<number>();
        for (const item of popularMovies.items) {
          if (statusMap.get(`movie-${item.id}`) === "watched") watched.add(item.id);
        }
        setWatchedPopularIds(watched);
      })
      .catch((error) => {
        // Falha aqui não pode travar a fase 2 pra sempre — pior caso
        // (rede fora), aceita o risco de sugerir algo já assistido
        // uma vez, em vez de nunca mais sugerir nada depois da fase 1.
        console.error("[WhatToWatchSheet] Falha ao conferir filmes já assistidos (populares TMDB)", error);
        setWatchedPopularIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [popularMovies.items]);

  const popularPool = useMemo(() => {
    if (watchedPopularIds == null) return [];
    return popularMovies.items.filter((item) => !watchedPopularIds.has(item.id) && !libraryIds.has(item.id));
  }, [popularMovies.items, watchedPopularIds, libraryIds]);

  // Estado só desta "sessão" da folha (não sobrevive fechar/abrir de
  // novo, de propósito — "enquanto houver alternativas" é sobre esta
  // conferida, não pra sempre). Duas listas de "já mostrado" porque as
  // duas fases nunca se misturam (ver comentário grande no topo do
  // arquivo) — mas são mutadas EM LUGAR (`.add(...)`, não substituídas
  // por um novo Set), não disparam re-render sozinhas; quem dispara é
  // `current` abaixo.
  const [shownLibraryIds] = useState(() => new Set<number>());
  const [shownPopularIds] = useState(() => new Set<number>());

  const pickNext = useCallback((): { item: SuggestionItem; reason: SuggestionReason } | null => {
    const remainingLibrary = topLibraryPool.filter((item) => !shownLibraryIds.has(item.id));
    const chosenLibrary = remainingLibrary[Math.floor(Math.random() * remainingLibrary.length)];
    // Checagem via variável (não `remainingLibrary.length > 0`) porque o
    // projeto tem `noUncheckedIndexedAccess` ativo — o TS não tem como
    // saber, só pelo tamanho do array, que o índice sorteado é válido;
    // precisa do resultado do próprio acesso pra estreitar o tipo.
    if (chosenLibrary) {
      return { item: fromLibraryItem(chosenLibrary), reason: "top-rated" };
    }
    if (popularPool.length === 0) return null;
    const remainingPopular = popularPool.filter((item) => !shownPopularIds.has(item.id));
    // Esgotou as alternativas novas da fase 2 — melhor repetir do que
    // não sugerir nada (mesma política já usada antes na fase 1).
    const candidates = remainingPopular.length > 0 ? remainingPopular : popularPool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen ? { item: fromDiscoverItem(chosen), reason: "popular" } : null;
  }, [topLibraryPool, shownLibraryIds, popularPool, shownPopularIds]);

  const [current, setCurrent] = useState<{ item: SuggestionItem; reason: SuggestionReason } | null>(() => pickNext());
  const suggestion = current?.item ?? null;
  const reason = current?.reason ?? null;
  /**
   * NOVO (a pedido, 2026-10-17 — "adiciona no sheet 'onde assistir'",
   * mockup aprovado) — `LibraryItem` (o que a folha já tem) NÃO traz
   * `watchProviders`: esse campo só existe em `MovieDetails`, o
   * resumo PESADO que a tela de filme busca. Como a folha mostra só
   * UM filme por vez, busca com `fetchMovieDetails` — a MESMA função
   * já usada por `useMovieDetails.ts` (cache de módulo de 5 minutos,
   * chave `movieId:locale`) — nenhuma chamada nova de infraestrutura,
   * só reaproveitamento. `null` = ainda carregando OU sem providers
   * (as duas situações escondem o bloco igual, ver JSX abaixo —
   * nunca mostra um estado "carregando" visível, pra não piscar
   * numa folha que já abre com `animationType="slide"` rápido).
   */
  const [watchProviders, setWatchProviders] = useState<WatchProvider[] | null>(null);

  useEffect(() => {
    if (!suggestion) {
      setWatchProviders(null);
      return;
    }
    // Capturado fora do `.then` — a resposta pode voltar depois que o
    // usuário já trocou de sugestão (`handleAnotherSuggestion`); sem
    // isso, uma resposta atrasada do filme ANTERIOR poderia sobrescrever
    // o `runtimeMinutes` do filme ATUAL por engano.
    const suggestionId = suggestion.id;
    let cancelled = false;
    setWatchProviders(null); // limpa o provider do filme anterior antes de buscar o novo (evita mostrar o logo errado por um instante ao trocar de sugestão).
    fetchMovieDetails(String(suggestionId), locale)
      .then((data) => {
        if (cancelled) return;
        setWatchProviders(data.watchProviders);
        // NOVO (2026-10-16, fase 2 "populares do TMDB") — `DiscoverItem`
        // não traz duração (`fromDiscoverItem` nasce com
        // `runtimeMinutes: null`); completa aqui com o mesmo dado já
        // buscado pra "onde assistir", sem nenhuma chamada nova. A
        // forma funcional do `setCurrent` evita depender do objeto
        // `suggestion` nas deps deste efeito (que mudaria de
        // identidade a cada troca, reexecutando a busca à toa) — e o
        // `current?.item.id === suggestionId` dentro dela protege
        // contra a corrida de já ter trocado de sugestão quando a
        // resposta chega.
        setCurrent((current) =>
          current && current.item.id === suggestionId && current.item.runtimeMinutes == null && data.runtimeMinutes != null
            ? { ...current, item: { ...current.item, runtimeMinutes: data.runtimeMinutes } }
            : current
        );
      })
      .catch((error) => {
        // Falha de rede aqui não é crítica — o resto da folha (pôster,
        // nota, botão "Ver filme") já funciona sem este dado. Só
        // desiste silenciosamente: o bloco "Onde assistir" fica sem
        // aparecer, mesmo comportamento de "sem provider cadastrado".
        console.error("[WhatToWatchSheet] Falha ao buscar onde assistir", error);
      });
    return () => {
      cancelled = true;
    };
  }, [suggestion?.id, locale]);

  const handleAnotherSuggestion = useCallback(() => {
    if (current) {
      if (current.reason === "popular") shownPopularIds.add(current.item.id);
      else shownLibraryIds.add(current.item.id);
    }
    setCurrent(pickNext());
  }, [current, shownLibraryIds, shownPopularIds, pickNext]);

  const handleWatchNow = useCallback(() => {
    if (!suggestion) return;
    onClose();
    router.push(`/movies/${suggestion.id}`);
  }, [suggestion, onClose, router]);

  const posterUrl = suggestion ? tmdbImageUrl(suggestion.posterPath, "w500") : null;
  const metaParts = suggestion
    ? [suggestion.year ? String(suggestion.year) : null, suggestion.runtimeMinutes ? `${suggestion.runtimeMinutes} min` : null].filter(Boolean)
    : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* REDUZIDO (2026-10-17, "área vazia grande" no fim da folha) — era `spacing.lg + insets.bottom`; `insets.bottom` já cobre a área de sistema (barra de gestos/home indicator), spacing.md é respiro suficiente além disso. */}
        <Glass style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} variant="dark">
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={colors.muted} />
          </Pressable>

          <Text variant="subtitle" style={styles.title}>
            {t("whatToWatch.sheetTitle")}
          </Text>

          {suggestion && (
            <>
              <Glass style={styles.posterWrapper} variant="medium">
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
                ) : (
                  <View style={styles.posterFallback}>
                    <Feather name="film" size={28} color={colors.muted} />
                  </View>
                )}
                {/*
                 * REMOVIDO (2026-10-16, a pedido — "tira a avaliação do
                 * poster já que dentro do sheet o motivo da escolha é
                 * exatamente o filme ser o mais bem avaliado da lista"):
                 * o selo de nota sobre o pôster (antigo `ratingBadge`)
                 * ficava redundante com o `reasonCard` abaixo, que já
                 * explica a nota em texto. A linha isolada
                 * número+estrelas (`ratingInlineRow`, logo depois do
                 * `Glass` abaixo) continua — o pedido foi só sobre o
                 * pôster, não sobre essa linha.
                 */}
              </Glass>

              {/*
               * NOVO (2026-10-17, Opção 7 — "nota também aparece grande,
               * isolada, acima do título na folha") — linha isolada
               * número grande + estrelas (`StarRating`, já existente,
               * reaproveitado em vez de reinventar a lógica de preencher
               * estrela — ver `components/reviews/StarRating.tsx`).
               * `voteAverage` é 0–10 (TMDB); `StarRating` espera 0–5, daí
               * a divisão por 2. Só aparece com nota real (mesma regra
               * de sempre — sem dado, sem elemento no lugar).
               */}
              {suggestion.voteAverage != null && (
                <View style={styles.ratingInlineRow}>
                  <Text style={styles.ratingInlineNumber}>{suggestion.voteAverage.toFixed(1)}</Text>
                  <StarRating value={suggestion.voteAverage / 2} size="sm" />
                </View>
              )}

              <Text numberOfLines={2} style={styles.movieTitle}>
                {suggestion.title}
              </Text>
              {metaParts.length > 0 && (
                <Text variant="muted" style={styles.meta}>
                  {metaParts.join(" · ")}
                </Text>
              )}
              {/*
               * REDESENHADO (2026-10-17, Opção 10 do mockup aprovado —
               * "frase do motivo muito pequena, corrija") — era texto
               * solto, pequeno/apagado (`fontSize.xs`, `colors.muted`,
               * sem fundo). Agora: card próprio (`colors.surface`,
               * cantos arredondados, padding) com ícone âmbar (✦,
               * `colors.primary`) + texto em negrito — mesma hierarquia
               * que o resto da folha já usa pra destacar informação
               * (ver `Glass`/badges). `reason` continua só aparecendo com
               * dado real (`reason` vem de `pickNext`, nunca inventado).
               */}
              {reason && (
                <View style={styles.reasonCard}>
                  <Text style={styles.reasonIcon}>✦</Text>
                  <Text numberOfLines={2} style={styles.reasonText}>
                    {reason === "top-rated" ? t("whatToWatch.reasonTopRated") : t("whatToWatch.reasonPopular")}
                  </Text>
                </View>
              )}

              {/*
               * NOVO (2026-10-17, "adiciona no sheet 'onde assistir'",
               * mockup aprovado) — mesmo padrão visual já usado em
               * `SeriesWatchProviders.tsx`/`StreamingProviders.tsx`
               * (logo + nome embaixo), só menor (40px em vez de 48px)
               * pra caber na folha sem empurrar o resto do conteúdo.
               * Sem dado real (`watchProviders` null ou vazio — ainda
               * carregando OU TMDB não tem nenhum cadastrado pra esse
               * título/região), o bloco inteiro não aparece — mesma
               * regra de sempre, nunca mostra placeholder vazio nem
               * estado de carregamento visível.
               */}
              {watchProviders != null && watchProviders.length > 0 && (
                <View style={styles.providersBlock}>
                  <Text variant="muted" style={styles.providersLabel}>
                    {t("movie.whereToWatch")}
                  </Text>
                  <View style={styles.providersRow}>
                    {watchProviders.map((provider) => {
                      const logoUrl = tmdbImageUrl(provider.logoPath, "w185");
                      return (
                        <View key={provider.id} style={styles.providerItem}>
                          <Glass style={styles.providerLogoWrapper} variant="medium">
                            {logoUrl && <Image source={{ uri: logoUrl }} style={styles.providerLogo} contentFit="cover" />}
                          </Glass>
                          <Text numberOfLines={1} variant="muted" style={styles.providerName}>
                            {provider.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              <Pressable style={styles.watchButton} onPress={handleWatchNow}>
                <Feather name="play" size={16} color={colors.background} />
                <Text style={styles.watchButtonText}>{t("whatToWatch.watchNow")}</Text>
              </Pressable>

              <Pressable style={styles.anotherButton} onPress={handleAnotherSuggestion} hitSlop={8}>
                <Feather name="refresh-cw" size={14} color={colors.muted} />
                <Text variant="muted" style={styles.anotherButtonText}>
                  {t("whatToWatch.anotherSuggestion")}
                </Text>
              </Pressable>
            </>
          )}
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: scrim.modal },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  title: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  // REDUZIDO (2026-10-17, feedback de revisão — "reduzir um pouco o
  // pôster e os espaços verticais, há uma área vazia grande abaixo de
  // 'Outra sugestão'") — era 55%; num pôster 2:3 isso ocupava quase
  // metade da altura da folha sozinho, empurrando tudo pra baixo e
  // deixando a folha inteira mais alta (mais "vazio" visual no fim),
  // mesmo sem nenhum elemento extra.
  posterWrapper: {
    width: "42%",
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
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
  /**
   * REMOVIDO (2026-10-16) — selo de nota sobre o pôster
   * (`ratingBadge`/`ratingBadgeText`); ver comentário no JSX acima.
   */
  /**
   * NOVO (2026-10-17, Opção 7 — linha isolada número grande + estrelas,
   * acima do título) — ver JSX acima pra racional completo.
   */
  ratingInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  ratingInlineNumber: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.text,
  },
  movieTitle: {
    // REDUZIDO (2026-10-17, mesmo pedido de espaçamento) — era spacing.md.
    marginTop: spacing.sm,
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  meta: {
    marginTop: 2,
  },
  /**
   * REDESENHADO (2026-10-17, Opção 10 do mockup de 10 opções — "frase
   * do motivo muito pequena, corrija") — ver JSX acima pra racional
   * completo. Card próprio com fundo `colors.surface`, em vez de texto
   * solto sem destaque.
   */
  reasonCard: {
    // CORRIGIDO (a pedido, comparando com a Opção 10 original do
    // mockup de 10 opções — "tinha uma sombra por trás... e nesse
    // novo não tem") — a implementação tinha saído sem sombra; a
    // Opção 10 aprovada tinha. `elevation.low`, mesma receita já usada
    // no card do pôster (`PosterGrid.tsx`, `styles.card`) — não é
    // sombra nova, é a que faltou aqui.
    ...elevation.low,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  reasonIcon: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  reasonText: {
    // CORRIGIDO (a pedido — "a frase está alinhada para a esquerda,
    // deve estar centralizada igual o restante") — `flex: 1` sozinho
    // deixa o texto ocupar o espaço inteiro mas alinhado à ESQUERDA
    // dentro dele (padrão do RN); `textAlign: "center"` centraliza de
    // verdade, igual ao resto da folha (`movieTitle`/`meta` já usam
    // `textAlign: "center"`). `justifyContent: "center"` no
    // `reasonCard` (acima) também centraliza o CONJUNTO ícone+texto
    // quando a frase é curta o bastante pra não ocupar a largura
    // inteira — sem isso, o ícone ficaria colado na borda esquerda
    // mesmo com o texto centralizado dentro do seu próprio espaço.
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  /**
   * NOVO (2026-10-17, "onde assistir" na folha) — mesma estrutura de
   * `SeriesWatchProviders.tsx`, adaptada pro espaço mais apertado da
   * folha (`gap`/tamanhos menores, label e linha CENTRALIZADOS em vez
   * de alinhados à esquerda — a folha inteira já é centralizada).
   */
  providersBlock: {
    alignSelf: "stretch",
    marginTop: spacing.md,
  },
  providersLabel: {
    fontSize: fontSize.xs,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  providersRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm + 2,
  },
  providerItem: {
    width: 44,
    alignItems: "center",
    gap: 4,
  },
  providerLogoWrapper: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  providerLogo: {
    width: "100%",
    height: "100%",
  },
  providerName: {
    fontSize: fontSize.micro,
    textAlign: "center",
  },
  watchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    // REDUZIDO (2026-10-17, mesmo pedido de espaçamento) — era spacing.lg.
    marginTop: spacing.md,
  },
  watchButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  anotherButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    // REDUZIDO (2026-10-17, mesmo pedido de espaçamento) — era spacing.md.
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  anotherButtonText: {
    fontSize: fontSize.sm,
  },
});
