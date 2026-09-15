import { useState, useCallback, useEffect } from "react";
/*
 * `Image as RNImage`: este arquivo já importa o `Image` do `expo-image`
 * (linha abaixo) pras fotos. O brilho azulado da 3ª pílula precisa do
 * `Image` do react-native porque usa `tintColor`, que é onde ele
 * funciona — o mesmo padrão do `AmbientGlow`/`Glass`.
 */
import { ScrollView, View, Pressable, StyleSheet, Image as RNImage } from "react-native";
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
import { Screen, Text, GlassTargetProvider, Glass, AmbientGlow, type GlowBlob } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { StatisticsCard } from "@/components/profile/StatisticsCard";
import { ProfileRecommendationsPreview } from "@/components/profile/ProfileRecommendationsPreview";
import { ProfileListsPreview } from "@/components/profile/ProfileListsPreview";
import { ProfileMediaCarousel } from "@/components/profile/ProfileMediaCarousel";
import { NotificationBell } from "@/components/profile/NotificationBell";
import { ProfileMoreSheet } from "@/components/profile/ProfileMoreSheet";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

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
const GLOW_PILL = require("../../assets/images/glow-soft.png");

const PROFILE_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.45)", top: 220, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 460, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.45)", top: 610, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 760, right: -100, size: 240 },
  { color: "rgba(27,75,122,0.35)", top: 880, left: -80, size: 224 },
  { color: "rgba(42,127,184,0.28)", top: 1140, right: -90, size: 192 },
  { color: "rgba(13,59,92,0.2)", top: 1450, left: -70, size: 176 },
  { color: "rgba(27,75,122,0.12)", top: 1760, right: -70, size: 160 },
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
  const { t } = useTranslation();
  const counts = useFollowCounts(user?.id ?? null);
  const socialCounts = useSocialCounts(user?.id ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
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
            {/*
              * CAUSA RAIZ (2026-09-04, print real — "os botões do header
              * ficam azuis; no web eles pegam o marrom da foto").
              *
              * Estes três botões usam `Glass`, mas eram IRMÃOS da capa —
              * então o `GlassTargetProvider` mais próximo era o da tela
              * inteira, cujo alvo de blur é o `AmbientGlow`. Eles estavam
              * desfocando o campo azul do fundo, não a fotografia que
              * está fisicamente atrás deles. Nenhum ajuste de cor
              * resolveria isso: é o ALVO que estava errado.
              *
              * No web não existe essa distinção — `backdrop-filter`
              * sempre amostra o que está atrás, e atrás ali é a capa.
              *
              * Fix: a capa passa a ser o `background` de um
              * `GlassTargetProvider` PRÓPRIO (ou seja, vai pra dentro da
              * `BlurTargetView`, continuando visível normalmente), e os
              * botões viram FILHOS dele — irmãos da `BlurTargetView`,
              * nunca dentro dela, que é a regra que evita o crash
              * documentado em `Glass.tsx`. Como o contexto mais próximo
              * passa a ser este, o `Glass` de cada botão amostra a foto.
              *
              * `base="transparent"` porque quem pinta o fundo aqui é a
              * própria imagem — a base escura padrão a cobriria.
              */}
            <GlassTargetProvider
              style={styles.bannerInner}
              base="transparent"
              background={
                <>
                  <Image source={{ uri: bannerUrl }} style={styles.banner} contentFit="cover" />
                  <LinearGradient
                    colors={["transparent", colors.background]}
                    style={styles.fadeOverlay}
                    pointerEvents="none"
                  />
                </>
              }
            >
              <View style={styles.bannerIconLeft}>
                <NotificationBell />
              </View>

              <Pressable
                hitSlop={8}
                style={styles.bannerIconsRight}
                accessibilityLabel={t("profile.moreOptions")}
                onPress={() => setShowMore(true)}
              >
                <Glass variant="icon" style={styles.bannerIconButton}>
                  <Feather name="more-horizontal" size={16} color={colors.text} />
                </Glass>
              </Pressable>
            </GlassTargetProvider>

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
              <Avatar uri={user.avatarUrl} name={user.name} style={styles.avatarOverlap} textStyle={styles.avatarInitials} />
              <View style={styles.headerText}>
                <Text numberOfLines={1} variant="subtitle" style={styles.displayName}>
                  {user.name}
                </Text>
                {!!username && <Text style={styles.username}>@{username}</Text>}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.topIconsRowNoBanner}>
            <NotificationBell flat />
            <Pressable hitSlop={8} accessibilityLabel={t("profile.moreOptions")} onPress={() => setShowMore(true)}>
              <Glass style={styles.bannerIconButtonFlat}>
                <Feather name="more-horizontal" size={16} color={colors.muted} />
              </Glass>
            </Pressable>
          </View>
        )}

        {!bannerUrl && (
          <View style={styles.headerRow}>
            <Avatar uri={user.avatarUrl} name={user.name} style={styles.avatar} textStyle={styles.avatarInitials} />
            <View style={styles.headerText}>
              <Text numberOfLines={1} variant="subtitle" style={styles.displayName}>
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
          * CORREÇÃO (2026-09-09, medida no print a pedido — "no web tem
          * um brilho suave no lado superior esquerdo, no mobile esse
          * brilho toma o lado esquerdo todo de cima a baixo e é mais
          * forte").
          *
          * Estas pílulas tinham um `LinearGradient` diagonal
          * (branco 0.18, de 22%/12% até 85%/75%) SOMADO ao brilho que o
          * próprio `Glass` já desenha. Dois problemas de uma vez:
          *
          *   FORMA — gradiente linear não tem queda radial. A cor varia
          *   só ao longo do eixo do gradiente, então o canto inferior
          *   esquerdo, que quase não avança nesse eixo, fica tão aceso
          *   quanto o superior esquerdo. Daí "toma o lado esquerdo todo
          *   de cima a baixo". Mapa do azul medido na pílula do meio,
          *   grade normalizada, topo → base:
          *
          *       web                          mobile
          *       79  88  77  60  48  45  44    41 121 110  91  81  71  64
          *       75  78  70   —  46  45  44   117 117 107  86   —  72  62
          *       64  64  58  49  46  45  44   106 104  95  83  76  67  60
          *       57  54  51  48   —  45  44   104  98 102   —  71   —  60
          *       57  54  50  47  46  45  45    44  93  87  76  70  64  58
          *
          *   No web o brilho MORRE: 45 chapado na metade direita e no
          *   rodapé. No mobile a coluna esquerda fica em 104-117 inteira.
          *
          *   FORÇA — eram DOIS brancos empilhados (o 0.17 da receita
          *   `card` do `Glass` mais este 0.18), quando o web tem um só.
          *
          * Fix: o gradiente extra saiu, e as pílulas passaram a usar uma
          * receita própria (`pill`, em `lib/theme.ts`) com os números
          * exatos do `ProfileHeader.tsx` do web — inclusive a base
          * BRANCA em vez do azul compensado das outras receitas, que é o
          * que a medição do print mostra. O segundo brilho azulado da
          * última pílula continua, agora como radial de verdade.
          */}
        <View style={styles.countsRow}>
          <Pressable style={styles.countCardFlex} onPress={() => router.push(`/follow-list/${user.id}/following`)}>
            <Glass style={styles.countCard} variant="pill">
              <Text style={styles.countNumber}>{counts.following}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Seguindo
              </Text>
            </Glass>
          </Pressable>
          <Pressable style={styles.countCardFlex} onPress={() => router.push(`/follow-list/${user.id}/followers`)}>
            <Glass style={styles.countCard} variant="pill">
              <Text style={styles.countNumber}>{counts.followers}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Seguidores
              </Text>
            </Glass>
          </Pressable>
          <Pressable style={styles.countCardFlex} onPress={() => router.push("/profile/comments")}>
            <Glass style={styles.countCard} variant="pill">
              {/*
                O segundo brilho da ÚLTIMA pílula, o azulado do canto
                inferior direito. No web:
                `radial-gradient(70% 90% at 85% 100%, rgba(42,127,184,0.22), transparent 60%)`.
                Vira caixa: raios visíveis 0.6×70 = 42% da largura e
                0.6×90 = 54% da altura, centro em 85%/100% → esquerda
                43%, topo 46%, 84% × 108%. Opacidade 0.22/0.867 = 0.254
                (o 0.867 é o alpha do centro do PNG, ver `lib/theme.ts`).
              */}
              <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <RNImage source={GLOW_PILL} resizeMode="stretch" style={styles.countCardBlueGlow} />
              </View>
              <Text style={styles.countNumber}>{socialCounts?.commentsGiven ?? 0}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Comentários
              </Text>
            </Glass>
          </Pressable>
        </View>

        <View style={styles.section}>
          <StatisticsCard />
        </View>

        <View style={styles.sectionsWrapper}>
          {/*
            * CORREÇÃO (2026-09-04, auditoria mobile × web) — no web
            * (`ProfileSectionsList.tsx`) este bloco vem dentro de uma
            * `<section className="mb-6">` (24), que soma com o `mb-2`
            * (8) do próprio card: 32px até "Minhas listas". Aqui só
            * existia o respiro do card, então o gap era 8.
            */}
          <View style={styles.recommendationsBlock}>
            <ProfileRecommendationsPreview />
          </View>
          <ProfileListsPreview />
          {/*
            * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem
            * alguma pendência de design", 2026-09-16) — os 6 rótulos
            * abaixo (título + "vazio, adicionar") dos carrosséis de
            * Séries/Filmes/Favoritos estavam com texto fixo em
            * português, apesar do componente já ter `useTranslation()`
            * importado (usado em outro ponto desta mesma tela). No
            * web (`ProfileSectionsList.tsx`) os rótulos "Séries"/
            * "Filmes" (sem ser favoritos) usam `t("nav.series")`/
            * `t("nav.movies")` — mesmas chaves já usadas na barra de
            * navegação, reaproveitadas aqui; as de favoritos usam
            * `profile.section.favoriteSeries` etc, só que o mobile já
            * tinha equivalentes PRÓPRIOS e já traduzidos nas 3 línguas
            * (`profile.favoriteSeries`/`profile.addFavoriteSeries`/
            * `profile.favoriteMovies`/`profile.addFavoriteMovies`) —
            * reaproveitados sem criar chave nova, só ligados aqui.
            */}
          <ProfileMediaCarousel
            icon="tv"
            label={t("nav.series")}
            href="/profile/series"
            mediaType="series"
            ids={seriesActivity.ids}
            isLoadingIds={seriesActivity.isLoading}
          />
          <ProfileMediaCarousel
            icon="star"
            label={t("profile.favoriteSeries")}
            href="/profile/favorite-series"
            mediaType="series"
            ids={favoriteSeries.ids}
            isLoadingIds={favoriteSeries.isLoading}
            emptyLabel={t("profile.addFavoriteSeries")}
            emptyHref="/profile/series"
          />
          <ProfileMediaCarousel
            icon="film"
            label={t("nav.movies")}
            href="/profile/movies"
            mediaType="movie"
            ids={movieActivity.ids}
            isLoadingIds={movieActivity.isLoading}
          />
          <ProfileMediaCarousel
            icon="star"
            label={t("profile.favoriteMovies")}
            href="/profile/favorite-movies"
            mediaType="movie"
            ids={favoriteMovies.ids}
            isLoadingIds={favoriteMovies.isLoading}
            emptyLabel={t("profile.addFavoriteMovies")}
            emptyHref="/profile/movies"
          />
        </View>
      </ScrollView>
      </GlassTargetProvider>
      {showMore && <ProfileMoreSheet username={username} onClose={() => setShowMore(false)} />}
    </Screen>
  );
}

