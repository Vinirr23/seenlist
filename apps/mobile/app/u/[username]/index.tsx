/* `Image as RNImage`: o `Image` do arquivo é o do `expo-image` (linha abaixo); o brilho azulado da 3ª pílula precisa do `tintColor`, que é do react-native. */
import { ScrollView, View, Pressable, Share, StyleSheet, Image as RNImage } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePublicProfile, useFollowCounts, useFollow } from "@/lib/usePublicProfile";
import { usePublicProfileStats } from "@/lib/useProfileStats";
import { Screen, Text, GlassTargetProvider, Glass, GelSurface, AmbientGlow, type GlowBlob } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { FollowButton } from "@/components/profile/FollowButton";
import { StatsCarousel } from "@/components/profile/StatsCarousel";
import { PublicMediaSectionsList } from "@/components/profile/PublicMediaSectionsList";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

const joinDateFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/**
 * PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas do
 * perfil PÚBLICO. São 6 manchas (o perfil próprio tem 8): o web
 * (`PublicProfileView.tsx`) usa menos porque a tela pública é mais
 * curta que a própria. Mesma conversão das outras telas: `top` em
 * pixel 1:1 do web, `left`/`right` (% da coluna no web) convertidos
 * assumindo ~400px de largura de referência (-22%→-88, -20%→-80,
 * -18%→-72, -16%→-64, -14%→-56), `size` = a caixa (`h-64`=256,
 * `h-60`=240, `h-56`=224, `h-48`=192, `h-40`=160) e a opacidade
 * (classe `opacity-*` separada no web) embutida no alpha do `rgba`.
 */
const GLOW_PILL = require("../../../assets/images/glow-soft.png");

const PUBLIC_PROFILE_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.45)", top: 120, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 340, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.45)", top: 560, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.35)", top: 800, right: -90, size: 224 },
  { color: "rgba(27,75,122,0.28)", top: 1050, left: -80, size: 192 },
  { color: "rgba(13,59,92,0.18)", top: 1300, right: -70, size: 160 },
];

/**
 * TASK-103 — porta de `PublicProfileView.tsx` do web.
 *
 * MOVIDO (2026-09-03, auditoria "implementar tudo que não envolve
 * redesign" — "Perfil público, ordem") — era um arquivo solto
 * `app/u/[username].tsx`; virou `app/u/[username]/index.tsx` (mesma
 * rota `/u/:username`) pra abrir espaço pras 4 subpáginas novas "ver
 * tudo" (`series.tsx`/`favorite-series.tsx`/`movies.tsx`/
 * `favorite-movies.tsx`, irmãos deste). O arquivo antigo já foi
 * apagado (conferido no disco, 2026-09-04 — não existe mais).
 *
 * PORTE DO WEB (2026-09-04, "vidro que falta") — o web
 * (`PublicProfileView.tsx`, "ENTREGA 5") reescreveu esta tela pra
 * ficar IGUAL ao perfil próprio ("deixe igual no perfil do usuário"),
 * e é isso que esta rodada faz aqui: em vez de copiar o HTML do web
 * literalmente, espelha o que o perfil próprio do MOBILE já faz hoje
 * (`app/(tabs)/profile.tsx`, já testado no aparelho e aprovado) —
 * assim as duas telas ficam idênticas ENTRE SI no mobile, que é
 * exatamente o efeito que o web foi atrás. O que mudou:
 *
 * - capa 112px → 224px (`h-56` do web) dentro de um `bannerOuter` de
 *   264, com degradê de leitura de 64px na borda de baixo;
 * - avatar 80px → 74px, ao LADO do nome/@ numa fileira só sobrepondo
 *   a capa (`avatarHeaderRow`) — a divergência deliberada do mobile
 *   pedida em TASK-176 ("sobe o nome pro lado da foto"), mantida aqui
 *   pra não ter dois cabeçalhos diferentes dentro do próprio app;
 * - botões voltar/compartilhar viraram círculo de vidro (o web chama
 *   de `GLASS_ICON_BTN`), no lugar do círculo com `scrim` sólido e da
 *   caixa com borda;
 * - contagens (Seguindo/Seguidores/Comentários) viraram as 3 pílulas
 *   de vidro do cabeçalho, com as MESMAS camadas de gradiente extra
 *   do perfil próprio (inclusive o segundo gradiente azulado só na
 *   última pílula — ver comentário lá);
 * - "Editar" virou pílula "gel".
 *
 * `FollowButton` NÃO foi tocado de propósito: o web também deixou ele
 * sólido (`bg-primary`/borda simples, sem vidro nenhum) — conferido em
 * `apps/web/components/social/FollowButton.tsx`.
 */
