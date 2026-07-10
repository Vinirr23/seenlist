"use client";

import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * Ajuste (Configurações): virou um link de verdade pra
 * `/profile/settings` — a tela completa (Conta, Preferências,
 * Aplicativo, excluir conta, sair). Antes era uma lista de 5 itens
 * decorativos, sem `onClick` nenhum.
 */
export function SettingsSection() {
  const { t } = useTranslation();

  return (
    <section className="mb-6">
      <Link
        href="/profile/settings"
        className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3.5 text-sm font-medium text-text transition-colors hover:border-primary/50"
      >
        <span className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted" strokeWidth={2} />
          {t("settings.title")}
        </span>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
      </Link>
    </section>
  );
}
