import { useState, useCallback, useEffect } from "react";
/*
 * `Image as RNImage`: este arquivo já importa o `Image` do `expo-image`
 * (linha abaixo) pras fotos. O brilho azulado da 3ª pílula precisa do
 * `Image` do react-native porque usa `tintColor`, que é onde ele
 * funciona — o mesmo padrão do `AmbientGlow`/`Glass`.
 */
import { ScrollView, View, Pressable, StyleSheet, Image as RNImage } from "react-native";
import { Image } from "expo-image";
/**
 * REDESENHO "CAPA CURTA E MINIMALISTA" (a pedido — "não gostei,
 * implementa a versão F- Capa curta e minimalista", 2026-09-16, depois
 * de já ter implementado e depois abandonado a versão D "cartão de
 * vidro flutuante") — o véu escuro por cima da capa é uma cor sólida
 * (`bannerDarken`, sem gradiente), mas a transição pro fundo da tela lá
 * embaixo (`bannerFade`) precisa ser gradual — daí o `LinearGradient`
 * de volta (tinha saído junto com a versão D, que não precisava dele).
 */
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
import { Screen, Text, GlassTargetProvider, Glass, PressableScale, AmbientGlow, type GlowBlob } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
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

/*
 * PARIDADE DE BRILHO (2026-09-16, a pedido — "troque em profile
 * também, eu disse TODAS AS TELAS IGUAIS"). Mesmo fator combinado
 * aplicado em `HOME_GLOW_BLOBS`/`lib/glowBlobs.ts` (×1.45 × 1.20 =
 * ×1.74) aplicado em cada opacidade aqui — mesma iluminação em todas
 * as telas com esta paleta azul, perfil incluso.
 */
const PROFILE_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 220, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 460, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.78)", top: 610, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 760, right: -100, size: 240 },
  { color: "rgba(27,75,122,0.61)", top: 880, left: -80, size: 224 },
  { color: "rgba(42,127,184,0.49)", top: 1140, right: -90, size: 192 },
  { color: "rgba(13,59,92,0.35)", top: 1450, left: -70, size: 176 },
  { color: "rgba(27,75,122,0.21)", top: 1760, right: -70, size: 160 },
];

const EDITABLE_PROFILE_CACHE_VERSION = 1;

function editableProfileCacheKeyFor(userId: string): string {
  return `seenlist:profile:editable-fields:v${EDITABLE_PROFILE_CACHE_VERSION}:${userId}`;
}

