import { useState, useEffect, useCallback } from "react";
import { ScrollView, View, Image, Pressable, Share, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useCurrentUser, useProfileSectionCounts, useSocialCounts } from "@/lib/useCurrentUser";
import { useFollowCounts } from "@/lib/usePublicProfile";
import { fetchEditableProfile } from "@/lib/editProfile";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";
import { Screen, Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { StatisticsCard } from "@/components/profile/StatisticsCard";
import { ProfileSectionRow } from "@/components/profile/ProfileSectionRow";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const joinDateFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

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
  const sectionCounts = useProfileSectionCounts(user?.id ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [unreadRecommendations, setUnreadRecommendations] = useState<number | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadRecommendationsCount().then(setUnreadRecommendations);
    }, [])
  );

  useEffect(() => {
    fetchEditableProfile().then((profile) => {
      if (!profile) return;
      setBannerUrl(profile.bannerUrl);
      setBio(profile.bio || null);
      setUsername(profile.username || null);
    });
  }, []);

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

  const joinDate = joinDateFormatter.format(new Date(user.createdAt));

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {!!bannerUrl ? (
          <View style={styles.bannerOuter}>
            <View style={styles.bannerInner}>
              <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
              <LinearGradient
                colors={["transparent", colors.background]}
                style={styles.fadeOverlay}
                pointerEvents="none"
              />
            </View>

            <Pressable style={styles.bannerIconLeft} onPress={() => router.push("/settings/edit-profile")}>
              <Feather name="edit-2" size={16} color="#fff" />
            </Pressable>

            <View style={styles.bannerIconsRight}>
              {!!username && (
                <Pressable style={styles.bannerIconButton} onPress={handleShare}>
                  <Feather name="share-2" size={16} color="#fff" />
                </Pressable>
              )}
              <Pressable style={styles.bannerIconButton} onPress={() => router.push("/settings")}>
                <Feather name="settings" size={16} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.avatarOverlap}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.topIconsRowNoBanner}>
            {!!username && (
              <Pressable style={styles.bannerIconButtonFlat} onPress={handleShare}>
                <Feather name="share-2" size={16} color={colors.muted} />
              </Pressable>
            )}
            <Pressable style={styles.bannerIconButtonFlat} onPress={() => router.push("/settings")}>
              <Feather name="settings" size={16} color={colors.muted} />
            </Pressable>
          </View>
        )}

        <View style={[styles.headerRow, bannerUrl ? styles.headerRowWithBanner : null]}>
          {!bannerUrl && (
            <View style={styles.avatar}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
              )}
            </View>
          )}
          <View style={styles.headerText}>
            <Text numberOfLines={1} variant="subtitle">
              {user.name}
            </Text>
            {!!username && <Text style={styles.username}>@{username}</Text>}
            <Text variant="muted" style={styles.joinDate}>
              Membro desde {joinDate}
            </Text>
          </View>
        </View>

        {!!bio && <Text style={styles.bio}>{bio}</Text>}

        <View style={styles.countsRow}>
          <Pressable style={styles.countCard} onPress={() => router.push(`/follow-list/${user.id}/following`)}>
            <Text style={styles.countNumber}>{counts.following}</Text>
            <Text variant="muted" style={styles.countLabel}>
              Seguindo
            </Text>
          </Pressable>
          <Pressable style={styles.countCard} onPress={() => router.push(`/follow-list/${user.id}/followers`)}>
            <Text style={styles.countNumber}>{counts.followers}</Text>
            <Text variant="muted" style={styles.countLabel}>
              Seguidores
            </Text>
          </Pressable>
          <Pressable style={styles.countCard} onPress={() => router.push("/profile/comments")}>
            <Text style={styles.countNumber}>{socialCounts?.commentsGiven ?? 0}</Text>
            <Text variant="muted" style={styles.countLabel}>
              Comentários
            </Text>
          </Pressable>
        </View>

        {!bannerUrl && (
          <View style={styles.actionsRow}>
            <Pressable style={styles.editButton} onPress={() => router.push("/settings/edit-profile")}>
              <Text style={styles.editButtonText}>Editar</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <StatisticsCard />
        </View>

        <View style={[styles.section, styles.sectionList, styles.lastSection]}>
          <ProfileSectionRow
            icon="send"
            label="Recomendações"
            count={unreadRecommendations}
            onPress={() => router.push("/profile/recommendations")}
          />
          <ProfileSectionRow icon="check-square" label="Minhas listas" count={sectionCounts?.lists} onPress={() => router.push("/lists")} />
          <ProfileSectionRow icon="tv" label="Séries" count={sectionCounts?.series} onPress={() => router.push("/profile/series")} />
          <ProfileSectionRow
            icon="star"
            label="Séries favoritas"
            count={sectionCounts?.favoriteSeries}
            onPress={() => router.push("/profile/favorite-series")}
          />
          <ProfileSectionRow icon="film" label="Filmes" count={sectionCounts?.movies} onPress={() => router.push("/profile/movies")} />
          <ProfileSectionRow
            icon="star"
            label="Filmes favoritos"
            count={sectionCounts?.favoriteMovies}
            onPress={() => router.push("/profile/favorite-movies")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  bannerOuter: {
    height: 208,
    marginBottom: 40,
  },
  bannerInner: {
    height: 168,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    height: "100%",
  },
  fadeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  bannerIconLeft: {
    position: "absolute",
    left: 12,
    top: 12,
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bannerIconsRight: {
    position: "absolute",
    right: 12,
    top: 12,
    flexDirection: "row",
    gap: spacing.xs,
  },
  bannerIconButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bannerIconButtonFlat: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  topIconsRowNoBanner: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  /**
   * TASK-172 (redesign — achado real, bug já corrigido antes no web
   * de um jeito parecido) — o avatar sobreposto usa posição absoluta
   * ancorada na borda de baixo da capa (`bannerOuter`), não fica na
   * mesma fileira flex do nome — mesmo raciocínio do web
   * (`ProfileHeader.tsx`): manter os dois na mesma fileira faz o
   * bloco de texto (mais alto que o avatar) ser espremido junto.
   */
  avatarOverlap: {
    position: "absolute",
    left: spacing.lg,
    bottom: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  headerRowWithBanner: {
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
    borderWidth: 2,
    borderColor: colors.primary,
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
  joinDate: {
    fontSize: 11,
    marginTop: 2,
  },
  bio: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  countsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  countCard: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  countNumber: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  countLabel: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  lastSection: {
    marginBottom: spacing.xl,
  },
  sectionList: {
    gap: spacing.sm,
  },
});
