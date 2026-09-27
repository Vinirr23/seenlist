import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { MovieDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass, GlassTargetProvider } from "@/components/ui";
import { colors, radius, spacing, elevation, fontSize } from "@/lib/theme";
// (fontSize e MaterialCommunityIcons saíram — a nota TMDB não aparece mais nesta header, ver comentário de redesenho abaixo)
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-10, achado numa auditoria pedida —
 * "você está sempre pulando os botões de cima e as folhas") — este
 * arquivo nunca tinha recebido a mesma passada de vidro que
 * `SeriesHeader.tsx` já tinha (mtime bem mais antigo que o resto da
 * pasta `movie-detail/`, nunca tocado nesta rodada inteira de portes).
 * Os dois botões (voltar/"...") eram círculos CHAPADOS
 * (`scrim.overImage`), sem o mesmo problema já resolvido em
 * `SeriesHeader.tsx` ("os botões não estão transparentes" — ver o
 * comentário completo lá pra causa raiz): um `Glass` sem alvo próprio
 * usava o contexto do `GlassTargetProvider` da TELA (campo de manchas
 * sobre base opaca), nunca a capa em si. Mesmo fix: `GlassTargetProvider`
 * LOCAL com `base="transparent"` e a capa como `background` — os
 * `Glass` de dentro passam a desfocar a foto de verdade, igual ao web.
 *
 * Também estava faltando: o véu era chapado (agora é degradê, igual
 * ao web `bg-gradient-to-t from-background via-background/70
 * to-background/10`); a capa era `w780`/180 de altura (web é `h-56` =
 * 224, mesma correção de resolução já aplicada em `SeriesHeader.tsx`);
 * e a caixa do pôster era um retângulo sólido — no web
 * (`rounded-lg border border-white/10 backdrop-blur-[14px]
 * backdrop-saturate-[180%]` + brilho 0.16/base 0.09) é a receita
 * `medium` do `Glass`.
 *
 * REDESENHO (mockup aprovado 2026-09-25, referência de outro app) —
 * mudanças pedidas pelo usuário nesta rodada:
 * 1. Nota (★ TMDB) SAIU daqui — não aparecia na referência; confirmado
 *    explicitamente ("a nota pode tirar do header").
 * 2. Linha de meta virou "duração · gêneros" numa linha só (era
 *    "ano · duração" + linha separada de gêneros) — o ano já aparece
 *    no chip de data de lançamento logo abaixo, não precisa repetir.
 * 3. Nova linha de metadados (calendário+lançamento, olho+"quando você
 *    assistiu", círculo de check) substitui os 2 botões antigos
 *    (Assistido/Assistir depois, `MovieActions.tsx`) — tocar no
 *    círculo agora É a ação de marcar/desmarcar assistido (mesmo
 *    papel do botão "Assistido" antigo, incluindo abrir "Marcar
 *    como..." quando já assistido — lógica em `app/movies/[id].tsx`,
 *    que é quem decide o que `onTogglePress` faz).
 * 4. O selo "Assistido" sobre o pôster saiu — ficaria redundante com o
 *    check da nova linha de metadados, bem mais visível.
 * 5. "Assistir depois" e "Favoritar" saíram da tela inteira, foram
 *    pro sheet "···" (`MovieQuickActionsSheet.tsx`) — pedido explícito
 *    do usuário.
 *
 * BUG REAL (2026-09-25, teste no aparelho, print real) — o pôster
 * pequeno do lado do título (`headerRow`/`posterWrapper` abaixo)
 * ficou de pé nesta rodada, mas a referência NÃO tem esse pôster
 * (usuário confirmou olhando o app rodando: "acredito que se tirar o
 * poster menor a referencia não tem ele) as informações vão encaixar
 * melhor"). Com o pôster de 96px espremendo a coluna de texto, o
 * título/meta quebravam e o círculo de check (26px) ficava pequeno
 * demais pra notar. Removido — título/meta agora ficam sobre a
 * própria capa (mesmo padrão de `SeriesHeader.tsx`: bloco de texto
 * `position: "absolute"` dentro do `GlassTargetProvider`, sem coluna
 * dividida com pôster), com a largura inteira da tela disponível.
 *
 * Também corrigido: o círculo de check "pendente" (não assistido)
 * usava `borderColor: colors.muted` (cinza apagado, quase some sobre
 * fundo escuro) — pedido explícito: "deve ficar branco e quando for
 * marcado assistido é pra ficar verde". `colors.success` (verde) já
 * estava certo pro estado assistido; só o pendente trocou pra branco.
 */
export function MovieHeader({
  movie,
  status,
  watchedAt,
  busy,
  onTogglePress,
  onMorePress,
}: {
  movie: MovieDetails;
  status: "watched" | "want_to_watch" | "watching" | null;
  watchedAt: string | null;
  busy: boolean;
  onTogglePress: () => void;
  onMorePress: () => void;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const backdropUrl = tmdbImageUrl(movie.backdropPath, "w1280"); // era `w780` — o web usa `w1280`, esticado até 1080px de tela ficava macio
  const watched = status === "watched";

  // Mesma receita de `Intl.DateTimeFormat` já usada em várias telas do
  // app (`profile/comments.tsx`, `notifications.tsx` etc.) — SEGURA,
  // diferente de `Intl.NumberFormat({ notation: "compact" })`, que já
  // derrubou o Feed em produção (ver comentário em `SeriesHeader.tsx`).
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" });
  const releaseDateLabel = movie.releaseDate ? dateFormatter.format(new Date(movie.releaseDate)) : null;
  const watchedDateLabel = watched && watchedAt ? dateFormatter.format(new Date(watchedAt)) : null;
  /**
   * A PEDIDO (2026-09-25, teste no aparelho — "ele se move ao marcar,
   * deixa ele no mesmo lugar que ele vai ao marcar assistido, não
   * precisa do movimento") — o chip "olho + data" só existia (só
   * ocupava espaço na linha) DEPOIS de marcar assistido; antes disso a
   * linha tinha só 1 chip, então o círculo de check ficava mais perto
   * — e pulava pra direita no instante exato de marcar, quando o chip
   * novo aparecia. Fix: o chip sempre ocupa o mesmo espaço na linha
   * (mesmo formato de data, `dateFormatter`, só que com a data de HOJE
   * como valor de preenchimento quando ainda não foi assistido) — só
   * fica INVISÍVEL (`opacity: 0`) até existir uma data de verdade,
   * sem sumir do layout. Círculo de check nunca mais pula de lugar.
   */
  const watchedDatePlaceholder = watchedDateLabel ?? dateFormatter.format(new Date());
  // Ciclo de 3 estados do círculo de check — ver comentário de correção acima.
  const wantToWatch = status === "want_to_watch" || status === "watching";

  return (
    <View>
      <GlassTargetProvider
        style={styles.backdropWrapper}
        base="transparent"
        background={
          <>
            {backdropUrl ? (
              <Image source={{ uri: backdropUrl }} style={styles.backdrop} contentFit="cover" />
            ) : (
              <View style={[styles.backdrop, styles.backdropFallback]} />
            )}
            {/** `bg-gradient-to-t from-background via-background/70 to-background/10` — quase transparente em cima, chapado embaixo. */}
            <LinearGradient
              colors={["rgba(11,14,20,0.1)", "rgba(11,14,20,0.7)", colors.background]}
              locations={[0, 0.5, 1]}
              style={styles.overlay}
            />
          </>
        }
      >
        {/* CORREÇÃO (Fase 3, achado alto — acessibilidade de botões só-ícone) — `accessibilityLabel`/`accessibilityRole` faltavam nos dois botões abaixo. */}
        <Glass style={styles.backButton} variant="icon">
          <Pressable
            style={styles.buttonHit}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Feather name="arrow-left" size={16} color={colors.text} />
          </Pressable>
        </Glass>

        <Glass style={styles.moreButton} variant="icon">
          <Pressable
            style={styles.buttonHit}
            onPress={onMorePress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("profile.moreOptions")}
          >
            <Feather name="more-horizontal" size={16} color={colors.text} />
          </Pressable>
        </Glass>

        {/* Sem pôster ao lado — ver "BUG REAL" no comentário de redesenho acima. Bloco de texto sobre a própria capa, igual a `SeriesHeader.tsx`. */}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {movie.title}
          </Text>
          {movie.originalTitle !== movie.title && (
            <Text numberOfLines={1} style={styles.originalTitle}>
              {movie.originalTitle}
            </Text>
          )}
          <Text numberOfLines={1} style={styles.meta}>
            {[movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : null, movie.genres.length > 0 ? movie.genres.join(", ") : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </GlassTargetProvider>

      {/* Substitui os 2 botões antigos (Assistido/Assistir depois) — ver comentário de redesenho acima. */}
      <View style={styles.metaRow}>
        {releaseDateLabel && (
          <View style={styles.metaChip}>
            <Feather name="calendar" size={14} color={colors.muted} />
            <Text style={styles.metaChipText}>{releaseDateLabel}</Text>
          </View>
        )}
        {/* Sempre montado (`watchedDatePlaceholder`) pra reservar o mesmo espaço — só o `opacity` distingue "assistido"/"ainda não". Ver comentário de correção acima. */}
        <View style={[styles.metaChip, !watchedDateLabel && styles.metaChipInvisible]}>
          <Feather name="eye" size={14} color={colors.secondary} />
          <Text style={[styles.metaChipText, styles.metaChipTextWatched]}>{watchedDatePlaceholder}</Text>
        </View>
        <Pressable
          hitSlop={8}
          disabled={busy}
          onPress={onTogglePress}
          style={[styles.checkBadge, watched ? styles.checkBadgeWatched : wantToWatch ? styles.checkBadgeWantToWatch : styles.checkBadgeNone]}
        >
          {/* A PEDIDO (2026-09-25, teste no aparelho — "quando o botão está cinza e branco, não tem o (v) como é o padrão do app") — o ✓ era só do estado assistido; o padrão do resto do app (`EpisodeWatchedButton.tsx`) sempre mostra o ✓, só troca de cor. Agora aparece nos 3 estados. */}
          <Feather name="check" size={16} color={colors.background} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * `drop-shadow` sobre a capa — mesmo truque de `SeriesHeader.tsx`
 * (`SOMBRA_DE_TEXTO`): sem isso, texto claro sobre uma cena clara da
 * capa perde o contorno e fica ilegível.
 */
const SOMBRA_DE_TEXTO = {
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const styles = StyleSheet.create({
  /** `h-56` = 224 no web; era 180. */
  backdropWrapper: {
    height: 224,
    width: "100%",
    backgroundColor: colors.surface,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFallback: {
    backgroundColor: colors.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  /** `left-3 top-3 h-9 w-9` = 12 de canto (era `spacing.md` = 16), 36 de lado — mesma medida de `SeriesHeader.tsx`. */
  backButton: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  moreButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  buttonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * Bloco de texto sobre a própria capa — substitui o antigo
   * `headerRow` (pôster + coluna de texto, removido: ver "BUG REAL" no
   * comentário de redesenho acima). Mesmo padrão de `SeriesHeader.tsx`
   * (`textBlock`): `position: "absolute"`, ancorado embaixo da capa,
   * largura inteira da tela (menos a borda de 16px) pro título não
   * espremer mais.
   */
  textBlock: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  title: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xl` (era literal 22, mesmo valor).
    fontSize: fontSize.xl,
    fontWeight: "800",
    lineHeight: 28,
    color: "#FFFFFF",
    ...SOMBRA_DE_TEXTO,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — tokens formalizados `fontSize.xxs`/`fontSize.xs` (eram literais 11/12, mesmos valores).
  originalTitle: {
    fontSize: fontSize.xxs,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    ...SOMBRA_DE_TEXTO,
  },
  meta: {
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    ...SOMBRA_DE_TEXTO,
  },
  /**
   * Linha nova (mockup aprovado 2026-09-25) — substitui os 2 botões
   * antigos de `MovieActions.tsx`.
   *
   * A PEDIDO (2026-09-25, teste no aparelho — "faltou a linha entre
   * as datas e as tabs") — faltava a linha divisória separando esta
   * linha (datas + check) das abas Sobre/Mais logo abaixo; mesmo
   * `colors.border` já usado nas seções da aba Sobre (`section`, em
   * `app/movies/[id].tsx`) e nas próprias abas.
   */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaChipText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.muted,
  },
  metaChipTextWatched: {
    color: colors.secondary,
  },
  /** Ver "não precisa do movimento" no comentário de correção acima — some visualmente, mas continua ocupando o mesmo espaço na linha. */
  metaChipInvisible: {
    opacity: 0,
  },
  /**
   * A PEDIDO (2026-09-25, teste no aparelho) — duas correções:
   *
   * 1. "alinha a distancia das datas e o botão" — era `marginLeft:
   *    "auto"`, que empurrava o círculo pro canto DIREITO da tela
   *    (distância variável, sobrava o que desse depois dos chips de
   *    data). Removido — agora o botão fica logo depois do último chip
   *    de data, com o mesmo `gap` (`spacing.md`) que já separa os
   *    outros itens da linha, distância fixa e previsível.
   *
   * 2. "verifica se o tamanho do botão é padrão com o restante do app"
   *    (depois, "deixa o tamanho do botão 32px") — era 26px, sem bater
   *    com NENHUM tamanho padrão do app: o botão redondo de "assistido"
   *    que já existe em todo canto (Home, Temporadas, Carrossel de
   *    Episódios — `EpisodeWatchedButton.tsx`, `SIZES`) usa 28/32/40.
   *    Pedido explícito do usuário: 32 (o `md`).
   */
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadgeWatched: {
    backgroundColor: colors.success,
  },
  /**
   * A PEDIDO (2026-09-25, teste no aparelho) — ciclo de 3 estados, não
   * mais 2: "o botão deve ter 3 funções: cor cinza é o padrão (...)
   * quando ele apertar, aciona a função 'assistir depois' (...) quando
   * tiver em assistir depois o botão deve ter a cor branca (...)
   * quando apertar novamente, o botão fica verde/assistido." Era um
   * único estado "pendente" com borda `colors.text` (branco) pros dois
   * casos (nada marcado E "assistir depois") — agora `checkBadgeNone`
   * (cinza, nada marcado ainda) e `checkBadgeWantToWatch` (branco,
   * "assistir depois") são visualmente diferentes; `checkBadgeWatched`
   * (verde) acima não mudou.
   *
   * CORREÇÃO (2026-09-25, teste no aparelho de novo) — os dois eram só
   * CONTORNO (`borderWidth`/`borderColor`, miolo transparente, a capa
   * aparecendo por trás). Pedido explícito: "o botão é pra ser
   * preenchido com cor, nas 3 fases, tá só o circulo, só é preenchido
   * quando marca assistido" — agora os 3 estados são `backgroundColor`
   * sólido (cinza/branco/verde), nenhum é só contorno.
   */
  checkBadgeNone: {
    backgroundColor: colors.muted,
  },
  checkBadgeWantToWatch: {
    backgroundColor: colors.text,
  },
});
