"use client";

import { LogOut } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
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
 */
export function ProfileView() {
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando perfil">
        <div className="h-16 animate-pulse rounded-full bg-surface" />
        <div className="h-24 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted">Não foi possível carregar seu perfil agora. Tente de novo em instantes.</p>
    );
  }

  if (!user) {
    return <p className="text-sm text-muted">Não encontramos os dados da sua conta. Tente entrar de novo.</p>;
  }

  return (
    <div>
      <ProfileHeader user={user} />
      <StatisticsCard />

      <ProfileSectionsList />

      <SettingsSection />

      <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10">
        <LogOut className="h-4 w-4" strokeWidth={2} />
        Sair
      </LogoutButton>
    </div>
  );
}
