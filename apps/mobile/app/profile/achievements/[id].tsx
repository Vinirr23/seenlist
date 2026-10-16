import { useEffect, useState } from "react";
import { View, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Screen, Text, Glass, GlassTargetProvider, AmbientGlow, GLOW_IMAGE, parseGlowColor } from "@/components/ui";
import { colors, spacing, radius, fontSize, elevation } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_THEMES,
  evaluateAndUnlockAchievements,
  fetchAchievementsState,
  fetchAchievementRarity,
  progressFor,
  type AchievementId,
  type AchievementsState,
} from "@/lib/achievements";

/**
 * PILOTO — tela DEDICADA de detalhe de uma conquista
 * (`/profile/achievements/[id]`), 2026-10-15. Substitui o antigo
 * modal/bottom-sheet (`achievements.tsx` tinha isso antes) — pedido
 * explícito, referência enviada (mockup do GPT aprovado): tela cheia
 * própria, com seta de voltar flutuante (mesmo estilo de
 * `MovieHeader.tsx`/`SeriesHeader.tsx` — `Glass variant="icon"`,
 * 36×36, canto 12/12), SEM a barra de navegação embaixo (escondida em
 * `app/_layout.tsx`, mesmo mecanismo já usado por `week-review` e
 * `season-recap`) — por isso NÃO usa `<ScreenHeader>` (o próprio
 * componente documenta que não é pra telas hero/detail).
 *
 * Conquistado: emblema grande, nome, descrição, bloco "conquista
 * desbloqueada" com ícone de confirmação, e botão de compartilhar.
 *
 * REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
 * primeiros") — `unlocked`/`progress`/`unlockedAt` vinham de
 * `DEMO_UNLOCKED`/`DEMO_PROGRESS`/`DEMO_UNLOCKED_AT` (sem banco). Ao
 * abrir esta tela, chama `evaluateAndUnlockAchievements` (confere os
 * critérios de verdade no Postgres e grava o que for novo) e depois
 * `fetchAchievementsState` (lê o estado real). A data de desbloqueio
 * agora é a de verdade (`unlocked_at` da tabela `user_achievements`),
 * não mais um campo vazio de propósito.
 *
 * O BOTÃO DE COMPARTILHAR ESTÁ VISÍVEL MAS DESABILITADO DE PROPÓSITO
 * — o app já tem uma infra de compartilhamento (`ShareCardExport.tsx`,
 * usada no Week Review), mas ela foi feita especificamente pra aquele
 * card, não é um encaixe direto aqui. Em vez de simular um
 * compartilhamento (a pedido explícito, "sem simular um
 * compartilhamento bem-sucedido"), deixei desabilitado até decidirmos
 * se vale a pena construir uma versão própria pra emblemas.
 *
 * Bloqueado: emblema cinza grande, nome, bloco de progresso com barra
 * + "X de Y" (reaproveita `achievements.progress`, já traduzido nos 3
 * idiomas), e a explicação de como desbloquear (`requirementKey`) —
 * mesmo texto que já existia no modal antigo, sem inventar um segundo
 * texto diferente só pra bater 100% com a referência visual (ela tinha
 * duas frases parecidas; nosso modelo de dados só tem uma por estado).
 *
 * EXPERIÊNCIA VISUAL (2026-10-16, a pedido — "as telas do emblemas são
 * estaticas, quero que seja mais uma experiencia" + review encaminhado
 * do GPT sobre o espaço vazio abaixo do card de progresso) — depois de
 * 3 e depois 10 opções de mockup (`SendUserFile`, não publicadas — era
 * "preciso de ideias e mockup para escolher", sinal de escolha única,
 * não de algo pra revisitar), decisão final do usuário, literal:
 * "gostei do fundo tematico + raridade social + brilho ambar e emblema
 * flutuando" — explicitamente SEM confete (fazia parte da opção 1 do
 * mockup, mas não foi mencionado na escolha final). Depois, ao ver uma
 * captura com um anel de raridade em volta do emblema, instrução
 * explícita: "na raridade social, não coloca o circulo ao redor do
 * emblema" — por isso o selo de raridade abaixo é só texto, sem
 * nenhum anel/contorno desenhado sobre o emblema.
 *
 * As 4 peças, cada uma plugada num ponto já existente:
 * 1. Fundo temático — `ACHIEVEMENT_THEMES[achievement.id].blobs` no
 *    `AmbientGlow` que já envolve a tela (mesmo mecanismo de
 *    `GlassTargetProvider`+`AmbientGlow` usado em toda sub-página do
 *    app, só com uma paleta por emblema em vez da genérica).
 * 2. Brilho âmbar (ou a cor do tema) + emblema flutuando — halo local
 *    (`GLOW_IMAGE`, o mesmo PNG pré-desfocado do `AmbientGlow`,
 *    tingido com `theme.haloColor`) respirando opacidade+escala atrás
 *    do emblema, com o emblema em si subindo/descendo devagar
 *    (`Animated.View` + Reanimated, mesma lib/padrão já usado em
 *    `EpisodeWatchedButton.tsx`).
 * 3. Estrelas piscando — só quando `theme.showStars` (hoje só
 *    Madrugada, por ser o único tema de "noite"), um punhado de
 *    pontinhos com opacidade piscando em fases diferentes.
 * 4. Raridade social — `fetchAchievementRarity()` (função nova
 *    `get_achievement_rarity`, cálculo agregado no Postgres — ver
 *    migration `20261016000000`), mostrada tanto desbloqueado quanto
 *    bloqueado (decisão do usuário — bloqueado funciona como
 *    incentivo). Busca independente do login do usuário (estatística
 *    pública do app, não dado pessoal), por isso corre num
 *    `useEffect` próprio, sem esperar `userId`.
 */

