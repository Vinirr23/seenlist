import { useState } from "react";
import { View, Modal, Pressable, Share, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
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
 * vez de uma caixa preta sem explicação.
 *
 * REDESIGN (2026-10-08, "estilo Unwind" — mockup aprovado em
 * https://claude.ai/artifact/SvYnmVJedKZkRjvXNHbsdm, decisão explícita
 * do usuário citada no pedido): DUAS AÇÕES DISTINTAS, nunca uma
 * substituindo a outra automaticamente —
 *
 * 1. "Compartilhar link" — comportamento de sempre (`Share.share` com
 *    a URL da review); o que abre é a prévia OG (`imageUrl`, formato
 *    paisagem 1200×630), igual já era.
 * 2. "Exportar pra Stories" — NOVO: baixa a imagem vertical gerada por
 *    `story-image/route.ts` (`storyImageUrl`, formato 1080×1920) pra
 *    um arquivo local e abre o share sheet nativo de ARQUIVO
 *    (`expo-sharing`, mesmo pacote já usado em `app/week-review.tsx`
 *    pra exportar a imagem da semana) — isso é o que deixa o usuário
 *    postar direto no Stories do Instagram/WhatsApp, algo que
 *    compartilhar só a URL não cobre.
 *
 * Por que baixar em vez de usar `Share.share({ url: storyImageUrl })`
 * direto: a API de compartilhamento do React Native não baixa uma URL
 * remota sozinha — pra aparecer como IMAGEM (e não como um link de
 * texto) no destino, o arquivo precisa existir localmente primeiro
 * (mesma razão prática por trás do uso de `expo-sharing`/`FileSystem`
 * em `week-review.tsx`, só que lá a imagem já nasce local via
 * `captureRef`; aqui ela vem do servidor, por isso o download).
 */
export function SharePreviewSheet({
  imageUrl,
  storyImageUrl,
  shareUrl,
  onDismiss,
}: {
  imageUrl: string;
  storyImageUrl: string;
  shareUrl: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">("loading");
  const [exportingStory, setExportingStory] = useState(false);

  async function handleShareLink() {
    try {
      await Share.share({ url: shareUrl, message: shareUrl });
      onDismiss();
    } catch (error) {
      console.error("[SharePreviewSheet] Falha ao compartilhar link", error);
    }
  }

  async function handleExportStory() {
    if (exportingStory) return;
    try {
      setExportingStory(true);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        console.warn("[SharePreviewSheet] Sharing não disponível nesta plataforma/simulador.");
        return;
      }
      // Nome de arquivo com timestamp — evita servir um PNG antigo do
      // cache do `FileSystem` caso o usuário exporte a mesma review
      // mais de uma vez na mesma sessão do app.
      const fileUri = `${FileSystem.cacheDirectory}seenlist-story-${Date.now()}.png`;
      const { uri } = await FileSystem.downloadAsync(storyImageUrl, fileUri);
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: t("social.exportToStory"),
      });
    } catch (error) {
      console.error("[SharePreviewSheet] Falha ao exportar imagem pra Stories", error);
    } finally {
      setExportingStory(false);
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
            <Button onPress={handleShareLink} icon={<Feather name="link" size={16} color={colors.background} />}>
              {t("social.shareAsLink")}
            </Button>
            <Button
              variant="outline"
              loading={exportingStory}
              onPress={handleExportStory}
              icon={!exportingStory ? <Feather name="download" size={16} color={colors.text} /> : undefined}
            >
              {t("social.exportToStory")}
            </Button>
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
