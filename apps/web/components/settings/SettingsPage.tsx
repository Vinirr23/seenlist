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
import { SettingsRow } from "./SettingsRow";
import { DeleteAccountRow } from "./DeleteAccountRow";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {/* "Vidro" (mesmo padrão dos chips neutros do Explorar) */}
      <div
        className="rounded-lg border border-white/10 backdrop-blur-[10px] backdrop-saturate-[160%]"
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * TASK-026A — Nome, Foto e Email saíram daqui de vez; moraram na
 * tela dedicada `/profile/edit` agora (acessada pelo botão "Editar"
 * no topo do Perfil, não mais por aqui).
 *
 * Redesign (2026-08-25) — a partir de uma sugestão trazida pelo
 * usuário (originada de outra IA), revisada e ajustada: a tela tinha
 * duas seções tituladas "Conta" (uma no topo com Email/UID/Senha,
 * outra embaixo — antes rotulada `settings.section.dangerZone`, mas
 * cujo texto traduzido era literalmente "Conta" de novo — só
 * confirmado lendo o valor real da tradução, não o nome da chave).
 * Isso foi corrigido removendo a segunda seção. "Aplicativo" também
 * virou dois grupos mais claros: "Dados e Ferramentas" (importar/
 * corrigir) e "Sobre" (feedback/sobre/política/termos). "Excluir
 * conta" saiu de dentro de uma caixa e virou um texto vermelho
 * discreto, sozinho, com espaço extra abaixo do botão "Sair" — não
 * deve competir visualmente com o resto da tela. Visual (vidro/blur/
 * gradiente) mantido igual ao resto do app, por decisão explícita do
 * usuário — só a organização e o espaçamento mudaram. Estrutura
 * atual: Preferências → Conta → Privacidade → Dados e Ferramentas →
 * Sobre → Sair → Excluir conta (isolado).
 */
export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="relative w-full md:mx-auto md:max-w-[430px]">
      {/*
        * "Vidro" (mesmo padrão do Perfil/Explorar/Biblioteca/Detalhes) —
        * campo de manchas desfocadas atrás do conteúdo.
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "120px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "440px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "760px", left: "-18%", background: "#0D3B5C" }} />
        <div className="absolute h-48 w-48 rounded-full opacity-24 blur-[60px]" style={{ top: "1040px", right: "-16%", background: "#0D3B5C" }} />
      </div>

      <div className="relative px-4 pb-32 pt-4">
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

      {/* A PEDIDO (2026-08-27 — "tira a opção de cor de web e mobile") — a linha "Tema" (ThemeRow) saiu daqui; ver comentário completo em `app/providers.tsx`. */}
      <Section title={t("settings.section.preferences")}>
        <LanguageRow />
        <SettingsRow label={t("settings.notifications")} href="/profile/settings/notifications" last />
      </Section>

      <Section title={t("settings.section.account")}>
        <AccountInfoRows />
        <PasswordRow last />
      </Section>

      <Section title="Privacidade">
        <PrivacySection />
      </Section>

      <Section title={t("settings.section.dataTools")}>
        <PendingTvTimeImportsRow />
        <SettingsRow label="Migrar do TV Time" href="/import/tvtime" />
        <SettingsRow label="Importar do Trakt" href="/import/trakt" />
        <SettingsRow label={t("settings.repairSeriesStatus")} href="/profile/settings/repair-series" />
        <SettingsRow label={t("settings.backfillEpisodeIds")} href="/profile/settings/backfill-episode-ids" last />
      </Section>

      <Section title={t("settings.section.about")}>
        <SettingsRow label={t("settings.sendFeedback")} href="/profile/settings/feedback" />
        <SettingsRow label={t("settings.about")} href="/profile/settings/about" />
        <SettingsRow label={t("settings.privacy")} href="/profile/settings/privacy" />
        <SettingsRow label={t("settings.terms")} href="/profile/settings/terms" last />
      </Section>

      {/* "Vidro" (mesmo padrão dos chips neutros do Explorar) */}
      <LogoutButton
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-danger backdrop-blur-[10px] backdrop-saturate-[160%] transition-colors hover:bg-danger/10"
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
        }}
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        {t("settings.logout")}
      </LogoutButton>

      {/* Isolado de propósito — não deve competir visualmente com o resto (ver comentário no topo do arquivo). */}
      <div className="mt-8 flex justify-center">
        <DeleteAccountRow bare />
      </div>
      </div>
    </div>
  );
}
