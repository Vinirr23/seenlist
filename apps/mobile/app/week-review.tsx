import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Screen, GlassTargetProvider, AmbientGlow, Glass } from "@/components/ui";
import { buildWeekReviewGlowBlobs } from "@/lib/glowBlobs";
import { StarRating } from "@/components/ui/StarRating";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { fetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchMovieDetails } from "@/lib/movieDetails";
import { tmdbImageUrl } from "@/lib/library";
import { ShareCardExport } from "@/components/week-review/ShareCardExport";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { computeWeekHighlight, type WeekHighlight, type WeekStats } from "@/lib/weekHighlight";

/**
 * Week Review — TELA REAL DE PRODUÇÃO (2026-09-23, rodada 26 da sessão
 * "week-review-teste-glass-e-icones").
 *
 * Substitui a tela de teste (`app/week-review-test.tsx`, que continua
 * existindo — decisão do usuário, "manter por enquanto" — pra validar
 * layout com outro backdrop se precisar de novo) com dados de verdade:
 * `computeWeekHighlight` (`lib/weekHighlight.ts`, rodada 25) decide QUAL
 * obra é o destaque da semana; esta tela busca o backdrop/título reais
 * dessa obra no TMDB e monta o mesmo hero/card de Compartilhar já
 * validados pixel a pixel na tela de teste — nenhum redesenho aqui, só
 * porte pra dado real no lugar de caso fixo. O elemento de destaque do
 * hero (recorde pessoal + selo de sequência opcional, sem IA) é
 * explicado no comentário grande mais abaixo (rodada 31).
 *
 * DECISÕES CONFIRMADAS COM O USUÁRIO (via `AskUserQuestion`, não
 * assumidas):
 * 1. Ponto de entrada — a notificação push de domingo (que abriria
 *    esta tela em produção) ainda não existe; por enquanto, um botão
 *    temporário em `app/(tabs)/profile.tsx` leva aqui (ver comentário
 *    lá).
 * 2. Estado vazio (sem nenhum destaque essa semana — conta nova ou sem
 *    atividade) — `EmptyShelf` dedicado, mesmo padrão usado no resto
 *    do app, em vez de tentar montar um card vazio.
 * 3. Idioma — UI traduzida (`t()`, chaves `weekReview.*` em
 *    `translations.ts`, pt/en/es).
 *
 * O que NÃO está aqui ainda (fora de escopo desta rodada, ver
 * pendências do doc da sessão): notificação push de domingo, toggle em
 * Configurações.
 *
 * COR DOMINANTE DO BACKDROP (pendência atacada logo depois da rodada
 * 29) — o glow ambiente (`AmbientGlow`) usa `buildWeekReviewGlowBlobs`
 * (`lib/glowBlobs.ts`) em vez do array fixo direto. Quando a linha
 * pré-gerada da semana tem `dominant_color` (calculado no servidor,
 * ver `week-review-pregenerate`), o glow é derivado dessa cor; sem
 * cache, sem coluna preenchida, ou no caminho ao vivo (sem
 * pré-geração), cai pro violeta/magenta fixo de sempre — nunca quebra.
 * Escopo confirmado com o usuário: só o glow, não o tint/borda/aspas.
 *
 * "HERÓI" DO CARD — SEM IA (2026-09-23, rodada 31) — de rodada 23 até a
 * rodada 30, o elemento de destaque do card (a "frase") era gerado ao
 * vivo ou pré-gerado por uma IA (Google Gemini). Depois de uma sessão
 * inteira de problemas reais e recorrentes (rate limit 429 por cota
 * gratuita esgotada, respostas cortadas, latência alta mesmo com
 * pré-geração, texto "sem graça" mesmo com o prompt reforçado da
 * rodada 27, e por fim um "Couldn't generate new phrases right now"
 * visível na tela pro próprio usuário), o usuário decidiu substituir a
 * frase por um elemento 100% determinístico — sem rede, sem IA, sem
 * espera — calculado a partir de dados que a tela já tem:
 *
 *   1. "Recorde pessoal" — `highlight.activityCount`, quantos
 *      episódios/filmes da obra em destaque o usuário assistiu essa
 *      semana. Sempre existe (vem de `computeWeekHighlight`, que
 *      continua rodando sempre, ao vivo).
 *   2. Selo de sequência (opcional) — quantas semanas seguidas a mesma
 *      obra foi o destaque (`streakWeeks`), calculado no SERVIDOR
 *      durante a pré-geração semanal (`week-review-pregenerate`,
 *      `computeStreakWeeks`) e lido do cache (`tryCachedWeekReviewData`
 *      abaixo) — só aparece quando >= 2 (sem sequência real, o selo
 *      simplesmente não aparece, sem texto forçado tipo "1ª semana").
 *
 * Direção escolhida entre mockups visuais comparando várias opções
 * ("Combinação A": recorde como elemento fixo, sequência como selo de
 * apoio só quando existe). A seção "QUAL DESSAS É A SUA SEMANA?" (mood
 * picker + "Gerar outras") foi removida por completo — não fazia mais
 * sentido escolher entre opções de texto que não existem mais. A Edge
 * Function `week-review-generate` e o módulo `_shared/weekReviewPhrases.ts`
 * não são mais chamados por nada neste projeto.
 */

function pluralizeStatLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  n: number,
  singularKey: string,
  pluralKey: string,
): string {
  return n === 1 ? t(singularKey) : t(pluralKey);
}

export default function WeekReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loadingHighlight, setLoadingHighlight] = useState(true);
  const [highlightError, setHighlightError] = useState(false);
  const [highlight, setHighlight] = useState<WeekHighlight | null>(null);
  const [stats, setStats] = useState<WeekStats>({ episodes: 0, movies: 0, series: 0 });

  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [streakWeeks, setStreakWeeks] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const exportRef = useRef<View>(null);

  const weekReviewGlowBlobs = useMemo(() => buildWeekReviewGlowBlobs(dominantColor), [dominantColor]);

  /**
   * Busca o destaque real da semana. Extraída (não só um `useEffect`
   * inline) porque o estado de erro precisa de um botão "Tentar de
   * novo" que rechama exatamente esta mesma busca — `EmptyShelf` já
   * suporta `onPress` pra isso, sem precisar de um componente próprio.
   */
  const loadHighlight = useCallback(() => {
    if (!userId) return;
    setLoadingHighlight(true);
    setHighlightError(false);
    computeWeekHighlight(supabase, userId)
      .then((data) => {
        setHighlight(data.highlight);
        setStats(data.stats);
      })
      .catch((err) => {
        console.warn("[week-review] falha ao calcular o destaque da semana", err);
        setHighlightError(true);
      })
      .finally(() => setLoadingHighlight(false));
  }, [userId]);

  useEffect(() => {
    loadHighlight();
  }, [loadHighlight]);

  /**
 * Checa se já existe uma linha pré-gerada (job semanal
 * `week-review-pregenerate`) pra EXATAMENTE a obra/temporada do
 * destaque calculado agora — ver comentário grande no topo do arquivo
 * sobre por que a comparação precisa ser exata (nunca confiar cego na
 * linha em cache). Retorna `null` em qualquer caso de "não usar cache"
 * (sem linha, obra diferente, erro de rede) — nesse caso `dominantColor`
 * e `streakWeeks` simplesmente ficam nos valores neutros (glow fixo,
 * sem selo de sequência); o "recorde pessoal" em si (`highlight.activityCount`)
 * não depende do cache, vem sempre do cálculo ao vivo.
 */
type CachedWeekReviewData = { dominantColor: string | null; streakWeeks: number | null };

