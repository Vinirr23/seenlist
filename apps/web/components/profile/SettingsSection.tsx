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
      {/* "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — "glass-row". Achado ao investigar Configurações (2026-08-25): esta linha, que leva pra lá, ainda estava com o fundo opaco antigo mesmo com o Perfil já "concluído" — corrigido junto. */}
      <Link
        href="/profile/settings"
        className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-text backdrop-blur-[18px] backdrop-saturate-[180%] transition-colors hover:border-primary/40"
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
        }}
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
