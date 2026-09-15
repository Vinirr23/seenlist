import { useEffect, useState } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/lib/theme";

/**
 * Idêntico a `initials()` de `apps/web/components/common/Avatar.tsx`
 * (agora exportado daqui pelo mesmo motivo: era duplicado, ao pé da
 * letra, em 9 arquivos do mobile — `apps/mobile/app/(tabs)/profile.tsx`,
 * `apps/mobile/app/u/[username]/index.tsx`, `apps/mobile/app/u/[username].tsx`,
 * `apps/mobile/app/settings/edit-profile.tsx`,
 * `apps/mobile/components/profile/FollowListRow.tsx`,
 * `apps/mobile/components/episode/EpisodeCommentItem.tsx`,
 * `apps/mobile/components/explore/ActivityFeedRow.tsx`,
 * `apps/mobile/components/feed/PostCard.tsx` — 8 delas com a função
 * `initials()` copiada igual; a nona, `ProfileRecommendationsPreview.tsx`,
 * já usava uma versão própria de 1 letra só).
 */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export interface AvatarProps {
  /** URL da foto — `null`/`undefined`/string vazia já cai direto pras iniciais, sem tentar carregar nada. */
  uri?: string | null;
  /** Nome usado pras iniciais de reserva (via `initials()` acima). Ignorado se `fallbackText` for passado. */
  name: string;
  /**
   * Sobrescreve o texto de reserva calculado a partir de `name` —
   * usado só por `ProfileRecommendationsPreview.tsx`, que sempre teve
   * seu próprio formato de 1 letra só (diferente do padrão de 2
   * letras de `initials()`), pra não mudar esse visual ao adotar este
   * componente compartilhado.
   */
  fallbackText?: string;
  /** Estilo do CÍRCULO (tamanho, fundo, borda, `overflow: "hidden"`) — cada tela já usava um tamanho/fundo diferente antes; preservado aqui, passado por quem chama (mesmo `styles.avatar`/`styles.avatarOverlap` de sempre). */
  style?: StyleProp<ViewStyle>;
  /** Estilo do TEXTO das iniciais (tipicamente só `fontSize`, já que peso/cor têm um padrão aqui) — passe o `styles.avatarInitials` que a tela já tinha, sem precisar mudar nada nele. */
  textStyle?: StyleProp<TextStyle>;
}

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-04 — "avatar quebrado fica quebrado
 * pra sempre", auditoria web-vs-mobile — porte de
 * `apps/web/components/common/Avatar.tsx`, ver comentário grande lá
 * pro histórico completo do bug no web) — todo lugar do mobile que
 * mostra foto de perfil só decidia UMA vez, na hora de renderizar, se
 * mostrava `<Image>` ou iniciais (`avatarUrl ? <Image/> : <iniciais>`)
 * — quando a URL EXISTE mas a imagem falha ao carregar DE VERDADE
 * (link apagado/expirado no Storage do Supabase, bloqueio de host,
 * hiccup de rede etc.), o `expo-image` ficava com a área em branco/
 * ícone de erro pra sempre. Só o caso "sem `avatarUrl` nenhum" tinha
 * reserva; "tem link, mas ele não funciona" nunca foi tratado em
 * lugar nenhum — idêntico ao bug que o web teve e corrigiu.
 *
 * `onError` do `expo-image` liga um estado local (`failed`) que troca
 * pras iniciais assim que o carregamento falhar de verdade.
 * `useEffect` reseta `failed` quando `uri` muda — sem isso, se o mesmo
 * componente for reaproveitado pra pessoas diferentes sem remontar,
 * um erro antigo "vazaria" pro próximo avatar.
 */
export function Avatar({ uri, name, fallbackText, style, textStyle }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showImage = !!uri && !failed;

  return (
    <View style={style}>
      {showImage ? (
        <Image source={{ uri: uri! }} style={styles.image} onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.initials, textStyle]}>{fallbackText ?? initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
  initials: {
    fontWeight: "700",
    color: colors.muted,
  },
});
