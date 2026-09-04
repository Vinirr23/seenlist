import { useState, useCallback, useEffect } from "react";
import { ScrollView, View, Pressable, Share, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCurrentUser, useSocialCounts } from "@/lib/useCurrentUser";
import { useFollowCounts } from "@/lib/usePublicProfile";
import { fetchEditableProfile } from "@/lib/editProfile";
import { useSeriesActivityIds, useMovieActivityIds, useFavoriteIds } from "@/lib/profileMediaCarousel";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { Screen, Text, GlassTargetProvider, Glass, GelSurface, AmbientGlow, type GlowBlob } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { StatisticsCard } from "@/components/profile/StatisticsCard";
import { ProfileRecommendationsPreview } from "@/components/profile/ProfileRecommendationsPreview";
import { ProfileListsPreview } from "@/components/profile/ProfileListsPreview";
import { ProfileMediaCarousel } from "@/components/profile/ProfileMediaCarousel";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * CORREÇÃO (a pedido — "perfil não se parece com o web") — o vidro do
 * Perfil usava o `AmbientGlow` padrão do app (manchas âmbar+teal,
 * `components/ui/Glass.tsx`), mas o `ProfileView.tsx` do WEB usa uma
 * paleta PRÓPRIA só de azul pra essa tela — decisão explícita,
 * documentada na sessão do redesign "vidro" (2026-08-21): "Cores de
 * fundo (glow field): só tons de azul/teal (#1B4B7A, #2A7FB8,
 * #0D3B5C) — removido o âmbar/marrom que estava misturado antes".
 *
 * CORREÇÃO #2 (a pedido, 2026-09-02 — "fundo está diferente... quero
 * que o mobile fique exatamente igual à versão web, não tente fazer
 * de conta") — só 3 manchas era uma aproximação solta, com posição
 * inventada (nem batia com as 3 primeiras do web de verdade). Portado
 * agora as 8 manchas REAIS de `ProfileView.tsx` (web), na mesma
 * ordem/cor/opacidade/tamanho: `top` é o mesmo valor em pixel do web
 * (lá também é pixel, não precisa converter); `left`/`right` do web
 * são em PORCENTAGEM da coluna (RN não tem % pra offset de posição
 * absoluta aqui — `GlowBlob.left/right` são sempre pixel) — convertido
 * assumindo ~400px de largura de referência (mesma ordem de grandeza
 * das telas que o app mobile roda). Pedido EXPLICITAMENTE decidido
 * (AskUserQuestion, 2026-09-02): manter a técnica atual de "gradiente
 * que dilui a cor" (sem blur de verdade) — mudar isso mexeria no
 * `Glass.tsx` compartilhado por TODO o app, que já teve um crash real
 * documentado; risco alto demais só por causa desta tela. Só posição/
 * cor/opacidade foram portadas, a técnica de desfoque continua a
 * mesma de sempre.
 */
const PROFILE_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.45)", top: 220, left: -88, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 460, right: -80, size: 240 },
  { color: "rgba(13,59,92,0.45)", top: 610, left: -72, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 760, right: -80, size: 240 },
  { color: "rgba(27,75,122,0.35)", top: 880, left: -64, size: 224 },
  { color: "rgba(42,127,184,0.28)", top: 1140, right: -72, size: 192 },
  { color: "rgba(13,59,92,0.2)", top: 1450, left: -56, size: 176 },
  { color: "rgba(27,75,122,0.12)", top: 1760, right: -56, size: 160 },
];

const EDITABLE_PROFILE_CACHE_VERSION = 1;

function editableProfileCacheKeyFor(userId: string): string {
  return `seenlist:profile:editable-fields:v${EDITABLE_PROFILE_CACHE_VERSION}:${userId}`;
}

interface CachedEditableFields {
  bannerUrl: string | null;
  bio: string | null;
  username: string | null;
}

