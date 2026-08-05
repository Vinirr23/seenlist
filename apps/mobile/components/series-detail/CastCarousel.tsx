import { useEffect, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { CastMember } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { getAnimeCharacters, type AnimeCharacter } from "@/lib/animeCharacters";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/** Idêntico a `normalizeCharacterName` do web — minúsculas, sem acento, sem "(voice)"/pontuação, só pra COMPARAR, nunca pra exibir. */
function normalizeCharacterName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(voice\)/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .trim();
}

/** Idêntico a `findCharacterImage` do web — correspondência exata primeiro, depois por prefixo (ver comentário do web pro motivo do prefixo em vez de "contém"). */
function findCharacterImage(imageByCharacterName: Map<string, string | null>, characterName: string): string | null | undefined {
  const normalized = normalizeCharacterName(characterName);
  const exact = imageByCharacterName.get(normalized);
  if (exact !== undefined) return exact;

  for (const [knownName, imageUrl] of imageByCharacterName) {
    if (knownName.length >= 4 && (normalized.startsWith(knownName) || knownName.startsWith(normalized))) return imageUrl;
  }
  return undefined;
}

/**
 * CORREÇÃO (a pedido — auditoria mais rigorosa depois de eu ter dito
 * "tudo igual" sem checar direito) — porta de `CastCarousel.tsx` do
 * web, 3 diferenças reais que essa versão tinha:
 *
 * 1. Foto de PERSONAGEM (AniList/MyAnimeList, `getAnimeCharacters`)
 *    nunca era buscada aqui — só mostrava foto do ATOR/dublador
 *    (`profilePath`), sempre. Essa era a correção mais importante do
 *    elenco no web (TASK-168, "no personagem favorito mostra o
 *    personagem, em Sobre mostra o dublador") — nunca tinha sido
 *    portada pra cá, só pro seletor de "personagem favorito" do
 *    episódio (`EpisodeFavoriteCharacterPicker`, lugar diferente).
 * 2. Ordem invertida — mostrava nome do ATOR em cima (negrito),
 *    personagem embaixo. O web mostra o contrário: personagem em
 *    cima, ator embaixo.
 * 3. Foto CIRCULAR — o web usa retangular (retrato, 2:3), mais
 *    parecido com um pôster do que com avatar de rede social.
 */
export function CastCarousel({ cast, title, year }: { cast: CastMember[]; title?: string; year?: number | null }) {
  const [characters, setCharacters] = useState<AnimeCharacter[]>([]);

  useEffect(() => {
    if (!title) return;
    let cancelled = false;
    getAnimeCharacters(title, year ?? null).then((result) => {
      if (!cancelled) setCharacters(result.characters);
    });
    return () => {
      cancelled = true;
    };
  }, [title, year]);

  if (cast.length === 0) return null;

  const imageByCharacterName = new Map(characters.map((c) => [normalizeCharacterName(c.name), c.imageUrl]));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {cast.slice(0, 15).map((member) => {
        const characterImage = findCharacterImage(imageByCharacterName, member.character);
        const photoUrl = characterImage ?? tmdbImageUrl(member.profilePath, "w185");
        return (
          <View key={member.id} style={styles.card}>
            <View style={styles.photo}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <Feather name="user" size={20} color={colors.muted} />
              )}
            </View>
            <Text numberOfLines={1} style={styles.character}>
              {member.character}
            </Text>
            <Text numberOfLines={1} variant="muted" style={styles.name}>
              {member.name}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    width: 96,
  },
  photo: {
    width: 96,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  character: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
  name: {
    fontSize: 11,
  },
});
