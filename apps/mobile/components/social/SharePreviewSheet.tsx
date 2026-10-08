import { useState } from "react";
import { View, Modal, Pressable, Share, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize, scrim, elevation } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social" — item 3 do pedido:
 * "ao tocar no botão de compartilhamento de uma avaliação, quero uma
 * interface de pré-visualização dentro do SeenList"). Mesmo padrão
 * visual de `RecommendPromptSheet.tsx` (dialog centralizado +
 * `Glass`... — na verdade, igual ao resto do app DEPOIS da remoção
 * do vidro em telas de review/feed, 2026-10-06/09-29: `View` com
 * `colors.surface` chapado, sem blur).
 *
 * Mostra a MESMA imagem que o Threads/WhatsApp vai buscar
 * (`imageUrl`, servida por `opengraph-image.tsx` no site) — não uma
 * composição separada — garantindo que "o que você vê aqui é o que
 * vai ser compartilhado".
 *
 * Só "Compartilhar" + "Cancelar": sem botão de copiar link — o
 * próprio `Share.share` nativo já oferece "Copiar" como uma das
 * opções do sistema, tanto no iOS quanto no Android (mesmo motivo
 * documentado em `components/feed/PostCard.tsx`: não adicionar
 * `expo-clipboard`, dependência nova, só pra duplicar algo que o
 * compartilhamento nativo já cobre).
 *
 * BUG REAL CORRIGIDO (2026-10-08, reportado com print — "a prévia
 * aparece como uma caixa preta vazia") — causa raiz: o `<Image>` do
 * `expo-image` não tinha NENHUM tratamento de carregamento/erro — se
 * a imagem demorasse (gerada sob demanda pelo `opengraph-image.tsx`
 * no servidor, não é um arquivo estático) ou falhasse por qualquer
 * motivo (edge function fora do ar, review sem card válido — ver
 * `reviewShareCard.ts`), o componente nativo de imagem simplesmente
 * não desenha nada: sem ícone de "imagem quebrada" como um navegador
 * mostraria, só o fundo escuro do frame, indistinguível de "ainda não
 * carregou". Corrigido com estado explícito: um spinner enquanto
 * carrega (`onLoadStart`/`onLoad`) e um ícone + texto de erro quando
 * falha (`onError`) — pelo menos a pessoa vê que algo deu errado, em
 * vez de uma caixa preta sem explicação. Isso NÃO resolve a causa
 * raiz do porquê a imagem pode falhar (precisa confirmar com o
 * usuário se a URL abre direto no navegador do celular) — só evita
 * que a UI minta dizendo que está tudo bem quando não está.
 */
export function SharePreviewSheet({
  imageUrl,
  shareUrl,
  onDismiss,
}: {
  imageUrl: string;
  shareUrl: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">("loading");

  async function handleShare() {
    try {
      await Share.share({ url: shareUrl, message: shareUrl });
      onDismiss();
    } catch (error) {
      console.error("[SharePreviewSheet] Falha ao compartilhar", error);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View style={styles.dialog}>
          <Text style={styles.title}>{t("social.sharePreviewTitle")}</Text>

          <View style={styles.imageFrame}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              onLoadStart={() => setImageState("loading")}
              onLoad={() => setImageState("loaded")}
              onError={(event) => {
                console.error("[SharePreviewSheet] Falha ao carregar prévia", imageUrl, event.error);
                setImageState("error");
              }}
            />
            {imageState === "loading" && (
              <View style={styles.imageOverlay}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            {imageState === "error" && (
              <View style={styles.imageOverlay}>
                <Feather name="image" size={22} color={colors.muted} />
                <Text variant="muted" style={styles.imageErrorText}>
                  {t("social.sharePreviewImageError")}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Button onPress={handleShare}>{t("social.share")}</Button>
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
              <Text variant="muted" style={styles.dismissText}>
                {t("common.cancel")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: scrim.modal,
  },
  dialog: {
    ...elevation.high,
    width: "100%",
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  imageFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: 1200 / 630,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  imageErrorText: {
    fontSize: fontSize.xxs,
  },
  actions: {
    width: "100%",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