const EMPTY_STATE: AchievementsState = {
  unlocked: { maratonista: false, madrugada: false, "amante-de-filmes": false, classicos: false },
  unlockedAt: {},
  moviesWatchedCount: 0,
};

// Posições das estrelas dentro da caixa do emblema (240×240, ver
// `heroWrap`) — espalhadas à mão pra não ficarem simétricas/robóticas
// demais, com atrasos diferentes pra não piscarem todas juntas.
const STAR_POSITIONS: { top: number; left: number; size: number; delay: number }[] = [
  { top: 6, left: 34, size: 3, delay: 0 },
  { top: 36, left: 202, size: 2, delay: 450 },
  { top: 196, left: 18, size: 2, delay: 900 },
  { top: 168, left: 212, size: 3, delay: 250 },
  { top: 72, left: 112, size: 2, delay: 650 },
  { top: 214, left: 128, size: 2, delay: 1100 },
];

export default function AchievementDetailScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<AchievementsState>(EMPTY_STATE);
  const [rarity, setRarity] = useState<Partial<Record<AchievementId, number>>>({});

  useEffect(() => {
    if (!userId) return;
    // Capturado aqui fora — dentro de `load()` (função aninhada,
    // assíncrona) o TypeScript não carrega a checagem acima, mesmo
    // sendo o mesmo valor (limitação conhecida do controle de fluxo
    // do TS através de closures assíncronas, achado real ao rodar
    // `tsc --noEmit` — mesmo idioma já usado em `useCurrentUser.ts`).
    const currentUserId = userId;
    let cancelled = false;

    async function load() {
      await evaluateAndUnlockAchievements(currentUserId);
      const fresh = await fetchAchievementsState(currentUserId);
      if (!cancelled) setState(fresh);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Raridade é estatística AGREGADA do app (não depende de quem está
  // logado) — roda sozinha, sem esperar `userId`, pra não atrasar o
  // selo atrás de um login que nem é necessário pra calculá-la.
  useEffect(() => {
    let cancelled = false;

    fetchAchievementRarity().then((data) => {
      if (!cancelled) setRarity(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // `achievement`/`theme` calculados ANTES dos hooks de animação
  // (mesmo quando não encontrado) — os hooks (`useSharedValue`/
  // `useAnimatedStyle`) têm que ser chamados incondicionalmente em
  // toda renderização (regra do React), então o "não encontrado" só
  // pode retornar DEPOIS deles, não antes.
  const achievement = ACHIEVEMENTS.find((item) => item.id === id);
  // Usado só pra alimentar os hooks de animação abaixo (chamados
  // incondicionalmente) ANTES do retorno antecipado de "não
  // encontrado" — a versão não-opcional (`theme`, usada no JSX de
  // verdade) é recalculada depois desse retorno, já com `achievement`
  // estreitado pelo TypeScript como definido.
  const themeForAnim = achievement ? ACHIEVEMENT_THEMES[achievement.id] : undefined;
  // `tintColor` do RN não respeita o canal alpha de forma confiável
  // (mesmo motivo documentado em `Glass.tsx`, `parseGlowColor`) — por
  // isso a cor do halo entra sólida (`haloTint`) e a opacidade (alpha
  // original × a respiração animada) é aplicada separada, no estilo.
  const { tint: haloTint, opacity: haloBaseOpacity } = themeForAnim
    ? parseGlowColor(themeForAnim.haloColor)
    : { tint: "transparent", opacity: 0 };

  // Respiração do halo + flutuação do emblema — iniciadas uma vez,
  // em loop infinito (`withRepeat(..., -1, ...)`), independente de
  // qual emblema é (a cor vem de `haloTint`, calculado acima).
  const floatY = useSharedValue(0);
  const haloPulse = useSharedValue(0.5);
  const haloScale = useSharedValue(1);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    haloPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.45, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));
  // Multiplica a opacidade original do `rgba(...)` do tema pela
  // respiração (0.45–1) — assim um halo já mais sutil num tema (se
  // algum dia houver) continua proporcionalmente mais sutil, em vez
  // de todos respirarem na mesma faixa absoluta.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloBaseOpacity * haloPulse.value,
    transform: [{ scale: haloScale.value }],
  }));

  if (!achievement) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <View style={styles.notFound}>
          <Text variant="muted">{t("achievements.notFound")}</Text>
        </View>
      </Screen>
    );
  }

  const theme = ACHIEVEMENT_THEMES[achievement.id];
  const unlocked = state.unlocked[achievement.id];
  const progress = progressFor(achievement, state);
  const ratio = Math.max(0, Math.min(1, progress / achievement.target));
  const unlockedAtRaw = state.unlockedAt[achievement.id];
  const unlockedAtLabel = unlockedAtRaw
    ? new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(unlockedAtRaw)
      )
    : null;
  const rarityPercent = rarity[achievement.id];

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>

      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={theme.blobs} />}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          <View style={styles.heroWrap}>
            <Animated.Image
              source={GLOW_IMAGE}
              resizeMode="stretch"
              style={[styles.halo, { tintColor: haloTint }, haloStyle]}
            />
            {theme.showStars && <TwinklingStars />}
            <Animated.View style={floatStyle}>
              <Image
                source={unlocked ? achievement.colorImage : achievement.lockedImage}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <Text variant="subtitle" style={styles.name}>
            {t(achievement.titleKey)}
          </Text>

          {typeof rarityPercent === "number" && (
            <Text variant="muted" style={styles.rarityText}>
              {t("achievements.rarity", { percent: rarityPercent })}
            </Text>
          )}

          {unlocked ? (
            <>
              <Text variant="muted" style={styles.description}>
                {t(achievement.descriptionKey)}
              </Text>

              <View style={styles.unlockedBlock}>
                <Feather name="check-circle" size={18} color={colors.success} />
                <View style={styles.unlockedTextCol}>
                  <Text style={styles.unlockedText}>{t("achievements.unlockedBadge")}</Text>
                  {unlockedAtLabel && (
                    <Text variant="muted" style={styles.unlockedDate}>
                      {unlockedAtLabel}
                    </Text>
                  )}
                </View>
              </View>

              <Pressable style={styles.shareButton} disabled accessibilityState={{ disabled: true }}>
                <Feather name="share" size={16} color={colors.muted} />
                <Text variant="muted">{t("achievements.shareButton")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text variant="muted" style={styles.description}>
                {t(achievement.requirementKey)}
              </Text>

              <View style={styles.progressBlock}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressHeaderLabel}>{t("achievements.progressLabel")}</Text>
                  <Text style={styles.progressHeaderValue}>
                    {t("achievements.progress", { current: progress, total: achievement.target })}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

// Camada de estrelinhas piscando, só pro tema Madrugada
// (`theme.showStars`) — cada uma com seu próprio shared value e seu
// próprio atraso, pra não piscarem todas em sincronia.
function TwinklingStars() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {STAR_POSITIONS.map((star, index) => (
        <Star key={index} top={star.top} left={star.left} size={star.size} delay={star.delay} />
      ))}
    </View>
  );
}

