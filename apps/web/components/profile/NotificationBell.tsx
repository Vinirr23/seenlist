"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "@/lib/queries/notifications";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const GLASS_ICON_BTN =
  "relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text shadow-lg shadow-black/25 backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90";
const GLASS_ICON_BTN_STYLE = {
  background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
};

/**
 * A PEDIDO (2026-09-15 — "do lado esquerdo, implementa um botão com
 * um sino de notificações, para toda notificação aparecer nele").
 * Mesmo botão de vidro "sobre imagem" que já existia pro editar/
 * compartilhar/configurações (`GLASS_ICON_BTN`, `ProfileHeader.tsx`),
 * agora do lado esquerdo, com uma bolinha vermelha quando existe
 * notificação não lida (`useUnreadNotificationCount`, `9+` quando
 * passa de 9 — mesmo padrão de contador que apps de mensagem usam).
 */
export function NotificationBell() {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { t } = useTranslation();

  return (
    <Link href="/profile/notifications" aria-label={t("profile.notifications")} className={GLASS_ICON_BTN} style={GLASS_ICON_BTN_STYLE}>
      <Bell className="h-4 w-4" strokeWidth={2} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
