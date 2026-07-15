import { ScrollView, View, Image, Pressable, Share, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePublicProfile, useFollowCounts, useFollow } from "@/lib/usePublicProfile";
import { usePublicProfileStats } from "@/lib/useProfileStats";
import { Screen, Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { FollowButton } from "@/components/profile/FollowButton";
import { StatsCarousel } from "@/components/profile/StatsCarousel";
import { PublicFavoritesSection } from "@/components/profile/PublicFavoritesSection";
import { PublicLibrarySection } from "@/components/profile/PublicLibrarySection";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const joinDateFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-103 — porta de `PublicProfileView.tsx` do web. Fora do
 * escopo desta leva, de propósito: o carrossel de estatísticas
 * (`StatsCarousel` — uma feature de análise própria, maior que o
 * resto desta tela). "Editar" (leva TASK-105) já leva pra
 * `/settings/edit-profile`.
 */
export default function PublicProfileScreen() {
  const router = useRouter();
  const { username: rawUsername } = useLocalSearchParams<{ username: string }>();
  const username = String(rawUsername);
  const { session } = useAuth();

  const { profile, isLoading, isError } = usePublicProfile(username);
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
        <Text variant="muted" style={styles.centerText}>
          {isError ? "Não foi possível carregar este perfil agora. Tente de novo." : "Este perfil não existe ou é privado."}
        </Text>
      </Screen>
    );
  }

  const isOwnProfile = session?.user.id === profile.userId;
  const displayName = profile.displayName?.trim() || `@${profile.username}`;

  async function handleShare() {
    try {
      await Share.share({ message: `https://seenlist.app/u/${profile!.username}` });
    } catch (error) {
      console.error("[PublicProfileScreen] Falha ao compartilhar", error);
    }
  }

  return (
    <Screen padded={false} bottomInset>
      <ScrollView>
        <View style={styles.banner}>
          {profile.bannerUrl && <Image source={{ uri: profile.bannerUrl }} style={styles.bannerImage} resizeMode="cover" />}
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={18} color={colors.text} />
          </Pressable>
          <View style={styles.avatar}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarInitials}>{initials(displayName)}</Text>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <Text variant="subtitle">{displayName}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          <Text variant="muted" style={styles.metaLine}>
            {[profile.country, `Entrou em ${joinDateFormatter.format(new Date(profile.createdAt))}`].filter(Boolean).join(" · ")}
          </Text>

          <View style={styles.countsRow}>
            <Pressable onPress={() => router.push(`/follow-list/${profile.userId}/following`)}>
              <Text style={styles.countNumber}>{counts.following}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Seguindo
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/follow-list/${profile.userId}/followers`)}>
              <Text style={styles.countNumber}>{counts.followers}</Text>
              <Text variant="muted" style={styles.countLabel}>
                Seguidores
              </Text>
            </Pressable>
            <View>
              <Text style={styles.countNumber}>0</Text>
              <Text variant="muted" style={styles.countLabel}>
                Comentários
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            {isOwnProfile ? (
              <Pressable style={styles.editButton} onPress={() => router.push("/settings/edit-profile")}>
                <Text style={styles.editButtonText}>Editar</Text>
              </Pressable>
            ) : (
              <FollowButton isFollowing={follow.isFollowing} busy={follow.busy} onPress={follow.toggle} />
            )}
            <Pressable style={styles.shareButton} onPress={handleShare}>
              <Feather name="share-2" size={16} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.sections}>
            <StatsCarousel stats={publicStats.stats} isLoading={publicStats.isLoading} isError={publicStats.isError} ownerLabel="other" />
            <PublicFavoritesSection userId={profile.userId} />
            <PublicLibrarySection userId={profile.userId} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const AVATAR_SIZE = 80;

const styles = StyleSheet.create({
  banner: {
    height: 112,
    backgroundColor: colors.surface,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11,14,20,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonAlone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatar: {
    position: "absolute",
    left: spacing.md,
    bottom: -AVATAR_SIZE / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.muted,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: AVATAR_SIZE / 2 + spacing.sm,
    gap: 2,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  bio: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  metaLine: {
    marginTop: spacing.xs,
    fontSize: 11,
  },
  countsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
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
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shareButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
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
