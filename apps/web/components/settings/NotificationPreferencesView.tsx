"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useNotificationPreferences, useUpdateNotificationPreference, type NotificationPreferences } from "@/lib/queries/notification-preferences";
import { ToggleRow } from "./ToggleRow";
import { WebPushSettingRow } from "./WebPushSettingRow";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const ITEM_FIELDS: (keyof NotificationPreferences)[] = [
  "episodeNew",
  "seasonPremiere",
  "commentReply",
  "commentLike",
  "reviewLike",
];

const ITEM_LABEL_KEYS: Record<keyof NotificationPreferences, string> = {
  episodeNew: "settings.notif.newEpisode",
  seasonPremiere: "settings.notif.newSeason",
  commentReply: "settings.notif.commentReplies",
  commentLike: "settings.notif.commentLikes",
  reviewLike: "settings.notif.reviewLikes",
};

/**
 * TASK-052 — os 5 tipos, exatamente como pedido, um switch cada.
 * Reaproveita useNotificationPreferences/useUpdateNotificationPreference
 * (só leitura/escrita, sem lógica de notificação aqui — isso mora nas
 * Edge Functions e nos triggers).
 */
export function NotificationPreferencesView() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();
  const { t } = useTranslation();

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/profile/settings"
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t("settings.notifications")}</h1>
      </div>

      {/*
        * A PEDIDO — controle do aviso no navegador. Fica ANTES das
        * preferências por tipo porque é a chave geral: sem permissão
        * do navegador, nenhuma daquelas opções produz notificação
        * nenhuma pra quem usa só o site.
        */}
      <div className="mb-4">
        <WebPushSettingRow />
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      ) : (
        // "Vidro" (mesmo padrão dos chips neutros do Explorar)
        <div
          className="rounded-lg border border-white/10 backdrop-blur-[10px] backdrop-saturate-[160%]"
          style={{
            background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
          }}
        >
          {ITEM_FIELDS.map((field, index) => (
            <ToggleRow
              key={field}
              label={t(ITEM_LABEL_KEYS[field])}
              checked={preferences?.[field] ?? true}
              disabled={updatePreference.isPending}
              onChange={(value) => updatePreference.mutate({ field, value })}
              last={index === ITEM_FIELDS.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
