"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { PasswordRow } from "./PasswordRow";
import { AccountInfoRows } from "./AccountInfoRows";
import { PrivacySection } from "./PrivacyRow";
import { PendingTvTimeImportsRow } from "./PendingTvTimeImportsRow";
import { LanguageRow } from "./LanguageRow";
import { ThemeRow } from "./ThemeRow";
import { SettingsRow } from "./SettingsRow";
import { DeleteAccountRow } from "./DeleteAccountRow";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="rounded-lg border border-border bg-surface">{children}</div>
    </section>
  );
}

/**
 * TASK-026A — Nome, Foto e Email saíram daqui de vez; moraram na
 * tela dedicada `/profile/edit` agora (acessada pelo botão "Editar"
 * no topo do Perfil, não mais por aqui). Estrutura atual: Preferências
 * (Idioma/Tema) → Conta (Alterar senha) → Aplicativo
 * (Sobre/Política/Termos) → Conta (Excluir/Sair) — exatamente o item 4.
 */
export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full px-4 pb-32 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/profile"
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t("settings.title")}</h1>
      </div>

      <Section title={t("settings.section.preferences")}>
        <LanguageRow />
        <ThemeRow />
        <SettingsRow label="Notificações" href="/profile/settings/notifications" last />
      </Section>

      <Section title={t("settings.section.account")}>
        <AccountInfoRows />
        <PasswordRow last />
      </Section>

      <Section title="Privacidade">
        <PrivacySection />
      </Section>

      <Section title={t("settings.section.app")}>
        <SettingsRow label="Enviar feedback" href="/profile/settings/feedback" />
        <PendingTvTimeImportsRow />
        <SettingsRow label="Migrar do TV Time" href="/import/tvtime" />
        <SettingsRow label="Importar do Trakt" href="/import/trakt" />
        <SettingsRow label="Corrigir status das séries" href="/profile/settings/repair-series" />
        <SettingsRow label={t("settings.about")} href="/profile/settings/about" />
        <SettingsRow label={t("settings.privacy")} href="/profile/settings/privacy" />
        <SettingsRow label={t("settings.terms")} href="/profile/settings/terms" last />
      </Section>

      <Section title={t("settings.section.dangerZone")}>
        <DeleteAccountRow />
      </Section>

      <LogoutButton className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10">
        <LogOut className="h-4 w-4" strokeWidth={2} />
        {t("settings.logout")}
      </LogoutButton>
    </div>
  );
}