async function tryCachedWeekReviewData(userId: string, highlight: WeekHighlight): Promise<CachedWeekReviewData | null> {
  try {
    const { data, error } = await supabase
      .from("week_review_pregenerated")
      .select("season_number, week_start, week_end, dominant_color, streak_weeks")
      .eq("user_id", userId)
      .eq("media_type", highlight.mediaType)
      .eq("media_id", highlight.mediaId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    if ((data.season_number ?? null) !== (highlight.seasonNumber ?? null)) return null;

    // Sanidade extra: a linha precisa ser de uma janela que ainda faz
    // sentido "agora" — só pra não usar uma linha muito antiga de um
    // job que nunca rodou de novo (folga de 1 dia pra cima/baixo,
    // margem pro fuso fixo em Brasília que o job usa não bater 100%
    // com o horário local exato do aparelho).
    const now = Date.now();
    const weekStart = new Date(data.week_start).getTime();
    const weekEnd = new Date(data.week_end).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (now < weekStart - oneDayMs || now >= weekEnd + oneDayMs) return null;

    const dominantColor = typeof data.dominant_color === "string" ? data.dominant_color : null;
    const streakWeeks = typeof data.streak_weeks === "number" ? data.streak_weeks : null;
    return { dominantColor, streakWeeks };
  } catch (err) {
    console.warn("[week-review] falha ao checar cache pré-gerado, seguindo com os valores neutros", err);
    return null;
  }
}

  useEffect(() => {
    if (!highlight) return;
    let cancelled = false;
    setBackdropUrl(null);
    setDominantColor(null);
    setStreakWeeks(null);
    setLoadError(false);

    const mediaIdStr = String(highlight.mediaId);
    const fetchDetails = highlight.mediaType === "movie" ? fetchMovieDetails(mediaIdStr) : fetchSeriesDetails(mediaIdStr);
    fetchDetails
      .then(async (details) => {
        if (cancelled) return;
        const url = tmdbImageUrl(details.backdropPath, "w1280") ?? tmdbImageUrl(details.posterPath, "w780");
        setTitle(details.title);
        if (!url) {
          setLoadError(true);
          return;
        }
        setBackdropUrl(url);

        // Cor dominante (rodada 30) e selo de sequência (rodada 31) vêm
        // só do cache pré-gerado — nenhum dos dois é recalculado ao
        // vivo (ver comentário grande no topo do arquivo). Sem cache
        // (linha ausente, obra divergente, erro), os dois ficam nos
        // valores neutros: glow fixo e sem selo de sequência.
        const cached = userId ? await tryCachedWeekReviewData(userId, highlight) : null;
        if (cancelled) return;
        if (cached) {
          setDominantColor(cached.dominantColor);
          setStreakWeeks(cached.streakWeeks);
        }
      })
      .catch((err) => {
        console.warn("[week-review] falha ao buscar backdrop real do TMDB", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.mediaId, highlight?.mediaType, highlight?.seasonNumber]);

  async function handleShare() {
    if (!exportRef.current || !backdropUrl || sharing) return;
    try {
      setSharing(true);
      const uri = await captureRef(exportRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        // Mesma resolução da tela de teste (~1080×1920, padrão
        // Stories/Reels) — ver comentário equivalente em
        // `week-review-test.tsx` sobre por que não é `pixelRatio`
        // nesta versão do `react-native-view-shot`.
        width: 1080,
        height: 1920,
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        console.warn("[week-review] Sharing não disponível nesta plataforma/simulador.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: t("weekReview.share"),
      });
    } catch (err) {
      console.warn("[week-review] falha ao gerar/compartilhar a imagem", err);
    } finally {
      setSharing(false);
    }
  }

  const seasonLabelForHero =
    highlight && highlight.mediaType === "series" && highlight.seasonNumber != null
      ? t("weekReview.seasonLabel", { n: highlight.seasonNumber })
      : undefined;

  // "Recorde pessoal" + selo de sequência (rodada 31) — ver comentário
  // grande no topo do arquivo. `heroUnitLabel` usa as mesmas chaves de
  // pluralização já usadas nos stat chips (nenhuma chave nova pra
  // unidade). O selo de sequência só existe com `streakWeeks >= 2` E
  // título já carregado (o texto do selo cita o título).
  const heroUnitLabel =
    highlight && highlight.mediaType === "series"
      ? pluralizeStatLabel(t, highlight.activityCount, "weekReview.episodeSingular", "weekReview.episodePlural")
      : highlight
        ? pluralizeStatLabel(t, highlight.activityCount, "weekReview.movieSingular", "weekReview.moviePlural")
        : "";
  const streakLabel = streakWeeks != null && streakWeeks >= 2 && title ? t("weekReview.streakLabel", { n: streakWeeks, title }) : undefined;

  return (
    <Screen padded={false} style={[styles.screen, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t("weekReview.eyebrow")}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.closeBtn}>
          <Feather name="x" size={14} color="#F2F2F2" />
        </Pressable>
      </View>

      {loadingHighlight ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color="#F0A94F" size="large" />
        </View>
      ) : highlightError ? (
        <View style={styles.centerFill}>
          <EmptyShelf icon="alert-circle" message={t("weekReview.errorMessage")} actionLabel={t("weekReview.retry")} onPress={loadHighlight} />
        </View>
      ) : !highlight ? (
        <View style={styles.centerFill}>
          <EmptyShelf icon="calendar" message={t("weekReview.emptyMessage")} actionLabel={t("nav.explore")} actionHref="/(tabs)/explore" />
        </View>
      ) : (
        <>
          <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={weekReviewGlowBlobs} />}>
            <View style={styles.heroCard}>
              {backdropUrl ? (
                <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, styles.heroLoading]}>
                  {loadError ? (
                    <Text style={styles.heroLoadingText}>{t("weekReview.loadErrorText")}</Text>
                  ) : (
                    <ActivityIndicator color="#F0A94F" />
                  )}
                </View>
              )}

              <LinearGradient
                colors={["rgba(76,42,140,0.16)", "rgba(201,63,176,0.08)", "transparent"]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={["transparent", "transparent", "rgba(5,3,14,0.55)", "rgba(5,3,14,0.97)"]}
                locations={[0, 0.5, 0.78, 1]}
                style={styles.heroBotfade}
              />
              <LinearGradient
                colors={["rgba(5,3,14,0.22)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.heroSideShade}
              />

              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t("weekReview.badge")}</Text>
              </View>

              <View style={styles.heroContent}>
                <Text style={styles.heroName} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.55}>
                  {(title ?? "").toUpperCase() || "…"}
                </Text>
                {seasonLabelForHero && <Text style={styles.heroSeason}>{seasonLabelForHero}</Text>}
                {highlight.rating != null && (
                  <View style={styles.ratingRow}>
                    <StarRating rating={highlight.rating} size={13} />
                  </View>
                )}
                {highlight.activityCount != null && (
                  <View style={styles.heroStat}>
                    {streakLabel && (
                      <View style={styles.streakPill}>
                        <Text style={styles.streakPillText}>🔥 {streakLabel}</Text>
                      </View>
                    )}
                    <Text style={styles.recordLabel}>{t("weekReview.recordLabel")}</Text>
                    <View style={styles.recordNumberRow}>
                      <Text style={styles.recordNumber}>{highlight.activityCount}</Text>
                      <Text style={styles.recordUnit}>{heroUnitLabel}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.statsStrip}>
              <Glass variant="card" rim style={styles.statChip}>
                <Feather name="tv" size={14} color="#4FD6E8" style={styles.statIcon} />
                <Text style={styles.statValue}>{stats.episodes}</Text>
                <Text style={styles.statLabel}>{pluralizeStatLabel(t, stats.episodes, "weekReview.episodeSingular", "weekReview.episodePlural")}</Text>
              </Glass>
              <Glass variant="card" rim style={styles.statChip}>
                <Feather name="film" size={14} color="#4FD6E8" style={styles.statIcon} />
                <Text style={styles.statValue}>{stats.movies}</Text>
                <Text style={styles.statLabel}>{pluralizeStatLabel(t, stats.movies, "weekReview.movieSingular", "weekReview.moviePlural")}</Text>
              </Glass>
              <Glass variant="card" rim style={styles.statChip}>
                <Feather name="bar-chart-2" size={14} color="#4FD6E8" style={styles.statIcon} />
                <Text style={styles.statValue}>{stats.series}</Text>
                <Text style={styles.statLabel}>{pluralizeStatLabel(t, stats.series, "weekReview.seriesSingular", "weekReview.seriesPlural")}</Text>
              </Glass>
            </View>

            <Pressable
              style={[styles.shareBtn, (sharing || !backdropUrl) && styles.shareBtnDisabled]}
              onPress={handleShare}
              disabled={sharing || !backdropUrl}
            >
              {sharing ? <ActivityIndicator color="#1c1206" size="small" /> : <Feather name="upload" size={15} color="#1c1206" />}
              <Text style={styles.shareBtnText}>{sharing ? t("weekReview.sharing") : t("weekReview.share")}</Text>
            </Pressable>
          </GlassTargetProvider>

          {backdropUrl && (
            <View style={styles.exportHost} pointerEvents="none">
              <ShareCardExport
                ref={exportRef}
                backdropUrl={backdropUrl}
                title={title ?? ""}
                seasonLabel={seasonLabelForHero}
                rating={highlight.rating}
                heroValue={highlight.activityCount}
                heroUnitLabel={heroUnitLabel}
                heroRecordLabel={t("weekReview.recordLabel")}
                streakLabel={streakLabel}
                stats={stats}
                // Correção (2026-09-24) — os rótulos do card de stats
                // dentro do export eram fixos em português, direto no
                // componente, mesmo quando o resto do card já vinha
                // traduzido daqui (bug real, visível no teste: card
                // misturando inglês com português). Reaproveita as
                // mesmas chaves já usadas na faixa de estatísticas
                // visível (statChip) logo acima.
                statEpisodeLabel={pluralizeStatLabel(t, stats.episodes, "weekReview.episodeSingular", "weekReview.episodePlural")}
                statMovieLabel={pluralizeStatLabel(t, stats.movies, "weekReview.movieSingular", "weekReview.moviePlural")}
                statSeriesLabel={pluralizeStatLabel(t, stats.series, "weekReview.seriesSingular", "weekReview.seriesPlural")}
                // Correção de bug (2026-09-24, rodada 34): eyebrow/badge/CTA
                // do card exportado eram fixos em português direto no
                // componente, mesmo achado do bug dos stats acima — reaproveita
                // as mesmas chaves já usadas na tela visível (eyebrow/badge do
                // topo desta tela) + a chave nova `weekReview.shareCta`.
                eyebrowLabel={t("weekReview.eyebrow")}
                badgeLabel={t("weekReview.badge")}
                shareCtaLabel={t("weekReview.shareCta")}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#0c0a16",
    paddingHorizontal: 16,
  },
  centerFill: {
    flex: 1,
    justifyContent: "center",
  },
  glassFill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: "#F0A94F",
    textTransform: "uppercase",
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  heroCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0c0620",
    borderWidth: 1,
    borderColor: "rgba(180,140,255,0.22)",
  },
  heroLoading: {
    backgroundColor: "#171233",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  heroLoadingText: {
    color: "#C9BFD6",
    fontSize: 12,
    textAlign: "center",
  },
  heroBotfade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  heroSideShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#E8A33D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#1c1206",
  },
  heroContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  heroName: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FBF7EF",
    letterSpacing: -0.5,
  },
  heroSeason: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DCD5E8",
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  // "Recorde pessoal" + selo de sequência (rodada 31) — substitui
  // quoteRow/quoteMark/quoteText (frase) e todo o bloco moodPicker*
  // (seletor de 3 opções + "Gerar outras"), removidos por completo
  // junto da geração de frase por IA. Ver comentário grande no topo do
  // arquivo.
  heroStat: {
    marginTop: 10,
  },
  streakPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(232,163,61,0.18)",
    borderWidth: 1,
    borderColor: "rgba(232,163,61,0.45)",
    marginBottom: 7,
  },
  streakPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#F0A94F",
  },
  recordLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#B6ADC7",
    opacity: 0.85,
  },
  recordNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
    marginTop: 2,
  },
  recordNumber: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FBF7EF",
    letterSpacing: -0.5,
  },
  recordUnit: {
    fontSize: 13,
    fontWeight: "800",
    color: "#C9BFD6",
  },
  statsStrip: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 3,
    borderRadius: 13,
    backgroundColor: "rgba(140,90,220,0.10)",
    borderColor: "rgba(160,140,220,0.18)",
  },
  statIcon: {
    marginBottom: 1,
    opacity: 0.85,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FBF7EF",
  },
  statLabel: {
    fontSize: 9,
    color: "#B6ADC7",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 13,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#E8A33D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1c1206",
  },
  shareBtnDisabled: {
    opacity: 0.55,
  },
  exportHost: {
    position: "absolute",
    top: 0,
    left: -9999,
  },
});
