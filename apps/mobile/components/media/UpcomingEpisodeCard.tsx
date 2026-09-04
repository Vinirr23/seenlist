import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { UpcomingEpisodeWithBadge, UpcomingBadge } from "@/lib/upcomingEpisodes";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/** Mesmas cores do web: PREMIERE e MAIS RECENTE em branco/preto, NOVO em amarelo (única das três que usa a cor da marca). */
const BADGE_LABEL_KEY: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "seriesHome.badge.premiere",
  novo: "seriesHome.badge.new",
  "mais-recente": "seriesHome.badge.latest",
  "em-breve": "seriesHome.badge.comingSoon",
};

const BADGE_COLORS: Record<Exclude<UpcomingBadge, null>, { background: string; text: string }> = {
  premiere: { background: "#FFFFFF", text: "#000000" },
  novo: { background: colors.primary, text: colors.background },
  "mais-recente": { background: "#FFFFFF", text: "#000000" },
  "em-breve": { background: colors.secondary, text: colors.background },
};

function isGenericEpisodeName(name: string, episodeNumber: number): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === `episódio ${episodeNumber}` || normalized === `episode ${episodeNumber}`;
}

/**
 * CORREÇÃO (bug real, reportado — "'em breve' não está igual a web",
 * 2026-09-04) — a rodada anterior (task #47) só tinha corrigido o
 * FORMATO do código ("S04E05" → "S04 · E05") e o `numberOfLines` do
 * título, mas deixou passar diferenças estruturais reais em relação a
 * `EmBreveSection.tsx` do web:
 *
 * 1. Pôster era 64×96 — web usa `h-20 w-[70px]` (70×80, mais largo e
 *    mais baixo). Corrigido pro valor exato do web.
 * 2. O selo (badge) tinha LINHA PRÓPRIA, entre o título e o código —
 *    quando ausente, o código "subia" pra logo abaixo do título,
 *    deixando cards com/sem selo com a informação em posições
 *    diferentes. O web já tinha corrigido exatamente esse mesmo bug
 *    (comentário lá: "eu padronizaria a posição das informações... o
 *    conteúdo se movimenta dependendo do badge") — o selo entrou na
 *    MESMA linha do código, à direita dele. Portado aqui: estrutura
 *    fixa [título] / [código (+selo, se tiver)] / [nome do episódio,
 *    se tiver], igual em todo card.
 * 3. Selo ficou menor/mais discreto (era do mesmo peso visual do
 *    código) — mesmo ajuste do web (padding/fonte menores).
 * 4. Nome da emissora sem limite de largura — web usa `max-w-[76px]
 *    truncate` pra não vazar com nomes longos.
 *
 * "Vidro" do card em si (blur/gradiente do web) DE PROPÓSITO não
 * entrou — isso é redesign, fora do escopo desta leva ("redesign =
 * vidro e botão geleia"). Mantido o estilo simples já usado
 * (`colors.surface` + borda), só a ESTRUTURA/tamanho foram alinhados.
 */
export function UpcomingEpisodeCard({ episode }: { episode: UpcomingEpisodeWithBadge }) {
  const router = useRouter();
  const { t } = useTranslation();
  const posterUrl = tmdbImageUrl(episode.posterPath, "w185");
  const badge = episode.badge ? { label: t(BADGE_LABEL_KEY[episode.badge]), ...BADGE_COLORS[episode.badge] } : null;
  const network = episode.networks[0] ?? null;
  const episodeCode = `S${String(episode.seasonNumber).padStart(2, "0")} · E${String(episode.episodeNumber).padStart(2, "0")}`;
  const hasRealEpisodeName = !!episode.name && !isGenericEpisodeName(episode.name, episode.episodeNumber);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/series/${episode.seriesId}`)}>
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <Feather name="film" size={20} color={colors.muted} />
        )}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.seriesTitle}>
          {episode.seriesTitle}
        </Text>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{episodeCode}</Text>
          {!!badge && (
            <View style={[styles.badge, { backgroundColor: badge.background }]}>
              <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          )}
        </View>
        {hasRealEpisodeName && (
          <Text numberOfLines={1} variant="muted" style={styles.episodeName}>
            {episode.name}
          </Text>
        )}
      </View>

      {episode.daysUntil >= 7 ? (
        <View style={styles.daysBlock}>
          <Text style={styles.daysNumber}>{episode.daysUntil}</Text>
          <Text variant="muted" style={styles.daysLabel}>
            {t("seriesHome.daysUntil")}
          </Text>
        </View>
      ) : (
        !!network && (
          <View style={styles.networkWrapper}>
            <Text numberOfLines={1} variant="muted" style={styles.network}>
              {network}
            </Text>
          </View>
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (fontes/espaçamento — mesma auditoria, "verifica tamanho
  // das fontes também, espaçamento e etc") — todo valor abaixo
  // conferido pixel a pixel contra `EmBreveSection.tsx` do web
  // (`gap-1.5`=6, `p-2.5`=10, `rounded-2xl`=16) — eram valores da
  // escala genérica (`spacing.sm`=8, `radius.md`=10), próximos mas
  // não iguais.
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 10,
  },
  posterWrapper: {
    width: 70,
    height: 80,
    // web: `rounded` (plain) = 4px — não `radius.sm` (6).
    borderRadius: 4,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    justifyContent: "center",
  },
  // web: `text-[15px]` — não `text-sm`/`fontSize.sm` (14).
  seriesTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  // web: `gap-1.5` = 6px entre código e selo — não `spacing.xs` (4).
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // web: `px-1 py-px` = 4px/1px.
  badge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  code: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  // web: `text-xs` = 12px — não 11.
  episodeName: {
    fontSize: fontSize.xs,
  },
  networkWrapper: {
    alignSelf: "center",
    maxWidth: 76,
  },
  network: {
    fontSize: fontSize.xs,
    textAlign: "right",
  },
  daysBlock: {
    alignSelf: "center",
    alignItems: "center",
  },
  daysNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 22,
  },
  daysLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
