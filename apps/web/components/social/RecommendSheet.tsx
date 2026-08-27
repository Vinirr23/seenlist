"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useFollowList } from "@/lib/queries/follow-list";
import { useSendRecommendation } from "@/lib/queries/recommendations";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useDialogAnimation } from "@/lib/useDialogAnimation";
import { Avatar } from "@/components/common/Avatar";
import { cn } from "@seenlist/utils";

const MAX_MESSAGE_LENGTH = 200;

/**
 * TASK-169 — "recomendar" reaproveita `useFollowList` (já existia
 * pra tela de seguidores/seguindo) filtrando por "following" — só
 * pra quem o usuário segue, decisão explícita. Sem busca de usuário
 * global de propósito (diferente do "buscar pessoas" de Explorar) —
 * essa lista já é pequena o bastante pra rolar, e limitar a quem já
 * se segue é a regra de negócio, não só uma conveniência de UI.
 *
 * BUG REAL CORRIGIDO (2026-08-27, reportado — "a foto de perfil no
 * sheet de recomendações está quebrada") — causa raiz: o avatar usava
 * `next/image` (`<Image fill .../>`), que exige que o domínio da URL
 * esteja liberado em `next.config` pra otimizar a imagem — avatar
 * vem do Storage do Supabase (ou de contas especiais tipo
 * "@seenlistapp"), domínio que não está nessa lista, então a imagem
 * falhava silenciosamente. Todo outro lugar do app que mostra avatar
 * de OUTRA pessoa (`UserListRow.tsx`, `ReviewCard.tsx`,
 * `CommentItem.tsx`) já evita isso de propósito, usando `<img>` puro
 * (comentário `eslint-disable` explicando o motivo, replicado aqui) —
 * só este arquivo tinha ficado de fora. Corrigido junto: fallback de
 * iniciais quando não tem foto (antes não tinha NENHUM — só um
 * círculo vazio), mesmo padrão de `UserListRow.tsx`.
 *
 * CORREÇÃO (2026-08-27, reportado — "quando entro em recomendações,
 * não está com o design novo") — cartão/lista/botões daqui ainda
 * usavam o visual antigo (`bg-surface`/`border-border` chapados), de
 * antes do redesign "vidro" (âmbar/vidro, 2026-08-26) já aplicado no
 * resto do app social (avaliações, comentários, perfil). Atualizado
 * pra seguir a mesma linguagem visual.
 */
export function RecommendSheet({
  mediaType,
  mediaId,
  mediaTitle,
  onClose,
}: {
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  onClose: () => void;
}) {
  const { data: currentUser } = useCurrentUser();
  const { mounted, handleClose } = useDialogAnimation(onClose);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { data: following, isLoading } = useFollowList(currentUser?.id ?? null, "following", search);
  const sendRecommendation = useSendRecommendation();
  const toast = useToast();
  const { t } = useTranslation();

  function handleSend() {
    if (!selectedUserId) return;
    hapticTick();
    sendRecommendation.mutate(
      { recipientId: selectedUserId, mediaType, mediaId, message },
      {
        onSuccess: () => {
          toast.success(t("social.recommendationSent"));
          handleClose();
        },
        onError: () => toast.error(t("social.recommendationSendError")),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={cn("absolute inset-0 bg-black/60 transition-opacity duration-200", mounted ? "opacity-100" : "opacity-0")}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* "Vidro" (mesmo painel escuro translúcido do dropdown de CommentItem.tsx/ConfirmDialog.tsx) — em vez do `bg-surface` chapado de antes. */}
      <div
        className={cn(
          "relative flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-2xl border-t border-x border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-[18px] backdrop-saturate-[180%] transition-transform duration-200 ease-out",
          mounted ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(20,22,30,0.9)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">{t("social.recommendTitle", { title: mediaTitle })}</p>
          <button type="button" onClick={handleClose} aria-label={t("social.close")} className="text-muted">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("social.searchFollowing")}
          className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
        />

        <div className="mb-3 flex-1 overflow-y-auto">
          {isLoading && (
            <div className="space-y-1" aria-busy="true" aria-label={t("common.loading")}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-white/10" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && following && following.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              {search.trim() ? t("social.noOneFound") : t("social.notFollowingAnyone")}
            </p>
          )}
          {following?.map((person) => {
            const selected = selectedUserId === person.userId;
            const personName = person.displayName ?? person.username;
            return (
              <button
                key={person.userId}
                type="button"
                onClick={() => {
                  hapticTick();
                  setSelectedUserId(selected ? null : person.userId);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                  selected ? "bg-primary/15" : "hover:bg-white/5"
                )}
              >
                {/*
                 * BUG REAL CORRIGIDO (2026-08-27, reportado de novo —
                 * "algumas fotos de perfil continuam quebrando", depois
                 * da 1ª correção aqui que só tratava avatarUrl vazio) —
                 * ver comentário completo em `components/common/Avatar.tsx`.
                 * Link existente mas quebrado (não só ausente) agora
                 * também cai pras iniciais.
                 */}
                <Avatar src={person.avatarUrl} name={personName} className="h-9 w-9 bg-white/10" textClassName="text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{personName}</p>
                  <p className="truncate text-xs text-muted">@{person.username}</p>
                </div>
                <div
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border-2",
                    selected ? "border-primary bg-primary" : "border-white/20"
                  )}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder={t("social.recommendMessagePlaceholder")}
          rows={2}
          className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!selectedUserId || sendRecommendation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
        >
          <Send className="h-4 w-4" strokeWidth={2.25} />
          {sendRecommendation.isPending ? t("social.sending") : t("social.sendRecommendation")}
        </button>
      </div>
    </div>
  );
}
