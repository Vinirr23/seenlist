import { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { StarRating } from "./StarRating";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export interface ReviewComposerProps {
  initialRating?: number;
  initialText?: string | null;
  hasExistingReview?: boolean;
  isPending?: boolean;
  canShareToFeed?: boolean;
  /**
   * A PEDIDO (2026-09-25, filme — "a avaliação na tab 'sobre' e a tab
   * 'mais' estão ficando duplicadas") — filme agora avalia (nota) pela
   * aba "Mais" (`app/movies/[id].tsx`), que já escreve na mesma linha
   * de `reviews`. Esta tela ("Ver todas as avaliações") virou lugar só
   * de TECER COMENTÁRIO — `false` esconde as estrelas e destrava
   * salvar com base no texto, não na nota (que já existe/veio de lá,
   * `initialRating`, e segue junto sem mudar). Default `true` — série
   * continua igual, não tem esse componente duplicado em lugar nenhum.
   */
  showRating?: boolean;
  /**
   * BUG REAL CORRIGIDO (2026-10-01, reportado — avaliação "zerada" no
   * Feed) — `rating` agora é `number | null`, não só `number`. Quando
   * `showRating` é `false` (filme, "Ver todas as avaliações" — ver
   * comentário da prop acima), as estrelas nem aparecem aqui pra
   * pessoa mexer; o estado interno `rating` só existia pra "lembrar" a
   * nota que já existe (`initialRating`), nunca pra registrar uma nota
   * NOVA. Antes isso era mandado pra cá do mesmo jeito que uma nota de
   * verdade — se não havia nota nenhuma ainda, ia `0`, e quem recebe
   * gravava um "0" de verdade no banco. Agora manda `null` nesse caso
   * ("não mexer na nota") — quem recebe decide o que fazer (ver
   * `ReviewsFullView.tsx`/`handleSubmit`).
   */
  onSubmit: (rating: number | null, reviewText: string | null, shareToFeed: boolean) => void;
  /**
   * PORTE DO WEB (2026-09-09, comparado no print) — "Remover minha
   * avaliação" mora DENTRO do card, na mesma linha do botão de salvar
   * (`ReviewFullComposer.tsx`: `flex items-center justify-between
   * border-t`). No mobile ele estava solto embaixo do card, como um
   * link avulso.
   */
  onDelete?: () => void;
  isDeleting?: boolean;
  /**
   * A PEDIDO (2026-10-08, reportado — "minha avaliação já publicada
   * aparece como se eu ainda estivesse digitando") — `ReviewsFullView.tsx`
   * agora só mostra este formulário aberto quando a pessoa toca
   * "Editar" num card fechado (ou na primeira avaliação, sem card
   * ainda). `onCancel` (só passado quando já existe conteúdo pra
   * voltar) fecha sem salvar nada.
   */
  onCancel?: () => void;
}

/**
 * TASK-101 (Avaliações) — porta de `ReviewComposer.tsx`. Avaliação
 * rápida (só nota) e review completa (nota + texto) são o mesmo
 * formulário — texto é opcional.
 *
 * RELIGADO (2026-09-28, Feed voltou como sub-aba de Explorar) — a
 * caixa "Publicar também no Feed" volta a aparecer: `ReviewsFullView.tsx`
 * (a única tela que usa este composer com `showRating`/review
 * completa) passa `canShareToFeed`.
 *
 * A PEDIDO (implementar tudo igual ao web) — "Contém spoiler" saiu
 * (review de mídia inteira raramente precisa disso). "Publicar
 * também no Feed" vem MARCADO por padrão só na PRIMEIRA vez
 * (`hasExistingReview` false) — reabrir uma review já existente pra
 * editar vem DESMARCADO, pra não republicar sem querer a cada edição
 * (mesma correção do bug real "review duplicada no Feed", já
 * corrigida em `lib/posts.ts`/`createReviewPost`).
 *
 * VIDRO REMOVIDO (2026-10-06, a pedido — "em séries/episódios é só
 * pra tirar o glass completamente") — card virou superfície plana
 * (`colors.surface`), mesma receita visual do Feed (sem blur/borrão).
 * Era `<Glass>` desde o porte do web (2026-09-04); textarea/checkbox
 * internos continuam como sempre estiveram, sem vidro.
 */
export function ReviewComposer({
  initialRating = 0,
  initialText = "",
  hasExistingReview = false,
  isPending,
  canShareToFeed = false,
  showRating = true,
  onSubmit,
  onDelete,
  isDeleting,
  onCancel,
}: ReviewComposerProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText ?? "");
  const [shareToFeed, setShareToFeed] = useState(!hasExistingReview);

  /**
   * BUG REAL CORRIGIDO (2026-10-08, reportado — "não consigo ver
   * minhas próprias reviews") — CAUSA RAIZ: `useState(initialRating)`/
   * `useState(initialText)` acima só usam esses valores na PRIMEIRA
   * renderização. `myReview` (de onde vêm `initialRating`/`initialText`,
   * ver `ReviewsFullView.tsx`) é buscado de forma ASSÍNCRONA — ainda é
   * `null` no instante exato em que este formulário é montado pela
   * primeira vez, então `rating`/`text` nascem vazios. Quando os dados
   * chegam um instante depois e o componente re-renderiza com as props
   * certas, o React NÃO reaplica o valor inicial do `useState` — o
   * campo fica preso vazio pra sempre, mesmo a pessoa já tendo uma
   * avaliação salva (prova: `hasExistingReview` already correto é o
   * que faz "Remover minha avaliação" aparecer — os dados chegaram,
   * só não foram aplicados ao campo). Corrigido sincronizando
   * `rating`/`text` só quando `hasExistingReview` MUDA de valor
   * (chegada dos dados reais, ou remoção) — nunca durante digitação
   * em andamento, já que nesse meio tempo `hasExistingReview` não
   * muda.
   */
  const prevHasExistingReviewRef = useRef(hasExistingReview);
  useEffect(() => {
    if (prevHasExistingReviewRef.current !== hasExistingReview) {
      setRating(initialRating);
      setText(initialText ?? "");
      prevHasExistingReviewRef.current = hasExistingReview;
    }
  }, [hasExistingReview, initialRating, initialText]);
  // Sem estrelas nesta tela (`showRating: false`), a nota não é editada aqui — segue a que já existe (`initialRating`, vinda da aba "Mais"); só o texto trava/destrava salvar.
  const naoPodeSalvar = Boolean(isPending) || (showRating ? rating === 0 : text.trim().length === 0);
  const temTexto = text.trim().length > 0;

  /**
   * REGRA (2026-10-06, "Activity vs. Post de Review", auditoria aprovada
   * pelo usuário) — "Publicar também no Feed" só existe de verdade
   * quando há opinião escrita. Sem isso seria possível marcar a caixa,
   * apagar o texto e salvar — gerando um Post de Review vazio. Em vez
   * de só desabilitar visualmente mantendo um estado "marcado" por
   * baixo (o que ignoraria a intenção em silêncio), o estado real é
   * desmarcado no momento em que o texto esvazia — ao digitar de novo,
   * a pessoa precisa marcar de novo, de forma explícita.
   *
   * BUG (2026-10-08, "a caixa precisa estar marcada por padrão e está
   * desmarcada por padrão") — CAUSA RAIZ: todo `useEffect` roda também
   * na primeira renderização. Numa review nova, `text` nasce vazio, ou
   * seja `temTexto` já é `false` no mount — e o efeito disparava ali
   * mesmo, desmarcando a caixa antes da pessoa digitar qualquer coisa,
   * mesmo com o `useState` da linha acima já tendo inicializado
   * `shareToFeed` como `true`. `isMountedRef` faz o efeito ignorar essa
   * primeira execução — só passa a desmarcar quando o texto for
   * apagado DEPOIS de já ter existido, que é a regra original.
   */
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (!temTexto && shareToFeed) setShareToFeed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a temTexto ficar false; não precisa rodar de novo por mudança em shareToFeed.
  }, [temTexto]);

  return (
    <View style={styles.card}>
      {/* As estrelas ficavam CENTRALIZADAS; no web elas nascem no canto esquerdo do card, como qualquer outra linha do formulário. */}
      {showRating && (
        <View style={styles.ratingRow}>
          <StarRating value={rating} onChange={setRating} />
          {/*
            PÍLULA COM A NOTA (2026-10-06, mockup "Opção B" escolhido —
            https://claude.ai/artifact/59y79DxBCPvQgTS48Lh6Pa) — mesma
            linguagem visual do selo de tipo de atividade já padronizado
            no Feed (círculo/pílula na cor-marca). Só aparece com nota
            dada (`rating > 0`) — sem nota ainda, não tem o que mostrar.
          */}
          {rating > 0 && (
            <View style={styles.ratingPill}>
              <View style={styles.ratingPillDot} />
              <Text style={styles.ratingPillText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      )}

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
        <Pressable
          style={[styles.checkboxRow, !temTexto && styles.desabilitado]}
          disabled={!temTexto}
          onPress={() => setShareToFeed((v) => !v)}
        >
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
        <View style={styles.actionsLeft}>
          {onCancel && (
            <Pressable onPress={onCancel}>
              <Text variant="muted" style={styles.cancelLabel}>
                {t("common.cancel")}
              </Text>
            </Pressable>
          )}
          {hasExistingReview && onDelete && (
            <Pressable onPress={onDelete} disabled={isDeleting}>
              <Text style={[styles.removeLabel, isDeleting === true && styles.desabilitado]}>
                {t("review.removeMyReview")}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.saveButton, naoPodeSalvar && styles.desabilitado]}
          disabled={naoPodeSalvar}
          onPress={() => onSubmit(showRating ? rating : null, text.trim() || null, shareToFeed)}
        >
          {isPending === true ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.saveLabel}>{t("review.saveReview")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // PÍLULA COM A NOTA (2026-10-06, ver comentário grande no JSX, acima).
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(232,163,61,0.14)",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  ratingPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  ratingPillText: {
    fontSize: fontSize.sm,
    fontWeight: "800",
    color: colors.primary,
  },
  /** `space-y-3 ... p-3.5` = 12 entre as partes e 14 de recheio (era 8 e 16). */
  card: {
    gap: 12,
    borderRadius: radius.lg,
    padding: 14,
    backgroundColor: colors.surface,
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
  actionsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cancelLabel: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  /** `text-xs font-medium text-danger`. */
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
  removeLabel: {
    fontSize: fontSize.xs,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
  saveLabel: {
    fontSize: fontSize.xs,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
  checkboxLabel: {
    fontSize: fontSize.xs,
  },
});
