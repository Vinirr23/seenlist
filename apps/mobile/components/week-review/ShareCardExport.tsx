import { forwardRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { StarRating } from "@/components/ui/StarRating";

/**
 * ShareCardExport — a view que EXISTE SÓ PRA SER CAPTURADA, não pra ser
 * exibida na navegação normal do app (2026-09-23, primeira implementação
 * real da imagem de Compartilhar, depois de várias rodadas de mockup
 * visual — ver `claude/mockup-week-review-imagem-compartilhar-v2026-09-23.html`
 * no projeto pra o histórico completo das decisões de design).
 *
 * DECISÃO CONFIRMADA COM O USUÁRIO (não assumida): a UI que aparece na
 * tela do Week Review (com o seletor "qual é a sua semana", botão
 * "trocar", chips de teste etc.) é bem diferente da imagem final que foi
 * fechada como direção visual (Variante B do mockup) — não dá pra tirar
 * um "print" da tela normal. Por isso este componente existe separado:
 * ele reproduz EXATAMENTE a Variante B fechada (marca SeenList, CTA "E a
 * sua semana?", card de stats com borda, SEM nenhum elemento de UI
 * interativa do app) e é montado fora da tela (ver uso em
 * `week-review-test.tsx`) só pra ser capturado com
 * `react-native-view-shot` quando o usuário aperta "Compartilhar".
 *
 * Direção visual fechada, porte 1:1 do mockup (rodadas 13 a 18 da sessão
 * 2026-09-23):
 *   - Hierarquia: frase (herói) → título/temporada (contexto pequeno) →
 *     nota → card de stats (discreto, mas legível) → marca + CTA.
 *   - Título reduzido a rótulo pequeno em caps (18px), frase grande e
 *     em destaque (21px/800) — é o elemento dominante da peça.
 *   - Card de stats: card único com borda arredondada, ícone no topo de
 *     cada coluna, número grande (16px/900) mais pesado que o label
 *     (9px), divisórias finas entre as 3 colunas.
 *   - SEM botões de loja (Apple/Google Play) — decisão do usuário:
 *     "isso deixava a peça mais perto de propaganda de app do que de
 *     post pessoal". CTA "E a sua semana?" no lugar, sem emoji.
 *   - SEM domínio/link (nem "seenlist.app") — "quanto menos parecer
 *     aquisição disfarçada, maior a chance de o usuário compartilhar".
 *
 * Valores de tipografia/cor portados 1:1 do mockup HTML (tokens
 * `--cream`/`--warm-gray`/`--work-magenta`/`--amber-2`, os mesmos já
 * usados no hero de `week-review-test.tsx`).
 *
 * DOIS "HERÓIS" POSSÍVEIS (rodada 31, 2026-09-23) — a tela de teste
 * (`week-review-test.tsx`) continua usando uma FRASE fixa por caso
 * (`quote`, comportamento intocado desde a rodada 13). A tela real
 * (`week-review.tsx`) trocou a frase gerada por IA por um elemento
 * determinístico — "recorde pessoal" (quantos episódios/filmes da
 * obra em destaque o usuário assistiu essa semana) + selo de
 * sequência opcional — depois de uma sessão inteira de problemas reais
 * com a API do Gemini (rate limit, latência, respostas cortadas, texto
 * "sem graça"). Este componente decide qual dos dois heróis desenhar
 * pela presença de `quote`: quando vem preenchida, é o caminho antigo
 * (tela de teste); quando vem vazia/ausente e `heroValue` existe, é o
 * caminho novo (tela real). Nenhuma mudança pro comportamento já
 * validado da tela de teste.
 */

export type ShareCardExportProps = {
  /** URL do backdrop real do TMDB (mesma fonte que o hero da tela). */
  backdropUrl: string;
  /** Título da obra (já em maiúsculas ou não — este componente converte). */
  title: string;
  /** "Temporada 2", por exemplo — omitido pra filme (mesma regra do hero). */
  seasonLabel?: string;
  /**
   * Nota em escala 0-5 (meio-passo), a mesma da tabela `reviews` —
   * NÃO é a escala 0-10 do TMDB. Quem chama este componente é
   * responsável por já converter pra essa escala antes.
   */
  rating: number | null;
  /**
   * Frase escolhida pelo usuário no seletor de humor — SÓ usada pela
   * tela de teste (`week-review-test.tsx`). Omitida/vazia na tela
   * real, que usa `heroValue`/`heroUnitLabel`/`streakLabel` no lugar
   * (ver comentário grande acima).
   */
  quote?: string;
  /**
   * "Recorde pessoal" (rodada 31) — o número grande que substitui a
   * frase na tela real: `highlight.activityCount`, quantos
   * episódios/filmes da obra em destaque o usuário assistiu essa
   * semana. Só usado quando `quote` não vem preenchida.
   */
  heroValue?: number;
  /** Unidade já pluralizada de `heroValue` (ex.: "episódios", "filme") — texto pronto, sem i18n aqui dentro. */
  heroUnitLabel?: string;
  /** Rótulo pequeno acima do número (ex.: "SEU RECORDE DA SEMANA") — texto pronto, sem i18n aqui dentro. */
  heroRecordLabel?: string;
  /**
   * Selo de sequência opcional (ex.: "3ª semana seguida com Blue
   * Exorcist") — texto pronto, sem o emoji (o componente prepende
   * "🔥 " sozinho, mesmo padrão do badge "🏆 Destaque da semana" já
   * hardcoded aqui). `undefined`/vazio some da peça — não há sequência
   * real na maioria das semanas, e isso é esperado, não um erro.
   */
  streakLabel?: string;
  stats: { episodes: number; movies: number; series: number };
  /**
   * Rótulos já pluralizados/traduzidos dos 3 stats (ex.: "episódios",
   * "episodes" — depende do idioma ativo do app) — texto pronto, sem
   * i18n aqui dentro, MESMO padrão de `heroUnitLabel`/`heroRecordLabel`.
   *
   * Correção de bug (2026-09-24): antes deste ponto os 3 rótulos eram
   * fixos em português direto no componente (função `pluralizeStat`
   * local, removida) — uma lacuna que existia desde a primeira versão
   * deste componente (rodada 19, antes do resto da tela ser traduzido)
   * e nunca tinha sido corrigida. Isso fazia o card final misturar
   * idiomas de verdade: o recorde pessoal/temporada (traduzidos via
   * `t()` em `week-review.tsx`) refletiam o idioma real do app, mas o
   * card de stats abaixo sempre aparecia em português, não importa o
   * idioma. As chaves de tradução (`weekReview.episodeSingular/Plural`
   * etc.) já existiam nos 3 idiomas desde a rodada 26 — só faltava
   * passá-las como prop em vez de hardcode.
   */
  statEpisodeLabel: string;
  statMovieLabel: string;
  statSeriesLabel: string;
  /**
   * Eyebrow, badge e CTA do rodapé — texto pronto, sem i18n aqui dentro,
   * MESMO padrão dos outros textos deste componente.
   *
   * Correção de bug (2026-09-24, rodada 34): estes 3 textos eram fixos
   * em português direto no componente ("SUA SEMANA NO SEENLIST" /
   * "🏆 Destaque da semana" / "E a sua semana?") desde a criação dele
   * (rodada 19) — um resquício que sobrou mesmo depois do fix da
   * rodada 33 ter corrigido os rótulos de stats. As chaves de tradução
   * de eyebrow/badge já existiam desde a rodada 26 (usadas na tela
   * visível); só faltava passá-las pra cá também, e criar a chave nova
   * `weekReview.shareCta` (não existia ainda).
   */
  eyebrowLabel: string;
  badgeLabel: string;
  shareCtaLabel: string;
  /**
   * Largura BASE do card (não a resolução final do PNG exportado) — a
   * captura em `week-review-test.tsx` usa `pixelRatio: 3` sobre esta
   * largura, então 360 vira ~1080px de largura no arquivo final (padrão
   * Stories/Reels, 1080×1920 em 9:16). Ver comentário no ponto de
   * captura pra mais detalhes.
   */
  width?: number;
};

export const ShareCardExport = forwardRef<View, ShareCardExportProps>(function ShareCardExport(
  {
    backdropUrl,
    title,
    seasonLabel,
    rating,
    quote,
    heroValue,
    heroUnitLabel,
    heroRecordLabel,
    streakLabel,
    stats,
    statEpisodeLabel,
    statMovieLabel,
    statSeriesLabel,
    eyebrowLabel,
    badgeLabel,
    shareCtaLabel,
    width = 360,
  },
  ref,
) {
  const height = width * (16 / 9);
  const titleLine = seasonLabel ? `${title.toUpperCase()} · ${seasonLabel.toUpperCase()}` : title.toUpperCase();

  return (
    <View ref={ref} collapsable={false} style={[styles.frame, { width, height }]}>
      <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      {/* bd-vignette */}
      <LinearGradient
        colors={["transparent", "transparent", "rgba(4,2,12,0.55)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* bd-tint */}
      <LinearGradient
        colors={["rgba(76,42,140,0.16)", "rgba(201,63,176,0.10)", "transparent"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* bd-topfade */}
      <LinearGradient colors={["rgba(6,4,16,0.42)", "transparent"]} style={styles.topfade} />
      {/* bd-botfade */}
      <LinearGradient
        colors={["rgba(5,3,14,0.99)", "rgba(5,3,14,0.94)", "rgba(5,3,14,0.55)", "transparent"]}
        locations={[0, 0.24, 0.56, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={styles.botfade}
      />

      <Text style={styles.eyebrow}>{eyebrowLabel}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badgeLabel}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {titleLine}
        </Text>
        {rating != null && (
          <View style={styles.ratingRow}>
            <StarRating rating={rating} size={12} />
          </View>
        )}
        {quote ? (
          <View style={styles.quoteRow}>
            <Text style={styles.quoteMark}>"</Text>
            <Text style={styles.quoteText}>{quote}</Text>
          </View>
        ) : heroValue != null ? (
          <View style={styles.heroStat}>
            {streakLabel && (
              <View style={styles.streakPill}>
                <Text style={styles.streakPillText}>🔥 {streakLabel}</Text>
              </View>
            )}
            {heroRecordLabel && <Text style={styles.recordLabel}>{heroRecordLabel}</Text>}
            <View style={styles.recordNumberRow}>
              <Text style={styles.recordNumber}>{heroValue}</Text>
              {heroUnitLabel && <Text style={styles.recordUnit}>{heroUnitLabel}</Text>}
            </View>
          </View>
        ) : null}

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Feather name="tv" size={16} color="#FBF7EF" style={styles.statIcon} />
            <Text style={styles.statNum}>{stats.episodes}</Text>
            <Text style={styles.statLabel}>{statEpisodeLabel}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="film" size={16} color="#FBF7EF" style={styles.statIcon} />
            <Text style={styles.statNum}>{stats.movies}</Text>
            <Text style={styles.statLabel}>{statMovieLabel}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="bar-chart-2" size={16} color="#FBF7EF" style={styles.statIcon} />
            <Text style={styles.statNum}>{stats.series}</Text>
            <Text style={styles.statLabel}>{statSeriesLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.brandRow}>
          <Image source={require("@/assets/images/logo.png")} style={styles.logo} />
          <Text style={styles.wordmark}>SeenList</Text>
        </View>
        <Text style={styles.cta}>{shareCtaLabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0c0620",
    position: "relative",
  },
  topfade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "26%",
  },
  botfade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "66%",
  },
  eyebrow: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#C9BFD6",
    opacity: 0.85,
  },
  badge: {
    position: "absolute",
    top: 48,
    left: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#E8A33D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1c1206",
  },
  // A Variante B do mockup recalculou esse offset na rodada 6 (causa
  // raiz: o rodapé encolheu quando os stats saíram dele, mas o offset
  // do conteúdo não tinha sido recalculado junto) — 64px, não 108px.
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 64,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#C9BFD6",
    opacity: 0.9,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  quoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 14,
    paddingRight: "2%",
  },
  quoteMark: {
    fontSize: 24,
    fontWeight: "900",
    color: "#c93fb0",
    marginTop: 2,
  },
  quoteText: {
    flex: 1,
    fontSize: 21,
    fontWeight: "800",
    fontStyle: "italic",
    color: "#FBF7EF",
    lineHeight: 26,
  },
  // "Recorde pessoal" + selo de sequência (rodada 31) — mesma posição
  // que a frase ocupava (dentro do bloco de conteúdo, logo abaixo da
  // nota), tamanhos pensados pra ocupar espaço visual parecido ao da
  // frase (21px) sem depender de texto que pode quebrar em 2 linhas —
  // primeira versão, ainda não testada num export real capturado no
  // aparelho (mesmo processo iterativo de sempre: implementar →
  // testar → ajustar pela causa raiz do que estiver errado).
  heroStat: {
    marginTop: 14,
  },
  streakPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "rgba(232,163,61,0.18)",
    borderWidth: 1,
    borderColor: "rgba(232,163,61,0.45)",
    marginBottom: 8,
  },
  streakPillText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#F0A94F",
  },
  recordLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#C9BFD6",
    opacity: 0.8,
  },
  recordNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 2,
  },
  recordNumber: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FBF7EF",
    letterSpacing: -0.5,
  },
  recordUnit: {
    fontSize: 15,
    fontWeight: "800",
    color: "#C9BFD6",
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  statIcon: {
    opacity: 0.85,
  },
  statNum: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FBF7EF",
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#C9BFD6",
    opacity: 0.85,
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  logo: {
    width: 20,
    height: 20,
  },
  wordmark: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FBF7EF",
    letterSpacing: -0.2,
  },
  cta: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#C9BFD6",
  },
});
