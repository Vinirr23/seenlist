"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShieldOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  useReceivedRecommendations,
  useMarkRecommendationRead,
  useDismissRecommendation,
  useBlockUser,
  useUnblockUser,
  useBlockedUsers,
  type ReceivedRecommendation,
} from "@/lib/queries/recommendations";
import { tmdbImage } from "@/lib/tmdb/image";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { SectionPageHeader } from "./SectionPageHeader";
import { EmptyState } from "../search/EmptyState";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/**
 * TASK-169 — recomendações recebidas ("fulano recomendou X pra
 * você"), acessada pelo Perfil (bolinha de aviso no ícone da aba,
 * ver BottomNavigation.tsx). Marca como lida ao TOCAR no card (não
 * ao só abrir a tela) — mesmo raciocínio de e-mail/notificação: só
 * "lido" quando a pessoa de fato viu do que se trata, não quando a
 * lista carregou.
 *
 * Bloquear mora aqui (não numa tela de Configurações separada) de
 * propósito — é a ação mais provável de precisar bem no momento em
 * que uma recomendação indesejada chega, não um ajuste que alguém
 * vai procurar deliberadamente no menu de Configurações.
 *
 * CORREÇÃO (2026-08-27, reportado — "quando entro em recomendações,
 * a tela não está com o design novo") — cards/esqueleto ainda usavam
 * o visual antigo (`bg-surface`/`border-border` chapados), de antes
 * do redesign "vidro" (âmbar/vidro, 2026-08-26) já aplicado no resto
 * do app social. Atualizado pra seguir a mesma linguagem visual —
 * mesmo padrão de `ReviewCard.tsx`/`CommentItem.tsx` (card com borda
 * clara + blur/saturação + gradiente radial translúcido em vez de
 * fundo opaco).
 */
export function RecommendationsPageView() {
  const { data: recommendations, isLoading } = useReceivedRecommendations();
  const markRead = useMarkRecommendationRead();
  const dismiss = useDismissRecommendation();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const { data: blockedUsers } = useBlockedUsers();
  const toast = useToast();
  const [showBlocked, setShowBlocked] = useState(false);
  const { t, locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });

  function handleOpen(rec: ReceivedRecommendation) {
    if (!rec.readAt) markRead.mutate(rec.id);
  }

  function handleDismiss(id: string) {
    hapticTick();
    dismiss.mutate(id);
  }

  function handleBlock(rec: ReceivedRecommendation) {
    hapticTick();
    if (!window.confirm(t("profile.confirmBlockUser", { username: rec.sender.username }))) {
      return;
    }
    blockUser.mutate(rec.sender.userId, {
      onSuccess: () => toast.success(t("profile.userBlocked", { username: rec.sender.username })),
      onError: () => toast.error(t("profile.errorBlockUser")),
    });
  }

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title={t("profile.section.recommendations")} />

      {isLoading && (
        <div className="space-y-2.5" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {!isLoading && recommendations && recommendations.length === 0 && (
        <EmptyState message={t("profile.emptyRecommendations")} />
      )}

      {!isLoading && recommendations && recommendations.length > 0 && (
        <div className="space-y-2.5">
          {recommendations.map((rec) => (
            // "Vidro" (mesmo padrão de ReviewCard.tsx/CommentItem.tsx) — card com borda clara + blur/saturação, em vez do `bg-surface`/`border-border` chapados de antes. Não lida ganha um toque a mais de âmbar (mesmo raciocínio da borda `border-primary/40` de antes).
            <div
              key={rec.id}
              className="flex gap-3 rounded-2xl border p-2.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
              style={{
                borderColor: rec.readAt ? "rgba(255,255,255,0.10)" : "rgba(240,169,79,0.35)",
                background: rec.readAt
                  ? "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.07)"
                  : "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.15), transparent 60%), rgba(240,169,79,0.08)",
              }}
            >
              <Link
                href={`/${rec.mediaType === "movie" ? "movies" : "series"}/${rec.mediaId}`}
                onClick={() => handleOpen(rec)}
                className="flex min-w-0 flex-1 gap-3"
              >
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-background">
                  {rec.posterPath && (
                    <Image src={tmdbImage(rec.posterPath, "w185") ?? ""} alt="" fill sizes="56px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-text">
                      {rec.sender.displayName ?? `@${rec.sender.username}`}
                    </span>{" "}
                    {t("profile.recommendedVerb")}
                  </p>
                  <p className="truncate text-sm font-medium text-text">{rec.title}</p>
                  {rec.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted">&quot;{rec.message}&quot;</p>}
                  <p className="mt-1 text-[10px] text-muted">{dateFormatter.format(new Date(rec.createdAt))}</p>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-center justify-between gap-1 py-0.5">
                <button
                  type="button"
                  onClick={() => handleDismiss(rec.id)}
                  aria-label={t("profile.dismiss")}
                  className="text-muted hover:text-text"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => handleBlock(rec)}
                  aria-label={t("profile.blockUserAriaLabel", { username: rec.sender.username })}
                  className="text-muted hover:text-danger"
                >
                  <ShieldOff className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {blockedUsers && blockedUsers.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-muted"
          >
            {t("profile.blockedUsersHeader", { count: blockedUsers.length })}
            {showBlocked ? <ChevronUp className="h-4 w-4" strokeWidth={2} /> : <ChevronDown className="h-4 w-4" strokeWidth={2} />}
          </button>

          {showBlocked && (
            <div className="mt-2 space-y-1.5">
              {blockedUsers.map((user) => (
                // "Vidro" (mesmo padrão dos cards acima) — em vez de `border-border bg-surface`.
                <div
                  key={user.userId}
                  className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 backdrop-blur-[14px] backdrop-saturate-[160%]"
                  style={{
                    background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10), transparent 60%), rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-sm text-text">{user.displayName ?? `@${user.username}`}</span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTick();
                      unblockUser.mutate(user.userId, {
                        onSuccess: () => toast.success(t("profile.userUnblocked", { username: user.username })),
                      });
                    }}
                    className="text-xs font-medium text-primary"
                  >
                    {t("profile.unblock")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
