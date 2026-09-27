import { useEffect, useState } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { CastMember } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { getAnimeCharacters, type AnimeCharacter } from "@/lib/animeCharacters";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Text, Glass } from "@/components/ui";
import { colors, fontSize, radius } from "@/lib/theme";

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
  const { t } = useTranslation();
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
    /*
     * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance —
     * item 6.1: "Cast/Similar → FlatList") — era `ScrollView` +
     * `.map()`, o MESMO padrão já corrigido em `EpisodeCarousel.tsx`
     * (TASK-162) e `DiscoverCarousel.tsx`: desenha TODOS os cards de
     * uma vez, não importa quantos atores o elenco tenha (o corte em
     * 15 já tinha sido removido de propósito — ver comentário acima —
     * então um elenco grande monta dezenas de cards `Glass` de uma
     * só vez). `FlatList` só desenha o que está perto da área visível
     * (virtualização); `getItemLayout` (todo card tem a mesma largura)
     * evita medir nada. Nenhuma mudança visual: mesmos estilos, mesma
     * ordem, mesmo conteúdo por card.
     */
    <FlatList
      data={cast}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(member) => String(member.id)}
      contentContainerStyle={styles.row}
      getItemLayout={(_, index) => ({
        length: CARD_WIDTH + ROW_GAP,
        offset: (CARD_WIDTH + ROW_GAP) * index,
        index,
      })}
      initialNumToRender={6}
      windowSize={5}
      maxToRenderPerBatch={8}
      renderItem={({ item: member }) => {
        const characterImage = findCharacterImage(imageByCharacterName, member.character);
        /*
         * CORREÇÃO (bug real, reportado com print) — quando a série É
         * anime (achamos personagens), NUNCA cai pro dublador: se um
         * personagem específico não casar, mostra o ícone genérico em
         * vez da foto do ator.
         *
         * O motivo: misturar foto de personagem animado com foto de
         * dublador na MESMA fileira é pior que ter um espaço vazio —
         * quem olha não entende o que está vendo, e parece defeito.
         * Consistência vale mais que preencher a todo custo.
         *
         * Fora de anime (nenhum personagem encontrado), o
         * comportamento continua igual: foto do ator, que é o certo.
         */
        const isAnime = imageByCharacterName.size > 0;
        const photoUrl = isAnime ? characterImage : tmdbImageUrl(member.profilePath, "w185");
        return (
          <View style={styles.card}>
            {/*
              PORTE DO WEB (2026-09-09) — a caixa da foto era um
              retângulo SÓLIDO (`colors.surface`). No web ela é vidro:
              `border border-white/10 backdrop-blur-[14px]
              backdrop-saturate-[180%]` + brilho 0.16 / base 0.09 —
              exatamente a receita `medium` do `Glass`. E o vazio não é
              ícone: o web escreve "Sem foto" (`episode.noPhoto`) em
              10px, centralizado.
            */}
            <Glass style={styles.photo} variant="medium">
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <Text numberOfLines={2} variant="muted" style={styles.noPhoto}>
                  {t("episode.noPhoto")}
                </Text>
              )}
            </Glass>
            <Text numberOfLines={1} style={styles.character}>
              {member.character}
            </Text>
            <Text numberOfLines={1} variant="muted" style={styles.name}>
              {member.name}
            </Text>
          </View>
        );
      }}
    />
  );
}

/**
 * CORREÇÃO DE DESEMPENHO (2026-09-27) — extraídas do `StyleSheet`
 * abaixo (`row.gap`/`card.width`) só para alimentar `getItemLayout`
 * da `FlatList`; os valores continuam os mesmos de sempre, nada
 * mudou visualmente.
 */
const CARD_WIDTH = 112; // `w-28` (era 96) — mesmo valor de `styles.card.width`.
const ROW_GAP = 12; // `flex gap-3` — mesmo valor de `styles.row.gap`.

const styles = StyleSheet.create({
  /** `flex gap-3 ... pb-1` = 12 entre os cards, 4 de folga embaixo (era `spacing.sm` = 8, sem folga). */
  row: {
    flexDirection: "row",
    gap: ROW_GAP,
    paddingBottom: 4,
  },
  /** `w-28` = 112 (era 96). */
  card: {
    width: CARD_WIDTH,
  },
  /**
   * `aspect-[2/3] w-full ... rounded-xl` = 112 × 168, canto 12.
   * Aqui era 96 × 128 (proporção 3/4) com canto 10 — card menor e
   * com formato diferente do pôster do web.
   */
  photo: {
    width: 112,
    aspectRatio: 2 / 3,
    borderRadius: radius.card, // `rounded-xl` (FASE 2, 2026-09-26 — token formalizado)
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  /** `text-[10px] text-muted` centralizado. */
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.micro` (era literal 10, mesmo valor).
  noPhoto: {
    fontSize: fontSize.micro,
    textAlign: "center",
  },
  /** `mt-1.5 text-xs font-semibold` = 6 de topo (era 4). */
  character: {
    marginTop: 6,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  name: {
    fontSize: fontSize.xxs,
  },
});
