"use client";

import { LogOut } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { ProfileHeader } from "./ProfileHeader";
import { StatisticsCard } from "./StatisticsCard";
import { SettingsSection } from "./SettingsSection";
import { ProfileSectionsList } from "./ProfileSectionsList";

/**
 * Item 8: loading / empty / error, "nunca deixar a tela vazia" — os
 * três estados abaixo cobrem `useCurrentUser`; `ProfileStatsGrid` já
 * cuida dos seus próprios estados internamente (mesmo padrão usado
 * em toda mutation/query do projeto).
 *
 * Tradução (4º lote) — Perfil.
 */
export function ProfileView() {
  const { data: user, isLoading, isError } = useCurrentUser();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando perfil">
        <div className="h-16 animate-pulse rounded-full bg-surface" />
        <div className="h-24 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-muted">{t("profile.loadError")}</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted">{t("profile.noData")}</p>;
  }

  return (
    <div>
      <ProfileHeader user={user} />
      <StatisticsCard />

      <ProfileSectionsList />

      <SettingsSection />

      <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10">
        <LogOut className="h-4 w-4" strokeWidth={2} />
        {t("settings.logout")}
      </LogoutButton>
    </div>
  );
}