// AJUSTE (2026-09-03, a pedido — "aumenta uns 15% o tamanho da foto de perfil no mobile") — era 64, 64 × 1.15 = 73.6, arredondado pra 74.
const AVATAR_SIZE = 74;

const styles = StyleSheet.create({
  /** Ver o comentário na 3ª pílula — a caixa é o raio visível do `radial-gradient` do web. */
  countCardBlueGlow: {
    position: "absolute",
    left: "43%",
    top: "46%",
    width: "84%",
    height: "108%",
    tintColor: "rgb(42,127,184)",
    opacity: 0.254,
  },
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
  /**
   * CORREÇÃO (2026-09-04, auditoria mobile × web) — a folga abaixo da
   * capa era 40px (264-224), chutada. No web
   * (`ProfileHeader.tsx`) o bloco avatar+nome é `-bottom-8` = 32px
   * abaixo da capa, então a caixa é 224+32 = 256. E o respiro depois
   * da fileira é `mb-14` (56) menos os 32 que o avatar já desceu = 24
   * (`spacing.lg`), não 12 — a bio estava colada.
   *
   * REVERTIDO (a pedido, 2026-09-15 — "volta pra a versão do banner
   * do tamanho que está no web", comparado com o que ainda está
   * publicado em seenlist.app) — chegou a ser reduzido pra 112px
   * (mesmo valor de `edit-profile.tsx`) nesta mesma sessão, mas o
   * usuário pediu de volta o tamanho grande original. O anel escuro
   * do avatar (`avatarOverlap`, mais abaixo) NÃO foi revertido — só o
   * tamanho da capa.
   */
  bannerOuter: {
    height: 256,
    marginBottom: spacing.lg,
  },
  bannerInner: {
    height: 224,
    backgroundColor: colors.surface,
    overflow: "hidden",
    /** `rounded-b-lg` do web (`ProfileHeader.tsx`, capa) = 8px só embaixo. */
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
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
  /** A PEDIDO (2026-09-15) — antes só tinha ícones do lado direito (`justify-end`); agora o sino fica à esquerda e o "..." à direita, então virou `space-between`. */
  topIconsRowNoBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    /**
     * CORREÇÃO (2026-09-04) — era 2px. O web usa `border` = 1px, e o
     * anel fica POR FORA do avatar (`-inset-0.5`), não por dentro —
     * com 2px por dentro, a foto perdia 4px de diâmetro (74 → 70).
     *
     * REVERTIDO (a pedido, 2026-09-16 — comparação lado a lado com o
     * web publicado em seenlist.app: "faltou reverter esse círculo
     * preto ao redor do avatar, pra igual como está no web") — chegou
     * a virar um anel SÓLIDO na cor de fundo do app (`borderWidth: 4,
     * borderColor: colors.background`, "meia lua preta", mesma leva
     * que reduziu a capa pra 112px) mas isso nunca foi publicado no
     * web (só existe local, não commitado/deployado) — o usuário
     * comparou o app mobile já buildado com o que está DE VERDADE no
     * ar em seenlist.app, viu a diferença e pediu de volta o anel
     * branco translúcido de 1px original. Escopo confirmado via
     * AskUserQuestion: só mobile (esta tela + Perfil público em
     * `app/u/[username]/index.tsx`) — o código do web (ainda não
     * publicado) fica como está.
     */
    borderWidth: 1,
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
    /**
     * CORREÇÃO (2026-09-04) — era `spacing.md` (16), que somado ao
     * `marginBottom: 8` da fileira de ícones dava 24. No web (caso SEM
     * capa) só existe o `pb-2` (8) daquela fileira.
     */
    marginTop: 0,
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
    /**
     * CORREÇÃO (2026-09-04) — era 2px. O web usa `border` = 1px, e o
     * anel fica POR FORA do avatar (`-inset-0.5`), não por dentro —
     * com 2px por dentro, a foto perdia 4px de diâmetro (74 → 70).
     */
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: fontSize.lg,
    /** CORREÇÃO (2026-09-04) — era 700; o `Avatar.tsx` do web usa `font-semibold` = 600. */
    fontWeight: "600",
    color: colors.muted,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  /** CORREÇÃO (2026-09-10) — ver comentário completo em `displayName`, acima (mesma causa raiz). `text-sm` do Tailwind = 20px de `lineHeight`. */
  username: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.primary,
  },
  /**
   * CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); o web usa `mt-4` (`ProfileHeader.tsx`, bio) = 16px.
   * CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web usa `px-4` (`spacing.md`=16) como borda de tela.
   * CORREÇÃO (2026-09-10) — `lineHeight: 20` (mesma causa raiz do `displayName`/`username`, ver comentário lá): sem isso a PRÓPRIA bio também flutua mais alto que o web dentro da sua caixa, o que empurrava as pílulas de contagem (`countsRow`, logo abaixo) proporcionalmente mais longe da bio do que no web.
   *
   * AJUSTE (a pedido, "sobe uns 15% a bio no mobile, pra perto da foto
   * do avatar", 2026-09-16) — DIVERGÊNCIA INTENCIONAL do web (que
   * continua em 16px, `mt-4`, sem pedido de mudança lá): 16 × 0,85 =
   * 13,6, arredondado pra 14. Só este valor mudou — `paddingHorizontal`/
   * `fontSize`/`lineHeight`/cor continuam os mesmos de antes.
   *
   * AJUSTE #2 (a pedido, "sobe mais uns 30%", mesma sessão) — mais
   * 30% em cima do valor JÁ reduzido (14, não do 16 original): 14 ×
   * 0,7 = 9,8, arredondado pra 10.
   */
  bio: {
    marginTop: 10,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    lineHeight: 20,
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
    /** CORREÇÃO (2026-09-04) — era `radius.md` (10); web `rounded-2xl` = 16. */
    borderRadius: radius.lg,
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
  // usa `px-4` (`spacing.md`=16) como borda de tela. `marginTop`
  // (ritmo vertical entre seções) NÃO foi tocado — fora do escopo.
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  /**
   * `text-lg font-bold` do web (`ProfileHeader.tsx`, nome) = 18/700;
   * `variant="subtitle"` sozinho é 18/600.
   *
   * CORREÇÃO (2026-09-10, reportado — "distância da bio diferente do
   * web") — medido em print real, lado a lado: a folga entre o final
   * do "@usuário" e o início da bio ficava proporcionalmente ~40-50%
   * maior no mobile do que no web (mesma régua: diâmetro do avatar,
   * que é 74px nos dois). Causa raiz: `Text.tsx` (base do app) e este
   * arquivo nunca definem `lineHeight` em lugar nenhum — sem isso, o
   * RN usa a métrica vertical PRÓPRIA da fonte ("Plus Jakarta Sans"),
   * que é bem mais generosa que o `line-height` do Tailwind (o web
   * usa só `text-lg`/`text-sm`, sem `leading-*` custom, então é
   * sempre o padrão do Tailwind: 28px pra `text-lg`, 20px pra
   * `text-sm`) — o texto "flutua" mais alto dentro da própria caixa
   * de linha, sobrando mais espaço visível embaixo dele antes da
   * `bio` (que tem `marginTop` fixo, igual ao web — não é o marginTop
   * que está errado, é a caixa de linha do texto ACIMA que é maior
   * que deveria). `lineHeight: 28` trava a caixa deste texto no
   * mesmo valor do `text-lg` do Tailwind.
   */
  displayName: {
    fontWeight: "700",
    lineHeight: 28,
  },
  /** Ver o comentário no JSX — `mb-6` (24) da `<section>` do web em volta das Recomendações. */
  recommendationsBlock: {
    marginBottom: spacing.lg,
  },
  sectionsWrapper: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
