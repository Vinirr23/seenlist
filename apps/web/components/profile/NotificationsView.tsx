"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/lib/queries/notifications";
import { tmdbImage } from "@/lib/tmdb/image";
import { Avatar } from "@/components/common/Avatar";
import { SectionPageHeader } from "./SectionPageHeader";
import { EmptyState } from "../search/EmptyState";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/**
 * A PEDIDO (2026-09-15 — sino de notificações no Perfil, web + mobile).
 * Mesmo formato visual de `RecommendationsPageView.tsx` (card vidro,
 * mais aceso quando não lida) — os 7 tipos previstos em
 * `notifications` (ver a migration nova, `20260915010000_...sql`,
 * pra causa raiz de por que só 3 deles realmente geravam notificação
 * até agora).
 *
 * Link de cada notificação: pra `new_follower` vai pro perfil de quem
 * seguiu; pras demais (todas ligadas a um filme/série, ver a
 * migration) vai pro título. Não existe ainda um jeito de pular
 * direto pro comentário/review exato dentro da tela do título — fica
 * registrado como simplificação conhecida, não esquecimento.
 */
function getNotificationMessage(n: AppNotification, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const name = n.actor?.displayName ?? (n.actor ? `@${n.actor.username}` : "");
  const title = n.mediaTitle ?? "";
  switch (n.type) {
    case "comment_reply":
      return t("notifications.commentReply", { name, title });
    case "comment_like":
      return t("notifications.commentLike", { name, title });
    case "review_like":
      return t("notifications.reviewLike", { name, title });
    case "episode_new":
      return t("notifications.episodeNew", { title });
    case "season_premiere":
      return t("notifications.seasonPremiere", { title });
    case "recommendation":
      return t("notifications.recommendation", { name, title });
    case "new_follower":
      return t("notifications.newFollower", { name });
    case "feedback_reply":
      return t("notifications.feedbackReply");
  }
}

function getNotificationHref(n: AppNotification): string | null {
  if (n.type === "new_follower") {
    return n.actor?.username ? `/u/${n.actor.username}` : null;
  }
  if (n.type === "feedback_reply") {
    return "/profile/settings/feedback";
  }
  if (n.mediaType && n.mediaId != null) {
    return `/${n.mediaType === "movie" ? "movies" : "series"}/${n.mediaId}`;
  }
  return null;
}

export function NotificationsView() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { t, locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });
  const hasUnread = (notifications ?? []).some((n) => !n.readAt);

  return (
    <div className="relative w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      {/*
        * CORREÇÃO (a pedido, 2026-09-15/16 — "as cores de fundo devem
        * ser as mesmas do restante do app, que é azul") — esta tela
        * nasceu sem campo de manchas nenhum (fundo chapado). Mesmo
        * campo de `MyCommentsPageView.tsx`/`ListsPageView.tsx` (sub-
        * telas "voltar + título" iguais a esta) — ver o comentário lá
        * pra origem dos valores.
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "320px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "620px", left: "-18%", background: "#0D3B5C" }} />
      </div>

      <div className="relative mb-2 flex items-center justify-between">
        <SectionPageHeader title={t("profile.notifications")} />
        {hasUnread && (
          <button type="button" onClick={() => markAllRead.mutate()} className="text-xs font-semibold text-primary">
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      <div className="relative">
      {isLoading && (
        <div className="space-y-2.5" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {!isLoading && notifications && notifications.length === 0 && <EmptyState message={t("notifications.empty")} />}

      {!isLoading && notifications && notifications.length > 0 && (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const href = getNotificationHref(n);
            const message = getNotificationMessage(n, t);
            const content = (
              <>
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-background">
                  {n.actor ? (
                    <Avatar src={n.actor.avatarUrl} name={n.actor.displayName ?? n.actor.username} className="h-full w-full" />
                  ) : n.mediaPosterPath ? (
                    <Image src={tmdbImage(n.mediaPosterPath, "w185") ?? ""} alt="" fill sizes="44px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary">
                      <Bell className="h-4 w-4" strokeWidth={2} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-sm text-text">{message}</p>
                  <p className="mt-0.5 text-xs text-muted">{dateFormatter.format(new Date(n.createdAt))}</p>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
              </>
            );

            const rowClassName = "flex items-center gap-3 rounded-2xl border p-2.5 backdrop-blur-[18px] backdrop-saturate-[180%]";
            const rowStyle = {
              borderColor: n.readAt ? "rgba(255,255,255,0.10)" : "rgba(240,169,79,0.35)",
              background: n.readAt
                ? "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.07)"
                : "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.15), transparent 60%), rgba(240,169,79,0.08)",
            };

            return href ? (
              <Link
                key={n.id}
                href={href}
                onClick={() => !n.readAt && markRead.mutate(n.id)}
                className={rowClassName}
                style={rowStyle}
              >
                {content}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.readAt && markRead.mutate(n.id)}
                className={`${rowClassName} w-full text-left`}
                style={rowStyle}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