function Star({ top, left, size, delay }: { top: number; left: number; size: number; delay: number }) {
  const twinkle = useSharedValue(0.25);

  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#F4F1E8",
        },
        style,
      ]}
    />
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Glass style={styles.backButton} variant="icon">
      <Pressable
        style={styles.backButtonHit}
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Feather name="arrow-left" size={16} color={colors.text} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  backButtonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  // Mesmo padrão de `AmbientGlow` parado + `ScrollView` rolando por
  // cima já usado em toda sub-página do app (ver `settings/index.tsx`,
  // `glassFill`) — aqui o `AmbientGlow` recebe `theme.blobs` em vez de
  // uma paleta fixa, então cada emblema pinta sua própria atmosfera.
  glassFill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroWrap: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 300,
    height: 300,
  },
  heroImage: {
    width: 220,
    height: 220,
  },
  name: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  rarityText: {
    marginTop: spacing.xs / 2,
    textAlign: "center",
    fontSize: fontSize.xs,
  },
  description: {
    marginTop: spacing.xs,
    textAlign: "center",
    maxWidth: 300,
  },
  unlockedBlock: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    width: "100%",
    maxWidth: 320,
  },
  unlockedTextCol: {
    flexShrink: 1,
  },
  unlockedText: {
    color: colors.success,
    fontWeight: "600",
    flexShrink: 1,
  },
  unlockedDate: {
    marginTop: 2,
    fontSize: fontSize.xs,
  },
  shareButton: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    width: "100%",
    maxWidth: 320,
    opacity: 0.5,
  },
  progressBlock: {
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressHeaderLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
  progressHeaderValue: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});
