import { useState } from "react";
import { View, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { StarRating } from "./StarRating";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export interface ReviewComposerProps {
  initialRating?: number;
  initialText?: string | null;
  hasExistingReview?: boolean;
  isPending?: boolean;
  canShareToFeed?: boolean;
  onSubmit: (rating: number, reviewText: string | null, shareToFeed: boolean) => void;
  /**
   * PORTE DO WEB (2026-09-09, comparado no print) — "Remover minha
   * avaliação" mora DENTRO do card, na mesma linha do botão de salvar
   * (`ReviewFullComposer.tsx`: `flex items-center justify-between
   * border-t`). No mobile ele estava solto embaixo do card, como um
   * link avulso.
   */
  onDelete?: () => void;
  isDeleting?: boolean;
}

/**
 * TASK-101 (Avaliações) — porta de `ReviewComposer.tsx`. Avaliação
 * rápida (só nota) e review completa (nota + texto) são o mesmo
 * formulário — texto é opcional.
 *
 * DECISÃO DE PRODUTO (a pedido — aba Feed descontinuada) — a caixa
 * "Publicar também no Feed" não é mais usada em lugar nenhum:
 * `canShareToFeed` continua na interface (o componente é
 * compartilhado, e voltar é só passar a prop de novo), mas nenhuma
 * tela passa `true` hoje.
 *
 * A PEDIDO (implementar tudo igual ao web) — "Contém spoiler" saiu
 * (review de mídia inteira raramente precisa disso). "Publicar
 * também no Feed" vem MARCADO por padrão só na PRIMEIRA vez
 * (`hasExistingReview` false) — reabrir uma review já existente pra
 * editar vem DESMARCADO, pra não republicar sem querer a cada edição
 * (mesma correção do bug real "review duplicada no Feed", já
 * corrigida em `lib/posts.ts`/`createReviewPost`).
 *
 * PORTE DO WEB (2026-09-04, "vidro que falta") — card vira `<Glass>`
 * (web, `ReviewFullComposer.tsx`: "mesma textura de card neutro do
 * resto do app; textarea/checkbox internos ficam como estão — campos
 * de formulário não recebem vidro").
 */
export function ReviewComposer({
  initialRating = 0,
  initialText = "",
  hasExistingReview = false,
  isPending,
  canShareToFeed = false,
  onSubmit,
  onDelete,
  isDeleting,
}: ReviewComposerProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText ?? "");
  const [shareToFeed, setShareToFeed] = useState(!hasExistingReview);
  const naoPodeSalvar = rating === 0 || Boolean(isPending);

  return (
    <Glass style={styles.card}>
      {/* As estrelas ficavam CENTRALIZADAS; no web elas nascem no canto esquerdo do card, como qualquer outra linha do formulário. */}
      <StarRating value={rating} onChange={setRating} />

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t("review.reviewPlaceholder")}
        placeholderTextColor={colors.muted}
        multiline
        maxLength={4000}
        style={styles.textArea}
      />

      {canShareToFeed && (
        <Pressable style={styles.checkboxRow} onPress={() => setShareToFeed((v) => !v)}>
          <View style={[styles.checkbox, shareToFeed && styles.checkboxChecked]}>
            {shareToFeed && <Feather name="check" size={11} color={colors.background} />}
          </View>
          <Text variant="muted" style={styles.checkboxLabel}>
            Publicar também no Feed
          </Text>
        </Pressable>
      )}

      {/*
        PORTE DO WEB (2026-09-09, comparado no print) — aqui estava o
        `Button` do app: 48px de altura e LARGURA TOTAL, um bloco âmbar
        atravessando o card. No web é uma linha com um traço em cima
        (`border-t`): à esquerda o link de remover (quando já existe
        avaliação), à direita um botão PEQUENO
        (`rounded-lg px-4 py-1.5 text-xs font-semibold`).
      */}
      <View style={styles.actionsRow}>
        {hasExistingReview && onDelete ? (
          <Pressable onPress={onDelete} disabled={isDeleting}>
            <Text style={[styles.removeLabel, isDeleting === true && styles.desabilitado]}>
              {t("review.removeMyReview")}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable
          style={[styles.saveButton, naoPodeSalvar && styles.desabilitado]}
          disabled={naoPodeSalvar}
          onPress={() => onSubmit(rating, text.trim() || null, shareToFeed)}
        >
          {isPending === true ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.saveLabel}>{t("review.saveReview")}</Text>
          )}
        </Pressable>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  // `Glass` não define raio — web usa `rounded-2xl` (16px) = `radius.lg`.
  /** `space-y-3 ... p-3.5` = 12 entre as partes e 14 de recheio (era 8 e 16). */
  card: {
    gap: 12,
    borderRadius: radius.lg,
    padding: 14,
  },
  /** `rounded-lg border border-border bg-background px-3 py-2 text-sm`, `rows={3}`. */
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8, // `rounded-lg` (era `radius.md` = 10)
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  /** `flex items-center justify-between border-t border-border pt-2.5`. */
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  /** `text-xs font-medium text-danger`. */
  removeLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.danger,
  },
  /** `rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background`. */
  saveButton: {
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
  },
  saveLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.background,
  },
  /** `disabled:opacity-50`. */
  desabilitado: {
    opacity: 0.5,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 12,
  },
});
