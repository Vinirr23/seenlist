"use client";

import { useCurrentUser } from "@/lib/queries/current-user";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ProfileHeader } from "./ProfileHeader";
import { StatisticsCard } from "./StatisticsCard";
import { ProfileSectionsList } from "./ProfileSectionsList";

/**
 * Item 8: loading / empty / error, "nunca deixar a tela vazia" — os
 * três estados abaixo cobrem `useCurrentUser`; `ProfileStatsGrid` já
 * cuida dos seus próprios estados internamente (mesmo padrão usado
 * em toda mutation/query do projeto).
 *
 * Tradução (4º lote) — Perfil.
 *
 * Redesign (a pedido) — `SettingsSection` ("Configurações") e
 * `LogoutButton` ("Sair") saíram daqui: viraram redundantes depois
 * que o ícone de engrenagem passou a flutuar sobre a capa
 * (`ProfileHeader.tsx`), levando direto pra `/profile/settings` —
 * que já tem tanto as configurações quanto o botão de sair dentro
 * dela (conferido antes de remover, pra não tirar o único jeito de
 * sair da conta).
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
    </div>
  );
}