export default function PublicProfileScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const { username: rawUsername } = useLocalSearchParams<{ username: string }>();
  const username = String(rawUsername);
  const { session } = useAuth();

  const { profile, isLoading, isError, refetch } = usePublicProfile(username);
  const counts = useFollowCounts(profile?.userId ?? null);
  const publicStats = usePublicProfileStats(profile?.userId ?? null);
  const follow = useFollow(profile?.userId ?? null);

  if (isLoading) {
    return (
      <Screen>
        <AvatarRowSkeleton count={1} />
      </Screen>
    );
  }

  if (isError || !profile) {
    return (
      <Screen>
        <Pressable style={styles.backButtonAlone} onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={18} color={colors.text} />
        </Pressable>
        {isError ? (
          <PageError message={t("error.loadProfileFailed")} onRetry={() => refetch()} />
        ) : (
          <Text variant="muted" style={styles.centerText}>
            {t("profile.doesNotExistOrPrivate")}
          </Text>
        )}
      </Screen>
    );
  }

  const isOwnProfile = session?.user.id === profile.userId;
  const displayName = profile.displayName?.trim() || `@${profile.username}`;
  const joinedLine = [profile.country, `Entrou em ${joinDateFormatter.format(new Date(profile.createdAt))}`]
    .filter(Boolean)
    .join(" · ");

  async function handleShare() {
    try {
      await Share.share({ message: `https://seenlist.app/u/${profile!.username}` });
    } catch (error) {
      console.error("[PublicProfileScreen] Falha ao compartilhar", error);
    }
  }

  const nameBlock = (
    <View style={styles.headerText}>
      <Text numberOfLines={1} variant="subtitle">
        {displayName}
      </Text>
      <Text numberOfLines={1} style={styles.username}>
        @{profile.username}
      </Text>
      {!!joinedLine && (
        <Text numberOfLines={1} variant="muted" style={styles.metaLine}>
          {joinedLine}
        </Text>
      )}
    </View>
  );

  return (
    <Screen padded={false}>
      {/* `bottomInset` saiu: a barra de navegação agora flutua sobre esta tela (ver `app/_layout.tsx`) e a folga do fim do conteúdo já soma a área segura, via `useTabBarClearance()`. Manter os dois empurrava o conteúdo pra cima duas vezes e ainda tirava o fundo de trás da barra, que é o que dá o efeito de vidro. */}
      {/*
        * Mesmo arranjo do perfil próprio: o `GlassTargetProvider`
        * ENVOLVE o `ScrollView` (não o contrário), pro campo de manchas
        * ficar parado enquanto o conteúdo rola por cima — ver comentário
        * completo em `app/(tabs)/profile.tsx`.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={PUBLIC_PROFILE_GLOW_BLOBS} />}>
        <ScrollView contentContainerStyle={{ paddingBottom: espacoDoDock }}>
          {!!profile.bannerUrl ? (
            <View style={styles.bannerOuter}>
              {/*
                * MESMA CORREÇÃO DO PERFIL PRÓPRIO (2026-09-04, ver o
                * comentário completo em `app/(tabs)/profile.tsx`) — estes
                * botões eram IRMÃOS da capa, então o
                * `GlassTargetProvider` mais próximo era o da tela, cujo
                * alvo é o `AmbientGlow`: eles desfocavam o campo azul do
                * fundo em vez da fotografia que está atrás deles.
                *
                * A capa vira o `background` de um provider próprio (segue
                * visível — a `BlurTargetView` é uma view normal) e os
                * botões viram FILHOS dele, irmãos da `BlurTargetView`,
                * nunca dentro dela. O bloco do avatar continua FORA,
                * porque ele transborda abaixo da capa e seria recortado
                * pelo `overflow: hidden` do `bannerInner`.
                */}
              <GlassTargetProvider
                style={styles.bannerInner}
                base="transparent"
                background={
                  <>
                    <Image source={{ uri: profile.bannerUrl }} style={styles.banner} contentFit="cover" />
                    <LinearGradient colors={["transparent", colors.background]} style={styles.fadeOverlay} pointerEvents="none" />
                  </>
                }
              >
                <Pressable hitSlop={8} style={styles.bannerIconLeft} onPress={() => router.back()}>
                  <Glass variant="icon" style={styles.bannerIconGlass}>
                    <Feather name="arrow-left" size={16} color={colors.text} />
                  </Glass>
                </Pressable>

                <View style={styles.bannerIconsRight}>
                  <Pressable hitSlop={8} onPress={handleShare}>
                    <Glass variant="icon" style={styles.bannerIconGlass}>
                      <Feather name="share-2" size={16} color={colors.text} />
                    </Glass>
                  </Pressable>
                </View>
              </GlassTargetProvider>

              <View style={styles.avatarHeaderRow}>
                <Avatar uri={profile.avatarUrl} name={displayName} style={styles.avatarOverlap} textStyle={styles.avatarInitials} />
                {nameBlock}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.topIconsRowNoBanner}>
                <Pressable hitSlop={8} onPress={() => router.back()}>
                  <Glass style={styles.bannerIconGlass}>
                    <Feather name="arrow-left" size={16} color={colors.muted} />
                  </Glass>
                </Pressable>
                <View style={styles.topIconsSpacer} />
                <Pressable hitSlop={8} onPress={handleShare}>
                  <Glass style={styles.bannerIconGlass}>
                    <Feather name="share-2" size={16} color={colors.muted} />
                  </Glass>
                </Pressable>
              </View>

              <View style={styles.headerRow}>
                <Avatar uri={profile.avatarUrl} name={displayName} style={styles.avatarNoBanner} textStyle={styles.avatarInitials} />
                {nameBlock}
              </View>
            </>
          )}

          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {/*
            * Pílulas de contagem — mesmas camadas de gradiente extra do
            * perfil próprio (`app/(tabs)/profile.tsx`): um branco no
            * canto superior esquerdo em TODAS, e um segundo azulado no
            * canto inferior direito só na última (Comentários), como o
            * `ProfileHeader.tsx` do web faz.
            *
            * "Comentários" continua fixo em 0 aqui — é assim no web
            * também (`PublicProfileView.tsx`, `statPills`): a contagem
            * pública de comentários de OUTRA pessoa nunca foi buscada em
            * lugar nenhum. Fora do escopo desta rodada (que é visual);
            * não inventei um número nem um `select` novo pra isso.
            */}
          <View style={styles.countsRow}>
            <Pressable style={styles.countCardFlex} onPress={() => router.push(`/follow-list/${profile.userId}/following`)}>
              <Glass style={styles.countCard} variant="pill">
                <Text style={styles.countNumber}>{counts.following}</Text>
                <Text variant="muted" style={styles.countLabel}>
                  Seguindo
                </Text>
              </Glass>
            </Pressable>
            <Pressable style={styles.countCardFlex} onPress={() => router.push(`/follow-list/${profile.userId}/followers`)}>
              <Glass style={styles.countCard} variant="pill">
                <Text style={styles.countNumber}>{counts.followers}</Text>
                <Text variant="muted" style={styles.countLabel}>
                  Seguidores
                </Text>
              </Glass>
            </Pressable>
            <View style={styles.countCardFlex}>
              <Glass style={styles.countCard} variant="pill">
                {/* Mesma coisa do Perfil próprio — ver o comentário longo em `app/(tabs)/profile.tsx`. */}
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  <RNImage source={GLOW_PILL} resizeMode="stretch" style={styles.countCardBlueGlow} />
                </View>
                <Text style={styles.countNumber}>0</Text>
                <Text variant="muted" style={styles.countLabel}>
                  {t("profile.commentsTitle")}
                </Text>
              </Glass>
            </View>
          </View>

          <View style={styles.actionsRow}>
            {isOwnProfile ? (
              <Pressable onPress={() => router.push("/settings/edit-profile")}>
                <GelSurface style={styles.editButton}>
                  <Text style={styles.editButtonText}>Editar</Text>
                </GelSurface>
              </Pressable>
            ) : (
              <FollowButton isFollowing={follow.isFollowing} busy={follow.busy} onPress={follow.toggle} />
            )}
          </View>

          <View style={styles.sections}>
            <StatsCarousel
              stats={publicStats.stats}
              isLoading={publicStats.isLoading}
              isError={publicStats.isError}
              ownerLabel="other"
              onRetry={() => publicStats.refetch()}
            />
            <PublicMediaSectionsList userId={profile.userId} username={profile.username} />
          </View>
        </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