interface CachedEditableFields {
  bannerUrl: string | null;
  bannerFocalY: number;
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
  /** A PEDIDO ("eu não consigo redimensionar o banner pra ficar do jeito que eu quero") — 0 a 1, aplicado no `contentPosition` da `<Image>` do banner, mais abaixo. */
  const [bannerFocalY, setBannerFocalY] = useState(0.5);
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
        setBannerFocalY(cached.bannerFocalY ?? 0.5);
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
        const nextBannerFocalY = profile.bannerFocalY ?? 0.5;
        const nextBio = profile.bio || null;
        const nextUsername = profile.username || null;
        setBannerUrl(nextBannerUrl);
        setBannerFocalY(nextBannerFocalY);
        setBio(nextBio);
        setUsername(nextUsername);
        if (cacheUserId) {
          AsyncStorage.setItem(
            editableProfileCacheKeyFor(cacheUserId),
            JSON.stringify({
              bannerUrl: nextBannerUrl,
              bannerFocalY: nextBannerFocalY,
              bio: nextBio,
              username: nextUsername,
            } satisfies CachedEditableFields)
          ).catch((error) => {
            console.warn("[ProfileScreen] Falha ao salvar cache local de perfil", error);
          });
        }
      });
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
      {/*
        * TESTE DIAGNÓSTICO (2026-09-16) REVERTIDO — resultado: grão
        * continuou mesmo com fundo sólido (sem `AmbientGlow`/dither
        * nenhum), então a causa não é o conteúdo capturado, é a própria
        * cadeia de renderização do card. Investigação continua num
        * componente de teste separado (`app/debug-grain.tsx`), sem
        * tocar mais nesta tela — fundo de volta ao de sempre.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={PROFILE_GLOW_BLOBS} />}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
        {bannerUrl ? (
          /*
            * REDESENHO "CAPA CURTA E MINIMALISTA" (a pedido — "não
            * gostei, implementa a versão F- Capa curta e minimalista",
            * 2026-09-16, substituindo o "cartão de vidro flutuante"
            * (versão D) implementado momentos antes nesta mesma sessão
            * — histórico completo dessa tentativa fica só neste
            * comentário pra não duplicar: capa arredondada com margem +
            * cartão de vidro escuro sobrepondo a borda de baixo).
            *
            * Volta a ser EDGE-TO-EDGE (sem `paddingHorizontal`/margem
            * lateral nem cantos arredondados nos 4 lados — só embaixo),
            * bem mais baixa, com um véu escuro (`bannerDarken`) por
            * cima da foto INTEIRA (não só um gradiente embaixo, como na
            * versão A original) — a foto vira "clima de fundo" em vez
            * de protagonista, e nome/@ ficam sempre legíveis não
            * importa quão clara seja a foto. `bannerFade` (gradiente pro
            * `colors.background`) cuida só da transição suave pro resto
            * da tela, na faixa final de baixo.
            *
            * Avatar (`avatarShort`, 66px — menor que os 74px do avatar
            * solto da versão A) + nome/@ (`shortRow`) ficam ancorados na
            * borda de baixo da capa, igual à versão A original — a
            * diferença é a capa mais baixa e o véu escuro por trás,
            * garantindo contraste mesmo sem cartão nenhum por baixo.
            */
          <View style={styles.bannerSection}>
            {/*
              * CORREÇÃO (a pedido — "você fez a mudança no header, mas
              * não está igual a opção F", com print comparando lado a
              * lado, 2026-09-16) — CAUSA RAIZ achada comparando pixel a
              * pixel os dois prints: no mockup da versão F a FOTO
              * termina ANTES do fim do bloco (`f-banner` tinha
              * `inset: 0 0 26px 0` dentro do `f-wrap` de 190px — ou
              * seja, a foto só ocupa os 164px de cima; os 26px de baixo
              * já são o FUNDO LISO da tela, sem foto nenhuma), e é
              * NESSA faixa lisa que o nome/@ ficam apoiados. Na minha
              * primeira implementação a imagem preenchia o bloco INTEIRO
              * (190px) e só o degradê (`bannerFade`) disfarçava — dava
              * pra ver pedaço de personagem atrás do nome/@ no
              * emulador, o que não acontece no mockup.
              *
              * Fix: `bannerPhoto` agora é um bloco `position: absolute`
              * de 164px (190-26) dentro de `bannerShort` — só ele tem a
              * foto/véu escuro/degradê/ícones; os 26px finais de
              * `bannerShort` ficam com o `backgroundColor` liso
              * (`colors.background`, o mesmo do resto da tela) que
              * definia antes só no `Glass`/gradiente. `shortRow`
              * continua `bottom: 0` do `bannerShort` (não mudou) — como
              * o avatar (66px) é mais alto que a faixa lisa (26px), ele
              * segue subindo e sobrepondo um pouco a foto por cima,
              * igual ao mockup.
              */}
            <View style={styles.bannerShort}>
              {/*
                * CAUSA RAIZ (2026-09-04, print real — "os botões do
                * header ficam azuis; no web eles pegam o marrom da
                * foto") — ainda vale igual: os botões precisam
                * continuar FILHOS do `GlassTargetProvider` da própria
                * foto (não irmãos dela), senão voltam a amostrar o
                * campo azul do `AmbientGlow` da tela em vez da
                * fotografia atrás deles. `base="transparent"` porque
                * quem pinta o fundo aqui é a própria imagem — a base
                * escura padrão a cobriria.
                */}
              <GlassTargetProvider
                style={styles.bannerPhoto}
                base="transparent"
                background={
                  <Image
                    source={{ uri: bannerUrl }}
                    style={styles.banner}
                    contentFit="cover"
                    // A PEDIDO ("eu não consigo redimensionar o banner pra ficar do jeito que eu quero") —
                    // `contentPosition` é o equivalente do `expo-image` ao `object-position` do CSS (mesma
                    // técnica usada no web): desloca verticalmente QUAL parte da foto aparece dentro do
                    // recorte fixo de 164px, sem esticar/distorcer nada. `bannerFocalY` vem de
                    // `profiles.banner_focal_y` (0 = topo, 0.5 = centro/padrão, 1 = base).
                    contentPosition={{ top: `${bannerFocalY * 100}%` }}
                  />
                }
              >
                {/*
                  * CORREÇÃO (a pedido — "essa sombra dentro do banner
                  * está estranha, deixa mais natural", com print
                  * mostrando uma faixa escura com borda dura em vez de
                  * transição suave, 2026-09-16) — CAUSA RAIZ: eram DUAS
                  * camadas empilhadas (`bannerDarken`, véu CHAPADO de
                  * 38% cobrindo a foto INTEIRA, mais um `bannerFade`
                  * separado só nos últimos 70px) — duas transições
                  * bruscas (uma onde o degradê começa por cima do véu já
                  * aplicado, outra onde ele termina e vira a faixa lisa
                  * de baixo), lidas como "degrau"/sombra artificial em
                  * vez de gradual. Substituídas por UM `LinearGradient`
                  * só, cobrindo a foto INTEIRA (mesmo `pointerEvents`,
                  * mesma posição) — da cor escura no topo até
                  * `colors.background` 100% opaco embaixo (a mesma cor
                  * da faixa lisa logo abaixo dela) — uma ÚNICA rampa
                  * contínua, sem degrau nenhum no meio do caminho.
                  *
                  * "MENOS ESCURA" (2026-10-02, a pedido) — tom inicial do
                  * véu caiu de `rgba(11,14,20,0.38)` pra
                  * `rgba(11,14,20,0.20)` (quase metade da opacidade) — a
                  * foto fica mais visível perto do topo. O fim da rampa
                  * continua 100% opaco em `colors.background` (não mudou)
                  * — preserva o contraste de nome/@ (`shortRow`, sempre
                  * apoiado na faixa lisa, sem foto atrás) e a transição
                  * suave pro resto da tela.
                  */}
                <LinearGradient
                  colors={["rgba(11,14,20,0.20)", colors.background]}
                  style={styles.bannerDarken}
                  pointerEvents="none"
                />

                <View style={styles.bannerIconLeft}>
                  <NotificationBell />
                </View>

                <Pressable
                  hitSlop={8}
                  style={styles.bannerIconsRight}
                  accessibilityLabel={t("profile.moreOptions")}
                  onPress={() => setShowMore(true)}
                >
                  {/*
                    * A PEDIDO (2026-09-16 — "coloca o mesmo efeito de
                    * 'seguindo, seguidos e comentários' no sino e no
                    * (...)", depois corrigido no mesmo dia — "corrige o
                    * sino e o (...) que ainda estão iluminados"). Ver
                    * comentário completo em `NotificationBell.tsx`
                    * (`glassVariant`) e na receita `bannerIcon` em
                    * `lib/theme.ts` — `pill` não resolveu, a causa real
                    * era `base`/`highlight` fortes demais pra um disco
                    * pequeno sobre a foto de capa, não o `saturate`.
                    */}
                  <Glass variant="bannerIcon" style={styles.bannerIconButton}>
                    <Feather name="more-horizontal" size={16} color={colors.text} />
                  </Glass>
                </Pressable>
              </GlassTargetProvider>

              <View style={styles.shortRow}>
                <Avatar uri={user.avatarUrl} name={user.name} style={styles.avatarShort} textStyle={styles.avatarInitials} />
                <View style={[styles.headerText, styles.headerTextCenterShort]}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} variant="subtitle" style={styles.displayName}>
                      {user.name}
                    </Text>
                    <VerifiedBadge tier={user.verifiedTier} size={18} />
                  </View>
                  {/*
                    * A PEDIDO (2026-09-16 — "remove @seenlistapp em baixo
                    * de 'seenlist' e substitui por um botão 'editar'",
                    * mesma mudança já feita no web, `ProfileHeader.tsx`).
                    * O "Editar" que ficava dentro do sheet "..." (ver
                    * `ProfileMoreSheet.tsx`) virou este botão direto aqui.
                    *
                    * AJUSTE (2026-09-16, a pedido — "ao invés de só
                    * texto o 'editar' deixa um botão ambar") — virou
                    * pílula âmbar sólida (`GelSurface`), mas o usuário
                    * achou feio ("ficou feio, deixa ele um botão glass
                    * igual 'seguindo,seguidores e comentários'").
                    *
                    * AJUSTE 2 (mesmo dia) — trocado pra `Glass`
                    * `variant="pill"`, a MESMA receita das pílulas de
                    * contagem logo abaixo (`countCard`) — vidro
                    * translúcido, não âmbar sólido.
                    */}
                  {/*
                    * CORREÇÃO (2026-09-16, a pedido — "no web, quando
                    * aperto algum botão pílula glass, tem uma pequena
                    * animação, confere e adiciona também") — conferido
                    * no web real (`PublicProfileView.tsx`, mesma
                    * pílula "Editar" em vidro/gel): `active:scale-[0.96]`.
                    * Aqui era `Pressable` puro, sem nenhum feedback de
                    * toque. Trocado por `PressableScale`.
                    */}
                  <PressableScale hitSlop={8} onPress={() => router.push("/settings/edit-profile")} style={styles.editButtonWrap}>
                    <Glass style={styles.editButton} variant="pill">
                      <Text style={styles.editButtonText}>{t("profile.edit")}</Text>
                    </Glass>
                  </PressableScale>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.topIconsRowNoBanner}>
            <NotificationBell flat />
            {/*
              * CORREÇÃO (2026-09-16, mesmo motivo do comentário acima) —
              * conferido no web (`ProfileHeader.tsx`, `GLASS_ICON_BTN`):
              * o botão "..." (mais opções) usa `active:scale-90`.
              */}
            <PressableScale hitSlop={8} accessibilityLabel={t("profile.moreOptions")} onPress={() => setShowMore(true)}>
              <Glass style={styles.bannerIconButtonFlat}>
                <Feather name="more-horizontal" size={16} color={colors.muted} />
              </Glass>
            </PressableScale>
          </View>
        )}

        {!bannerUrl && (
          <View style={styles.headerRow}>
            <Avatar uri={user.avatarUrl} name={user.name} style={styles.avatar} textStyle={styles.avatarInitials} />
            <View style={[styles.headerText, styles.headerTextCenterTall]}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} variant="subtitle" style={styles.displayName}>
                  {user.name}
                </Text>
                <VerifiedBadge tier={user.verifiedTier} size={18} />
              </View>
              {/* Ver comentário completo no bloco COM capa, acima — mesma pílula "Editar" em vidro (variant `pill`), incluindo a correção do `PressableScale`. */}
              <PressableScale hitSlop={8} onPress={() => router.push("/settings/edit-profile")} style={styles.editButtonWrap}>
                <Glass style={styles.editButton} variant="pill">
                  <Text style={styles.editButtonText}>{t("profile.edit")}</Text>
                </Glass>
              </PressableScale>
            </View>
          </View>
        )}

        {/*
          * REDESENHO (2026-09-24, a pedido — mockup confirmado, "estende
          * agora"/"confirmado") — item 3+4 do pedido: as 3 pílulas de
          * vidro SEPARADAS (Seguindo/Seguidores/Comentários, cada uma
          * com seu próprio `Glass`) viraram UM card único de vidro, com
          * linhas divisórias finas entre as colunas — mesma receita
          * visual do card de stats do Compartilhar (`ShareCardExport.tsx`
          * → `statsCard`/`statItem`/`statDivider`), só que reaproveitando
          * a receita `pill` do `Glass` (já calibrada pro tom do Perfil,
          * ver comentário grande removido daqui — histórico completo
          * ainda em `lib/theme.ts`, receita `pill`) em vez da paleta
          * roxa do card de Compartilhar.
          *
          * Também subiu de posição: antes vinha DEPOIS da bio; agora
          * fica colado logo após a capa/cabeçalho (mesmo lugar que já
          * ocupava — só trocou de ordem com a bio, que desceu).
          */}
        <View style={styles.countsRow}>
          <Glass style={styles.countsCard} variant="pill">
            <Pressable style={styles.countItemNarrow} onPress={() => router.push(`/follow-list/${user.id}/following`)}>
              <Feather name="users" size={16} color={colors.primary} style={styles.countIcon} />
              <Text style={styles.countNumber}>{counts.following}</Text>
              {/* CORREÇÃO (achado durante auditoria da Task #17, FASE 2, 2026-09-26) — texto literal; reaproveita `profile.following` (mesmo texto, já usado como título/estado em `follow-list/[direction].tsx`/`FollowButton.tsx`). */}
              <Text variant="muted" style={styles.countLabel}>
                {t("profile.following")}
              </Text>
            </Pressable>
            <View style={styles.countDivider} />
            <Pressable style={styles.countItem} onPress={() => router.push(`/follow-list/${user.id}/followers`)}>
              {/*
                CORREÇÃO (2026-09-24 — medida em pixel no seu print, não
                chutada): comparei os 3 ícones um por um, com régua sobre
                o número/texto de cada coluna. "users" (Seguindo) e
                "message-circle" (Comentários) batem certinho com o
                centro do número/texto embaixo. Só o "user-check"
                (Seguidores) fica visualmente puxado pra esquerda — a
                caixa do ícone em si até está centralizada, mas o
                desenho dele não é simétrico (o corpo da pessoa fica à
                esquerda, o "check" pendurado à direita, sem massa
                visual equivalente do lado esquerdo pra compensar), daí
                o olho lê como "fora do centro" mesmo com o layout
                certo. `marginLeft: 3` empurra só ESTE ícone pra
                compensar o desenho, sem mexer no alinhamento
                (já correto) dos outros dois.
              */}
              <Feather name="user-check" size={16} color={colors.primary} style={[styles.countIcon, styles.countIconUserCheckNudge]} />
              <Text style={styles.countNumber}>{counts.followers}</Text>
              {/* CORREÇÃO (achado durante auditoria da Task #17, FASE 2, 2026-09-26) — texto literal; reaproveita `profile.followers` (mesmo texto, já usado como título em `follow-list/[direction].tsx`). */}
              <Text variant="muted" style={styles.countLabel}>
                {t("profile.followers")}
              </Text>
            </Pressable>
            <View style={styles.countDivider} />
            <Pressable style={styles.countItemWide} onPress={() => router.push("/profile/comments")}>
              {/*
                O segundo brilho, o azulado do canto inferior direito do
                card inteiro (antes só cobria a última pílula — agora
                cobre a última coluna do card único, mesma posição
                relativa). No web:
                `radial-gradient(70% 90% at 85% 100%, rgba(42,127,184,0.22), transparent 60%)`.
              */}
              <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <RNImage source={GLOW_PILL} resizeMode="stretch" style={styles.countCardBlueGlow} />
              </View>
              <Feather name="message-circle" size={16} color={colors.primary} style={styles.countIcon} />
              <Text style={styles.countNumber}>{socialCounts?.commentsGiven ?? 0}</Text>
              {/* CORREÇÃO (achado durante auditoria da Task #17, FASE 2, 2026-09-26) — texto literal; reaproveita `profile.comments` (mesmo texto, já usado como título de stat card em `StatsSeriesTab.tsx`). */}
              <Text variant="muted" style={styles.countLabel}>
                {t("profile.comments")}
              </Text>
            </Pressable>
          </Glass>
        </View>

        {!!bio && (
          <View style={styles.bioBlock}>
            <View style={styles.sectionTitle}>
              <Feather name="file-text" size={14} color={colors.primary} />
              {/* CORREÇÃO (achado durante auditoria da Task #17, FASE 2, 2026-09-26) — texto literal; reaproveita `profile.bio` (mesmo texto, já usado em `settings/edit-profile.tsx`). */}
              <Text style={styles.sectionTitleText}>{t("profile.bio")}</Text>
            </View>
            <Text style={styles.bio}>{bio}</Text>
          </View>
        )}

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