/**
 * TASK-116 (correção — Perfil) — reescrito do zero seguindo
 * `ProfileView.tsx` + `ProfileHeader.tsx` do web de verdade (a
 * versão anterior tinha sido montada de memória, sem checar o
 * código real — daí faltar banner, bio, contagens reais, os 5
 * cards de seção com contagem, e o card de estatísticas certo).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const counts = useFollowCounts(user?.id ?? null);
  const socialCounts = useSocialCounts(user?.id ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const tabBarClearance = useTabBarClearance();

  /**
   * CACHE LOCAL (a pedido — "Perfil abrir instantâneo") — banner/bio/
   * username também pipocavam vazios por um instante até
   * `fetchEditableProfile()` (abaixo) terminar, mesmo já tendo
   * aparecido antes. `session.user.id` (não `user?.id` de
   * `useCurrentUser`, que pode ainda não ter resolvido) já está
   * disponível desde o primeiro render — mesmo raciocínio do cache em
   * `useCurrentUser.ts`. Só LÊ o cache aqui; quem ESCREVE é o
   * `useFocusEffect` logo abaixo, depois de cada busca fresca — mesmo
   * padrão "stale-while-revalidate" dos outros caches.
   */
  const { session } = useAuth();
  const cacheUserId = session?.user?.id;

  useEffect(() => {
    if (!cacheUserId) return;
    let cancelled = false;
    AsyncStorage.getItem(editableProfileCacheKeyFor(cacheUserId))
      .then((raw) => {
        if (cancelled || !raw) return;
        const cached = JSON.parse(raw) as CachedEditableFields;
        setBannerUrl(cached.bannerUrl);
        setBio(cached.bio);
        setUsername(cached.username);
      })
      .catch((error) => {
        console.warn("[ProfileScreen] Cache local de perfil corrompido — ignorando", error);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheUserId]);

  /**
   * Redesign (porta do web, TASK-177/178) — "Séries"/"Filmes"/
   * "Séries favoritas"/"Filmes favoritos" viraram carrossel de
   * pôster ordenado por atividade mais recente, em vez de linha só
   * com contador (`ProfileMediaCarousel`, ids calculados aqui).
   * "Recomendações" e "Minhas listas" buscam os próprios dados
   * sozinhas (`ProfileRecommendationsPreview`/`ProfileListsPreview`),
   * por isso não têm hook correspondente aqui.
   */
  const seriesActivity = useSeriesActivityIds(user?.id ?? null);
  const movieActivity = useMovieActivityIds(user?.id ?? null);
  const favoriteSeries = useFavoriteIds(user?.id ?? null, "series");
  const favoriteMovies = useFavoriteIds(user?.id ?? null, "movie");

  /**
   * Correção (bug real, mesma causa já corrigida em "Minhas listas" e
   * nos carrosséis do Perfil) — buscava só na montagem; editar
   * banner/bio/nome de usuário em Configurações e voltar pro Perfil
   * nunca refletia aqui até reabrir o app. `useFocusEffect` busca de
   * novo toda vez que a aba ganha foco.
   */
  useFocusEffect(
    useCallback(() => {
      fetchEditableProfile().then((profile) => {
        if (!profile) return;
        const nextBannerUrl = profile.bannerUrl;
        const nextBio = profile.bio || null;
        const nextUsername = profile.username || null;
        setBannerUrl(nextBannerUrl);
        setBio(nextBio);
        setUsername(nextUsername);
        if (cacheUserId) {
          AsyncStorage.setItem(
            editableProfileCacheKeyFor(cacheUserId),
            JSON.stringify({ bannerUrl: nextBannerUrl, bio: nextBio, username: nextUsername } satisfies CachedEditableFields)
          ).catch((error) => {
            console.warn("[ProfileScreen] Falha ao salvar cache local de perfil", error);
          });
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheUserId])
  );

  async function handleShare() {
    if (!username) return;
    try {
      await Share.share({ message: `https://seenlist.app/u/${username}` });
    } catch (error) {
      console.error("[ProfileScreen] Falha ao compartilhar", error);
    }
  }

  if (!user) {
    return (
      <Screen>
        <AvatarRowSkeleton count={1} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      {/*
        * A PEDIDO ("o fundo ficar parado no mobile e só o que tem em
        * cima subir e descer o scroll") — `GlassTargetProvider` saiu
        * de DENTRO do `ScrollView` pra ENVOLVÊ-LO. O fundo (`AmbientGlow`,
        * dentro do `BlurTargetView`) preenche a tela inteira uma vez só
        * (`styles.glassFill`, `flex: 1`) e fica parado; o `ScrollView`
        * rola por cima, como um vidro fosco de verdade sobre um pano de
        * fundo fixo, em vez de rolar junto (como estava antes — o fundo
        * "solidário" com a lista). Os cards `Glass` continuam achando o
        * alvo do blur normalmente: `GlassTargetProvider` só passa a ref
        * pelo Context, não importa se o `ScrollView` está no meio.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={PROFILE_GLOW_BLOBS} />}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
        {!!bannerUrl ? (
          <View style={styles.bannerOuter}>
            <View style={styles.bannerInner}>
              <Image source={{ uri: bannerUrl }} style={styles.banner} contentFit="cover" />
              <LinearGradient
                colors={["transparent", colors.background]}
                style={styles.fadeOverlay}
                pointerEvents="none"
              />
            </View>

            <Pressable hitSlop={8} style={styles.bannerIconLeft} onPress={() => router.push("/settings/edit-profile")}>
              <Glass style={styles.bannerIconGlass}>
                <Feather name="edit-2" size={16} color="#fff" />
              </Glass>
            </Pressable>

            <View style={styles.bannerIconsRight}>
              {!!username && (
                <Pressable hitSlop={8} onPress={handleShare}>
                  <Glass style={styles.bannerIconButton}>
                    <Feather name="share-2" size={16} color="#fff" />
                  </Glass>
                </Pressable>
              )}
              <Pressable hitSlop={8} onPress={() => router.push("/settings")}>
                <Glass style={styles.bannerIconButton}>
                  <Feather name="settings" size={16} color="#fff" />
                </Glass>
              </Pressable>
            </View>

            {/*
              * TASK-176 (a pedido — "gap enorme", "sobe o nome pro lado
              * da foto") — quando tem capa, nome/usuário ficam ao lado
              * do avatar, sobrepondo a capa também, em vez de numa
              * fileira própria abaixo dela (que sobrava um vão vazio).
              *
              * CORREÇÃO (2026-09-03, a pedido — "retira o 'membro
              * desde' do perfil, e alinha os outros dados com a foto
              * de perfil") — avatar e texto eram dois `View` com
              * `position: absolute` INDEPENDENTES, cada um com seu
              * próprio offset (`bottom: 0` pro avatar, `bottom: 6` pro
              * texto) — um jeito frágil de "alinhar" que só por
              * coincidência ficava perto de centralizado quando o
              * texto tinha 3 linhas (nome/@/"membro desde"); tirando a
              * linha "Membro desde {joinDate}" o bloco de texto fica
              * mais baixo (2 linhas), e um offset fixo em pixel não
              * re-centraliza sozinho. Virou UMA `View` só, com
              * `flexDirection: "row"` + `alignItems: "center"`
              * (`avatarHeaderRow`) posicionada como antes (mesmo
              * `bottom: 0` que o avatar já usava) — agora o texto fica
              * sempre centralizado verticalmente contra o avatar,
              * não importa quantas linhas tiver.
              */}
            <View style={styles.avatarHeaderRow}>
              <View style={styles.avatarOverlap}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
                )}
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={1} variant="subtitle">
                  {user.name}
                </Text>
                {!!username && <Text style={styles.username}>@{username}</Text>}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.topIconsRowNoBanner}>
            {!!username && (
              <Pressable hitSlop={8} onPress={handleShare}>
                <Glass style={styles.bannerIconButtonFlat}>
                  <Feather name="share-2" size={16} color={colors.muted} />
                </Glass>
              </Pressable>
            )}
            <Pressable hitSlop={8} onPress={() => router.push("/settings")}>
              <Glass style={styles.bannerIconButtonFlat}>
                <Feather name="settings" size={16} color={colors.muted} />
              </Glass>
            </Pressable>
          </View>
        )}

        {!bannerUrl && (
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
              )}
            </View>
            <View style={styles.headerText}>
              <Text numberOfLines={1} variant="subtitle">
                {user.name}
              </Text>
              {!!username && <Text style={styles.username}>@{username}</Text>}
            </View>
          </View>
        )}

        {!!bio && <Text style={styles.bio}>{bio}</Text>}

        {/*
          * CORREÇÃO #3 (a pedido, 2026-09-02 — comparação lado a lado
          * com print real do web, "não está igual") — o `ProfileHeader.tsx`
          * do web pinta cada pílula com um `radial-gradient` branco no
          * canto superior esquerdo (todas as 3), e a ÚLTIMA (Comentários)
          * ganha um segundo, azulado, no canto inferior direito. O
          * `Glass` genérico daqui só tem UM gradiente neutro igual em
          * toda pílula (`glass.gradientNeutral`, `Glass.tsx`) — sem
          * variação por card, ficava mais "chapado"/uniforme que o web.
          * Camadas extra aqui, por CIMA do gradiente neutro do `Glass`
          * (mesma ideia de `PROFILE_GLOW_BLOBS` acima — ajuste no
          * COMPONENTE, sem tocar na base `Glass.tsx`) — `LinearGradient`
          * no lugar do `radial-gradient` do web (RN não tem radial),
          * `start`/`end` apontando pro mesmo canto que o web usa.
          */}
        <View style={styles.countsRow}>
          <Pressable style={styles.countCardFlex} onPress={() => router.push(`/follow-list/${user.id}/following`)}>
            <Glass style={styles.countCard}>
              <LinearGradient
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                start={{ x: 0.22, y: 0.12 }}
                end={{ x: 0.85, y: 0.75 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Text style={styles.countNumber}>{counts.following}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Seguindo
              </Text>
            </Glass>
          </Pressable>
          <Pressable style={styles.countCardFlex} onPress={() => router.push(`/follow-list/${user.id}/followers`)}>
            <Glass style={styles.countCard}>
              <LinearGradient
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                start={{ x: 0.22, y: 0.12 }}
                end={{ x: 0.85, y: 0.75 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Text style={styles.countNumber}>{counts.followers}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Seguidores
              </Text>
            </Glass>
          </Pressable>
          <Pressable style={styles.countCardFlex} onPress={() => router.push("/profile/comments")}>
            <Glass style={styles.countCard}>
              <LinearGradient
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
                start={{ x: 0.22, y: 0.12 }}
                end={{ x: 0.85, y: 0.75 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(42,127,184,0)", "rgba(42,127,184,0.22)"]}
                start={{ x: 0.4, y: 0.3 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Text style={styles.countNumber}>{socialCounts?.commentsGiven ?? 0}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Comentários
              </Text>
            </Glass>
          </Pressable>
        </View>

        {!bannerUrl && (
          <View style={styles.actionsRow}>
            <Pressable onPress={() => router.push("/settings/edit-profile")}>
              <GelSurface style={styles.editButton}>
                <Text style={styles.editButtonText}>Editar</Text>
              </GelSurface>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <StatisticsCard />
        </View>

        <View style={styles.sectionsWrapper}>
          <ProfileRecommendationsPreview />
          <ProfileListsPreview />
          <ProfileMediaCarousel
            icon="tv"
            label="Séries"
            href="/profile/series"
            mediaType="series"
            ids={seriesActivity.ids}
            isLoadingIds={seriesActivity.isLoading}
          />
          <ProfileMediaCarousel
            icon="star"
            label="Séries favoritas"
            href="/profile/favorite-series"
            mediaType="series"
            ids={favoriteSeries.ids}
            isLoadingIds={favoriteSeries.isLoading}
            emptyLabel="Adicionar séries favoritas"
            emptyHref="/profile/series"
          />
          <ProfileMediaCarousel
            icon="film"
            label="Filmes"
            href="/profile/movies"
            mediaType="movie"
            ids={movieActivity.ids}
            isLoadingIds={movieActivity.isLoading}
          />
          <ProfileMediaCarousel
            icon="star"
            label="Filmes favoritos"
            href="/profile/favorite-movies"
            mediaType="movie"
            ids={favoriteMovies.ids}
            isLoadingIds={favoriteMovies.isLoading}
            emptyLabel="Adicionar filmes favoritos"
            emptyHref="/profile/movies"
          />
        </View>
      </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

// AJUSTE (2026-09-03, a pedido — "aumenta uns 15% o tamanho da foto de perfil no mobile") — era 64, 64 × 1.15 = 73.6, arredondado pra 74.
const AVATAR_SIZE = 74;

const styles = StyleSheet.create({
  /**
   * A PEDIDO ("o fundo ficar parado no mobile") — preenche a área
   * disponível da `Screen` (que já é `flex: 1`) pra que o `BlurTargetView`
   * (dentro do `GlassTargetProvider`) tenha o tamanho da TELA, não do
   * conteúdo rolável. Ver comentário logo acima do JSX que usa este estilo.
   */
  glassFill: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  /**
   * CORREÇÃO (2026-09-03, achado comparando com o web de verdade —
   * `ProfileHeader.tsx`, "ENTREGA 8": "capa de 176px (h-44) virou
   * 224px (h-56, medido no print real do publicado)") — `bannerInner`
   * estava em 168 (nem o valor NOVO do web, 224, nem o antigo, 176 —
   * parece ter ficado pra trás de uma versão anterior e nunca foi
   * atualizado junto com o web). `bannerOuter` = `bannerInner` + a
   * mesma folga de 40px que já existia (208−168=40) — reservada pra
   * `avatarHeaderRow` (abaixo, `bottom: 0` ancorado NELE, não na
   * imagem) sobrar espaço por baixo da capa sem cortar o avatar; só o
   * tamanho da IMAGEM estava errado, a lógica da folga em si continua
   * a mesma, só recalculada em cima do novo valor (224+40=264).
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
  /** CORREÇÃO (2026-09-03, comparado com o web) — era 56; o web usa `h-16` (`ProfileHeader.tsx`: "bottom-0 h-16 bg-gradient-to-t...") = 64px. */
  fadeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  /** Posição (fica no `Pressable` de fora) separada da aparência (fica no `Glass` de dentro) — `position: absolute` num filho de um `Pressable` sem tamanho próprio faz a área de toque colapsar pra 0×0. */
  bannerIconLeft: {
    position: "absolute",
    left: 12,
    top: 12,
  },
  bannerIconGlass: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.xs` (4); o web usa `gap-2` (`ProfileHeader.tsx`, ícones da direita) = 8px. */
  bannerIconsRight: {
    position: "absolute",
    right: 12,
    top: 12,
    flexDirection: "row",
    gap: spacing.sm,
  },
  bannerIconButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconButtonFlat: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.xs` (4); o web usa `gap-2` (`ProfileHeader.tsx`, "flex justify-end gap-2 pb-2") = 8px. */
  /** CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web usa `px-4` (`spacing.md`=16) como borda de tela. */
  topIconsRowNoBanner: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  /**
   * TASK-172 (redesign — achado real, bug já corrigido antes no web
   * de um jeito parecido) — o avatar sobreposto usa posição absoluta
   * ancorada na borda de baixo da capa (`bannerOuter`), não fica na
   * mesma fileira flex do nome — mesmo raciocínio do web
   * (`ProfileHeader.tsx`): manter os dois na mesma fileira faz o
   * bloco de texto (mais alto que o avatar) ser espremido junto.
   *
   * CORREÇÃO (2026-09-03, a pedido — "alinha os outros dados com a
   * foto de perfil", ver comentário completo no JSX) — quem fica
   * `position: absolute` ancorado na capa agora é a FILEIRA inteira
   * (`avatarHeaderRow`, abaixo), não mais o avatar sozinho — dentro
   * dela avatar e texto são filhos flex normais, com
   * `alignItems: "center"` centralizando os dois de verdade.
   */
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `left`/`right` eram `spacing.lg` (24); web usa
  // `px-4` (`spacing.md`=16) como borda de tela.
  avatarHeaderRow: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatarOverlap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    /**
     * CORREÇÃO #3 (a pedido, 2026-09-02 — comparação lado a lado com
     * print real do web) — era `colors.primary` (âmbar sólido). O
     * anel do avatar no web (`ProfileHeader.tsx`) é um anel de VIDRO
     * translúcido (`border border-white/40`, com um brilho radial por
     * trás) — nada de âmbar ali. Trocado pro mesmo tom branco
     * translúcido; a "vidro-ice" completa (blur/gradiente por trás do
     * anel) foi deixada de fora de propósito — o efeito real, no web,
     * fica quase todo COBERTO pela própria foto do avatar por cima
     * (só uns 2px de anel aparecem), então a cor certa da borda já
     * resolve a maior parte da diferença visível, sem precisar de
     * camada de blur nova nenhuma aqui.
     */
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  /**
   * CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.md`
   * (16) tinha ficado pra trás do AJUSTE que já foi aplicado no
   * `avatarHeaderRow` (caso COM capa, `gap: spacing.sm`): o web
   * (`ProfileHeader.tsx`, "AJUSTE... gap-4 → gap-2 pra 'juntar mais' o
   * nome/@ da foto") usa `gap-2` (8px) nos DOIS casos, com e sem capa
   * — só este aqui (caso SEM capa) não tinha recebido o mesmo ajuste.
   */
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    /**
     * CORREÇÃO #3 (a pedido, 2026-09-02 — comparação lado a lado com
     * print real do web) — era `colors.primary` (âmbar sólido). O
     * anel do avatar no web (`ProfileHeader.tsx`) é um anel de VIDRO
     * translúcido (`border border-white/40`, com um brilho radial por
     * trás) — nada de âmbar ali. Trocado pro mesmo tom branco
     * translúcido; a "vidro-ice" completa (blur/gradiente por trás do
     * anel) foi deixada de fora de propósito — o efeito real, no web,
     * fica quase todo COBERTO pela própria foto do avatar por cima
     * (só uns 2px de anel aparecem), então a cor certa da borda já
     * resolve a maior parte da diferença visível, sem precisar de
     * camada de blur nova nenhuma aqui.
     */
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: fontSize.lg,
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
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); o web usa `mt-4` (`ProfileHeader.tsx`, bio) = 16px. */
  /** CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web usa `px-4` (`spacing.md`=16) como borda de tela. */
  bio: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.sm` (8); o web usa `gap-2.5` (`ProfileHeader.tsx`, "mt-4 flex gap-2.5") = 10px — sem token exato, valor literal. */
  /** CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web usa `px-4` (`spacing.md`=16) como borda de tela. */
  countsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  countCardFlex: {
    flex: 1,
  },
  /**
   * CORREÇÃO (2026-09-03, comparado com o web) — o web
   * (`ProfileHeader.tsx`, pílula de contagem) usa `px-1.5 py-3`
   * (6px/12px) — `paddingHorizontal` não existia aqui (texto
   * dependia só da centralização do flex, sem respiro nenhum das
   * bordas), e `paddingVertical` estava em `spacing.sm` (8) em vez de
   * 12. Radius continua o do `Glass` (vidro, fora do escopo desta
   * correção).
   */
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
  /** CORREÇÃO (2026-09-03, comparado com o web) — era 11; o web usa `text-xs` (`ProfileHeader.tsx`, legenda da pílula) = 12px. */
  countLabel: {
    fontSize: fontSize.xs,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  // `paddingHorizontal: spacing.lg` aqui NÃO foi tocado — é padding
  // interno do botão (respiro do texto dentro do pill), não borda de
  // tela; fora do escopo da padronização de 2026-09-03.
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. `marginTop`
  // (ritmo vertical entre seções) NÃO foi tocado — fora do escopo.
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionsWrapper: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
