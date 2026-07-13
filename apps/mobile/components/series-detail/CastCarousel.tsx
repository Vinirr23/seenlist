import { ScrollView, View, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CastMember } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

export function CastCarousel({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {cast.slice(0, 15).map((member) => {
        const photoUrl = tmdbImageUrl(member.profilePath, "w185");
        return (
          <View key={member.id} style={styles.card}>
            <View style={styles.photo}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoImage} resizeMode="cover" />
              ) : (
                <Feather name="user" size={20} color={colors.muted} />
              )}
            </View>
            <Text numberOfLines={1} style={styles.name}>
              {member.name}
            </Text>
            <Text numberOfLines={1} variant="muted" style={styles.character}>
              {member.character}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
  },
  card: {
    width: 76,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  name: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  character: {
    fontSize: 10,
    textAlign: "center",
  },
});
