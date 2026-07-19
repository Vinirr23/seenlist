import { ScrollView, View, Image, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export interface FavoriteCharacterOption {
  id: number;
  name: string;
  imageUrl: string | null;
}

/**
 * TASK-122 (personagem favorito) — porta de
 * `EpisodeFavoriteCharacterPicker.tsx`. Este componente não sabe (nem
 * precisa saber) se a lista veio do Jikan (anime, ilustração de
 * verdade do personagem) ou do elenco do TMDB (foto do ator/dublador,
 * quando não achou correspondência de anime) — quem chama já decide
 * isso antes e entrega no mesmo formato.
 */
export function EpisodeFavoriteCharacterPicker({
  characters,
  selectedId,
  onSelect,
}: {
  characters: FavoriteCharacterOption[];
  selectedId: number | null;
  onSelect: (character: FavoriteCharacterOption | null) => void;
}) {
  if (characters.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {characters.map((character) => {
        const selected = selectedId === character.id;
        return (
          <Pressable key={character.id} style={styles.item} onPress={() => onSelect(selected ? null : character)}>
            <View style={[styles.avatar, selected && styles.avatarSelected]}>
              {character.imageUrl ? (
                <Image source={{ uri: character.imageUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text variant="muted" style={styles.noPhoto}>
                  Sem foto
                </Text>
              )}
            </View>
            <Text numberOfLines={1} style={[styles.name, selected && styles.nameSelected]}>
              {character.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const AVATAR_SIZE = 72;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  item: {
    width: AVATAR_SIZE + 8,
    alignItems: "center",
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
    borderColor: "transparent",
  },
  avatarSelected: {
    borderColor: colors.primary,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  noPhoto: {
    fontSize: 9,
    textAlign: "center",
  },
  name: {
    marginTop: spacing.xs,
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center",
  },
  nameSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
});
