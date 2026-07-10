"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useNotificationPreferences, useUpdateNotificationPreference, type NotificationPreferences } from "@/lib/queries/notification-preferences";
import { ToggleRow } from "./ToggleRow";

const ITEMS: { field: keyof NotificationPreferences; label: string }[] = [
  { field: "episodeNew", label: "Novo episódio" },
  { field: "seasonPremiere", label: "Nova temporada" },
  { field: "commentReply", label: "Respostas aos meus comentários" },
  { field: "commentLike", label: "Curtidas em comentários" },
  { field: "reviewLike", label: "Curtidas em reviews" },
];

/**
 * TASK-052 — os 5 tipos, exatamente como pedido, um switch cada.
 * Reaproveita useNotificationPreferences/useUpdateNotificationPreference
 * (só leitura/escrita, sem lógica de notificação aqui — isso mora nas
 * Edge Functions e nos triggers).
 */
export function NotificationPreferencesView() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/profile/settings"
          aria-label="Voltar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">Notificações</h1>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          {ITEMS.map((item, index) => (
            <ToggleRow
              key={item.field}
              label={item.label}
              checked={preferences?.[item.field] ?? true}
              disabled={updatePreference.isPending}
              onChange={(value) => updatePreference.mutate({ field: item.field, value })}
              last={index === ITEMS.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