/**
 * SÓ pro caso COM capa, redesenho "capa curta e minimalista" (versão
 * F, a pedido, 2026-09-16) — a versão F do mockup usa um avatar um
 * pouco menor que o solto original (66px vs. os 74px do
 * `AVATAR_SIZE`), porque a capa também ficou mais baixa. O caso SEM
 * capa (`avatar`, mais abaixo) e o Perfil público continuam com 74px,
 * sem mudança.
 */
const SHORT_HEADER_AVATAR_SIZE = 66;

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
  /**
   * REDESENHO "CAPA CURTA E MINIMALISTA" (versão F, a pedido,
   * 2026-09-16 — ver comentário completo no JSX) — volta a ser
   * edge-to-edge (era com `paddingHorizontal`/margem lateral na
   * tentativa anterior, versão D "cartão de vidro flutuante", já
   * abandonada) — sem padding nem margem lateral nenhuma, só o
   * respiro de baixo antes do resto do conteúdo.
   */
  /**
   * REVISÃO (2026-09-24, a pedido — "você deixou espaço entre banner e
   * [contagens], é pra ficar colado, como no mockup") — `marginBottom`
   * era `spacing.lg` (24), tunado de quando o próximo elemento era a
   * bio (que tinha seu próprio `marginTop` pequeno). Agora o próximo
   * elemento é o card de contagens, que deve ficar colado — reduzido
   * pra `spacing.xs` (4), só o suficiente pra não encostar de verdade
   * (0 ficaria colado bit a bit, sem nenhum respiro visual).
   */
  bannerSection: {
    marginBottom: spacing.xs,
  },
  /**
   * Bem mais baixa que a versão A original (era 224px antes da versão
   * D já ter reduzido pra 190 — mantido em 190 aqui, a versão F do
   * mockup usa a mesma altura). Cantos arredondados só EMBAIXO (era
   * nos 4 lados na versão D, que tinha margem lateral) — `radius.md`
   * (10px) é o token mais próximo dos 8px usados no mockup.
   *
   * CORREÇÃO (a pedido — "não está igual a opção F", 2026-09-16) —
   * `backgroundColor` era `colors.surface` (cinza neutro, só visível
   * numa fresta de 1px de borda arredondada); agora é
   * `colors.background` de propósito — é o que sobra visível nos
   * últimos `BANNER_BOTTOM_GAP` (26px) de baixo, onde `bannerPhoto`
   * (abaixo) não cobre. Ver comentário completo no JSX pra causa raiz.
   */
  bannerShort: {
    height: 190,
    backgroundColor: colors.background,
    overflow: "hidden",
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  /**
   * NOVO (2026-09-16, correção "não está igual a opção F") — a foto (+
   * véu escuro + degradê + ícones) só ocupa os `190 - 26 = 164px` de
   * cima do `bannerShort` (mesma proporção do `f-banner` do mockup,
   * `inset: 0 0 26px 0` dentro de um `f-wrap` de 190px) — os 26px
   * finais ficam com o `backgroundColor` LISO do `bannerShort` (ver
   * comentário lá), sem foto nenhuma atrás. Antes esse bloco preenchia
   * o `bannerShort` INTEIRO (190px) e só o `bannerFade` disfarçava — o
   * nome/@ (`shortRow`, mais abaixo, ainda ancorado no `bottom: 0` do
   * `bannerShort`) ficavam por cima de pedaço de foto ainda visível
   * atrás do degradê, o que não acontece no mockup (lá o nome/@ fica
   * apoiado num fundo totalmente liso).
   */
  bannerPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 164,
  },
  banner: {
    width: "100%",
    height: "100%",
  },
  /**
   * CORREÇÃO (a pedido — "essa sombra dentro do banner está estranha,
   * deixa mais natural", 2026-09-16 — ver comentário completo no JSX
   * pra causa raiz) — era um `View` com véu CHAPADO (cor sólida, sem
   * gradiente nenhum) mais um `bannerFade` separado só nos últimos
   * 70px; virou o alvo de um único `LinearGradient` cobrindo a foto
   * INTEIRA (`bannerPhoto`, 164px) — do véu `rgba(11,14,20,0.38)` no
   * topo até `colors.background` 100% opaco embaixo, UMA rampa só, sem
   * degrau no meio. `bannerFade` (que fazia só a metade de baixo dessa
   * transição, em separado) saiu de vez — este gradiente já cobre o
   * papel dele também.
   */
  bannerDarken: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  /**
   * Avatar + nome/@ ancorados perto da borda de baixo da capa (igual à
   * versão A original) — `left`/`right: spacing.md` reaproveita a
   * mesma borda de tela de 16px do resto do app (a capa em si é
   * edge-to-edge, mas o conteúdo por cima dela respeita a borda).
   *
   * AJUSTE (a pedido, "sobe uns 30% o avatar+'seenlist e o @'",
   * 2026-09-16) — `bottom` era `0` (colado na borda de baixo da capa).
   * 30% do tamanho do próprio avatar (`SHORT_HEADER_AVATAR_SIZE`, 66px):
   * 66 × 0,3 = 19,8, arredondado pra 20.
   */
  /**
   * CAUSA RAIZ DO "ESPACINHO" (2026-09-24, a pedido — "ainda tem um
   * espacinho" entre a capa e o card de contagens) — `bottom: 20`
   * (herdado do ajuste "sobe uns 30% o avatar", 2026-09-16) deixa uma
   * tira de 20px de fundo sólido (cor igual ao fundo da tela) DENTRO
   * do `bannerShort` (190px fixos), abaixo da própria linha do
   * avatar/nome — um vão morto que sempre existiu, só nunca foi
   * reparado porque o vão ANTIGO até o card de contagens (40px, já
   * corrigido antes nesta sessão) era grande o bastante pra esconder
   * ele dentro. Reduzir só o vão externo não bastava.
   *
   * Voltou pra `bottom: 0` (linha encostada na base da capa) — isso
   * DESFAZ visualmente aquele "sobe 30%" de 2026-09-16.
   *
   * REVERTIDO DE VOLTA (2026-09-24, mesmo dia — comparação com o print
   * antigo "Nagumo Hajime", que mostrava o avatar mais alto dentro do
   * banner) — medi as duas fotos (a atual e a de referência) e a
   * posição batia com algo perto do `bottom: 20` original, não do `0`
   * daqui em cima. Escolha explícita seguida (opções dadas, você
   * escolheu) — priorizar o avatar na posição alta, mesmo sabendo que
   * isso reabre uns 20px de espaço "colado" entre o fim do banner e o
   * card de contagens (o mesmo espaço que a mudança pra `bottom: 0`
   * tinha fechado). Se depois de ver esse resultado você preferir um
   * meio-termo, me avisa que ajusto.
   */
  shortRow: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
   * "CAPA CURTA E MINIMALISTA" (versão F, 2026-09-16) — o avatar volta
   * a ficar solto sobre a capa (não mais dentro de um cartão, como na
   * versão D já abandonada) — `position: "absolute"` fica no
   * `shortRow` (pai), aqui só a aparência. Anel fino translúcido
   * branco (1px, sem sombra/brilho ao redor) — mais discreto que o
   * anel da versão A original, combinando com a proposta "minimalista"
   * da versão F.
   */
  avatarShort: {
    width: SHORT_HEADER_AVATAR_SIZE,
    height: SHORT_HEADER_AVATAR_SIZE,
    borderRadius: SHORT_HEADER_AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
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
    // REVISÃO (2026-09-24, mesmo pedido de "colado" acima) — mesmo
    // respiro pequeno (`spacing.xs`) que o `bannerSection` ganhou pro
    // caso COM capa, pra manter os dois caminhos (com/sem capa)
    // consistentes até o card de contagens logo abaixo.
    marginBottom: spacing.xs,
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
  /**
   * CAUSA RAIZ DE VERDADE, ACHADA COM PRINT REAL (2026-09-17 —
   * "avatar desalinhado do bloco nome+Editar"). `shortRow`/`headerRow`
   * (linha compartilhada, abaixo) já tinham `alignItems: "center"` —
   * a fórmula certa em tese, o mesmo padrão que o usuário pediu de
   * volta. Só que "centralizar" um `View` (`headerText`) contra o
   * `Avatar` só funciona se a ALTURA REAL do `headerText` bater com o
   * que a gente espera — e ela não batia: a soma de `displayName`
   * (`lineHeight: 28`, de propósito, pra casar com o `leading-7` do
   * web) + o botão "Editar" (`PressableScale` → `Pressable` →
   * `Animated.View` com `flex: 1`, cada camada com seu próprio jeito
   * de medir "auto") não é um número fixo nem óbvio de calcular à mão
   * — e não precisa ser. Em vez de tentar adivinhar o valor certo (ou
   * pior, compensar com `marginTop` manual, que quebraria de novo com
   * nome maior/fonte diferente/idioma diferente), a altura do
   * `headerText` agora é TRAVADA no tamanho do PRÓPRIO avatar que ele
   * acompanha (`headerTextCenterShort`/`headerTextCenterTall`, logo
   * abaixo — dois avatares, duas alturas, `SHORT_HEADER_AVATAR_SIZE` e
   * `AVATAR_SIZE`) e `justifyContent: "center"` centraliza nome+botão
   * como UM BLOCO SÓ dentro dessa altura — não cada um separado. Como
   * a altura já é EXATAMENTE a do avatar, o `alignItems: "center"` da
   * linha vira redundante (as duas caixas já nascem do mesmo tamanho)
   * mas continua correto e foi mantido. Funciona igual pra qualquer
   * nome/idioma — nada aqui depende do texto específico.
   */
  /**
   * CORREÇÃO (2026-09-24 — medida em PIXEL, direto no seu print, não
   * chutada por código). Depois do `includeFontPadding: false` (acima,
   * no `displayName`) o bloco nome+"Editar" continuava visualmente alto
   * demais — medi as duas prints com um script (contorno do avatar vs.
   * topo do texto do nome/base da pílula "Editar") e o resultado foi
   * direto: o avatar tem o centro vertical ~13-14px ABAIXO de onde o
   * bloco nome+botão realmente aparece pintado na tela, mesmo com
   * `justifyContent: "center"` — ou seja, o `justifyContent: "center"`
   * (da correção de 2026-09-17) está centralizando a CAIXA calculada
   * pelo RN (que inclui o espaço invisível sobrando embaixo do nome,
   * mesmo espaço já documentado no comentário do `displayName`), não o
   * conteúdo visível de verdade — por isso nunca ficava certo por mais
   * que se mexesse na fonte.
   *
   * Troquei `justifyContent: "center"` por `"flex-start"` +
   * `paddingTop` fixo — assim o deslocamento é direto (sem a matemática
   * de redistribuição do `"center"`, que "absorve" metade de qualquer
   * ajuste e mascara o resultado). O valor de `paddingTop` foi
   * calculado a partir do que foi medido no print (bloco precisa descer
   * ~13-14px) somado à diferença entre os dois avatares
   * (`AVATAR_SIZE` 74 − `SHORT_HEADER_AVATAR_SIZE` 66 = 8, metade = 4,
   * por isso o caso "tall" ganha +4 a mais que o "short").
   */
  headerTextCenterShort: {
    height: SHORT_HEADER_AVATAR_SIZE,
    justifyContent: "flex-start",
    paddingTop: 13,
  },
  headerTextCenterTall: {
    height: AVATAR_SIZE,
    justifyContent: "flex-start",
    paddingTop: 17,
  },
  /**
   * A PEDIDO (2026-09-16 — "deixa ele um botão glass igual
   * 'seguindo,seguidores e comentários'") — mesmo `Glass` `variant`
   * (`pill`) das pílulas de contagem (`countCard`, abaixo), só num
   * tamanho compacto (não `flex: 1` esticado) pra caber ao lado do
   * nome. `editButtonWrap` existe só pra não deixar o `Pressable`
   * esticar (o pai, `headerText`, é `flex: 1`) — sem ele a pílula
   * ficaria larga igual ao nome em vez do tamanho do próprio texto.
   */
  editButtonWrap: {
    alignSelf: "flex-start",
  },
  editButton: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm - 2,
  },
  editButtonText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
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
   *
   * AJUSTE #3 (a pedido, "sobe mais 20%", mesma sessão) — mais 20% em
   * cima do valor JÁ reduzido (10, não do 14/16 originais): 10 × 0,8
   * = 8.
   *
   * AJUSTE #4 (a pedido, "sobe mais 35%", mesma sessão) — mais 35% em
   * cima do valor JÁ reduzido (8, não dos originais): 8 × 0,65 = 5,2,
   * arredondado pra 5.
   */
  /**
   * REVISÃO (2026-09-24) — `marginTop` era 5 (tunado pra ficar perto
   * do avatar, quando a bio vinha logo depois dele). Agora a bio vem
   * depois do título "Bio" (`sectionTitle`, que já tem seu próprio
   * `marginBottom`), então só precisa de um respiro pequeno até o
   * texto — 4px.
   *
   * CAUSA RAIZ ("alinha Bio", 2026-09-24, print seguinte) — este
   * `paddingHorizontal: spacing.md` é sobra de quando a bio era um
   * elemento solto (sem o `bioBlock` que a envolve hoje). Agora o pai
   * (`bioBlock`, logo abaixo) já aplica o MESMO `paddingHorizontal` —
   * os dois juntos somavam 32px de borda pro texto da bio, enquanto o
   * título "Bio" (dentro do mesmo `bioBlock`, sem padding próprio)
   * ficava só nos 16px do pai. Por isso o texto da bio aparecia
   * ~16px mais pra dentro que o título "Bio" acima dele. Removido
   * daqui — o padding do `bioBlock` já é suficiente.
   */
  bio: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.text,
  },
  /**
   * NOVO (2026-09-24) — envolve o título "Bio" + o texto da bio como
   * um bloco só, espaçado do card de contagens acima dele.
   */
  bioBlock: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  /** Mesma receita de título de seção usada em `ProfileListsPreview.tsx` (ícone + texto, 14/700, gap `spacing.sm`) — reaproveitada aqui pro título "Bio" em vez de duplicar visual novo. */
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitleText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.sm` (8); o web usa `gap-2.5` (`ProfileHeader.tsx`, "mt-4 flex gap-2.5") = 10px — sem token exato, valor literal. */
  /** CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web usa `px-4` (`spacing.md`=16) como borda de tela. */
  countsRow: {
    paddingHorizontal: spacing.md,
    // REVISÃO (2026-09-24, mesmo pedido — "colado") — era `spacing.md`
    // (16), que SOMAVA com o `marginBottom` do `bannerSection` (24) —
    // 40px de vão total. Zerado aqui: o respiro que sobrou (4px) vem
    // só do `bannerSection.marginBottom`, ver comentário lá.
    marginTop: 0,
  },
  /**
   * REDESENHO (2026-09-24, a pedido — mockup confirmado) — antes eram
   * 3 `Glass` `pill` SEPARADOS com `gap: 10` entre eles
   * (`countCardFlex`/`countCard`, removidos). Agora é UM `Glass` só,
   * com os itens em `row` dentro dele e divisórias finas
   * (`countDivider`) entre as colunas — mesma ideia estrutural do
   * `statsCard`/`statDivider` do card de stats do Compartilhar
   * (`ShareCardExport.tsx`).
   */
  /**
   * A PEDIDO (2026-09-24 — "diminui esse card em 30%"). As duas
   * primeiras tentativas encolheram o CONTEÚDO (ícone, depois fonte) e
   * deixaram a caixa quase do mesmo tamanho — você corrigiu: o pedido
   * é o CARD ficar menor NA HORIZONTAL, com ícone/número/rótulo no
   * tamanho ORIGINAL (revertido aqui: `paddingVertical` volta a 12,
   * ícones voltam a `size={16}`, fontes voltam a `fontSize.sm`/`xs`).
   * A redução em si é só `width: "70%"` + `alignSelf: "center"` abaixo
   * — encolhe a largura do card em 30%, centralizado, sem mexer no
   * tamanho de mais nada dentro dele.
   *
   * ACONTECEU O QUE EU TINHA AVISADO (2026-09-24, print seguinte) —
   * "Comentários" quebrou linha ("Comentário" + "s" sozinho embaixo),
   * só nessa coluna, deixando o card com mais altura que precisava e
   * as 3 colunas com quantidade de linhas diferente (isso é a causa
   * raiz do "alinha as informações dentro do card" — não é um
   * `alignItems` errado, é a quebra de linha empurrando só a 3ª coluna
   * pra baixo). Medi direto no seu print: o texto "Comentários" precisa
   * de ~67-68px pra caber numa linha só, e a coluna só tinha uns
   * ~65px disponíveis — faltavam uns 2-3px. Corrigido por dois lados
   * (sem tocar fonte/ícone, como pedido): `width` do card sobe de 70%
   * pra 75% (ainda 25% mais estreito que o original, não os 30%
   * cheios) e `paddingHorizontal` do item cai de 6 pra 4 — sobra ~15px
   * a mais por coluna, folga confortável.
   *
   * Também "diminui um pouco verticalmente, tem muito espaço pra
   * baixo" — `paddingVertical` cai de 12 pra 9 (não dá pra ir muito
   * mais baixo que isso sem apertar o ícone/número/texto, que ficam do
   * mesmo tamanho de antes).
   */
  countsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    /** CORREÇÃO (2026-09-04) — era `radius.md` (10); web `rounded-2xl` = 16. Mantido do `countCard` antigo. */
    borderRadius: radius.lg,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignSelf: "center",
    width: "75%",
  },
  /**
   * A PEDIDO (2026-09-24 — "colunas com largura proporcional ao
   * conteúdo"). Medi pixel a pixel no seu print e confirmei: ícone,
   * número e rótulo já compartilhavam o mesmo `centerX` dentro de cada
   * coluna (diferença de 1-3px, dentro da margem de erro de medir em
   * imagem pequena) — não era bug de centralização. A sensação de
   * "Comentários pesado pra direita" vinha só da palavra ser mais
   * longa (11 letras) sobrando menos respiro numa coluna do MESMO
   * tamanho que "Seguindo" (8 letras). Em vez de 3 colunas
   * `flex: 1` iguais, cada uma agora tem um `flex` proporcional ao
   * número de letras do rótulo (Seguindo=8, Seguidores=10,
   * Comentários=11, de 29 letras no total): `countItemNarrow`
   * (0,85), este aqui — `countItem`, usado por "Seguidores" — fica
   * 1 (referência), `countItemWide` (1,15) pra "Comentários". As
   * divisórias deixam de ficar exatamente no centro geométrico do
   * card (viram proporcionais ao conteúdo também) — troca explícita,
   * você escolheu essa opção sabendo disso.
   */
  countItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  /** Ver comentário em `countItem` — coluna "Seguindo" (rótulo mais curto), um pouco mais estreita que a média. */
  countItemNarrow: {
    flex: 0.85,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  /** Ver comentário em `countItem` — coluna "Comentários" (rótulo mais longo), um pouco mais larga que a média. */
  countItemWide: {
    flex: 1.15,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  countIcon: {
    opacity: 0.9,
  },
  /** Ver comentário no JSX (ícone "Seguidores") — nudge óptico só deste ícone, medido no print. */
  countIconUserCheckNudge: {
    marginLeft: 3,
  },
  countDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
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
   *
   * CAUSA RAIZ DO ITEM 5 (2026-09-24 — "avatar+nome+botão ainda estão
   * visualmente desalinhados", mesmo depois do `headerTextCenterShort`/
   * `headerTextCenterTall` travar a altura da coluna no tamanho do
   * avatar e centralizar com `justifyContent: "center"`, sessão
   * 2026-09-17). Aquela correção centraliza a CAIXA do bloco
   * nome+botão certinho — o problema é que o CONTEÚDO visível dentro
   * da caixa não é simétrico: como o parágrafo acima já flagrou, o
   * texto do nome "flutua" mais alto dentro da própria linha de 28px
   * (métrica vertical da "Plus Jakarta Sans"), sobrando espaço
   * invisível embaixo das letras, ANTES do botão "Editar" começar. Ou
   * seja: dentro da caixa já centralizada, o par "letras do nome" +
   * "botão Editar" fica com um respiro invisível a mais entre os dois
   * — visualmente o nome fica colado no topo e o botão mais pro fundo
   * do que deveria, mesmo a caixa como um todo estando centralizada.
   * `includeFontPadding: false` é a correção padrão do Android pra
   * essa classe de bug (remove o padding extra que as fontes Android
   * reservam por baixo/cima das letras); no iOS essa prop não existe e
   * é ignorada sem efeito nenhum — seguro nas duas plataformas.
   */
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    flexShrink: 1,
    fontWeight: "700",
    lineHeight: 28,
    includeFontPadding: false,
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