/** Mesmo tamanho do perfil próprio (`app/(tabs)/profile.tsx`) — era 80 aqui. */
const AVATAR_SIZE = 74;

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-09) — o `PublicProfileView.tsx` do web usa a
   * MESMA receita de pílula do `ProfileHeader.tsx`, incluindo o segundo
   * brilho azulado só na última:
   * `radial-gradient(70% 90% at 85% 100%, rgba(42,127,184,0.22), transparent 60%)`.
   * A conversão da caixa está explicada em `app/(tabs)/profile.tsx`.
   */
  countCardBlueGlow: {
    position: "absolute",
    left: "43%",
    top: "46%",
    width: "84%",
    height: "108%",
    tintColor: "rgb(42,127,184)",
    opacity: 0.254,
  },
  glassFill: {
    flex: 1,
  },
  /**
   * Mesmas medidas do perfil próprio: capa + 40px de folga reservados
   * pra `avatarHeaderRow`.
   *
   * REVERTIDO (a pedido, 2026-09-15 — "volta pra a versão do banner
   * do tamanho que está no web", nos dois: principal e público) —
   * chegou a ser reduzido pra 112px nesta mesma sessão, mas o usuário
   * pediu de volta o tamanho grande original. (O anel do avatar
   * `avatarOverlap`, mais abaixo, também acabou revertido — só que um
   * dia depois, 2026-09-16, ver comentário dele — não fazia parte
   * deste pedido de banner.)
   */
  bannerOuter: {
    height: 264,
    marginBottom: 12,
  },
  bannerInner: {
    height: 224,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    height: "100%",
  },
  /** Degradê de leitura na borda de baixo da capa — `h-16` (64px) no web. */
  fadeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  bannerIconLeft: {
    position: "absolute",
    left: 12,
    top: 12,
  },
  bannerIconsRight: {
    position: "absolute",
    right: 12,
    top: 12,
    flexDirection: "row",
    gap: spacing.sm,
  },
  bannerIconGlass: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topIconsRowNoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  topIconsSpacer: {
    flex: 1,
  },
  backButtonAlone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarHeaderRow: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  /**
   * REVERTIDO (a pedido, 2026-09-16 — comparação lado a lado com o
   * web publicado em seenlist.app: "faltou reverter esse círculo
   * preto ao redor do avatar, pra igual como está no web") — chegou a
   * virar um anel SÓLIDO na cor de fundo do app (`borderWidth: 4,
   * borderColor: colors.background`, "meia lua preta") nesta mesma
   * leva, mas isso nunca foi publicado no web (só existe local) — o
   * usuário comparou o mobile buildado com o que está no ar e pediu
   * de volta o anel de vidro translúcido original. `avatarOverlap`
   * (caso COM capa) volta a usar os MESMOS valores de `avatarNoBanner`
   * logo abaixo — não tem mais diferença entre os dois casos, mas os
   * dois estilos continuam separados (só por clareza/histórico, não
   * por necessidade). Escopo confirmado via AskUserQuestion: só
   * mobile (esta tela + Perfil principal em `app/(tabs)/profile.tsx`)
   * — o código do web (ainda não publicado) fica como está.
   */
  avatarOverlap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  /** Anel de vidro (branco translúcido) — mesmo valor de antes, preservado só pro caso SEM capa (`headerRow`, acima). */
  avatarNoBanner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarInitials: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.muted,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  metaLine: {
    fontSize: 11,
  },
  bio: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  countsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  countCardFlex: {
    flex: 1,
  },
  countCard: {
    alignItems: "center",
    borderRadius: radius.md,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  countNumber: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  countLabel: {
    fontSize: fontSize.xs,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  editButton: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.background,
    textTransform: "uppercase",
  },
  sections: {
    marginTop: spacing.xl,
    gap: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
