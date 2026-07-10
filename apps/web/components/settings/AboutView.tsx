"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ConfirmDialog } from "@/components/series/ConfirmDialog";

/**
 * Versão/build vêm de variáveis de ambiente públicas — não existe
 * banco nem tabela pra isso, e não deveria existir (é metadado de
 * build, não dado de usuário). Sem valor definido em produção ainda,
 * cai num fallback razoável em vez de mostrar "undefined".
 */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "dev";
const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL;

export function AboutView() {
  const { t } = useTranslation();
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/profile/settings"
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t("settings.about")}</h1>
      </div>

      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="text-2xl font-bold tracking-wide text-primary">SeenList</span>

        <div className="mt-2 space-y-1 text-sm text-muted">
          <p>
            {t("about.version")} {APP_VERSION}
          </p>
          <p>
            {t("about.build")} {APP_BUILD}
          </p>
        </div>

        <p className="mt-4 text-xs text-muted">{t("about.developedBy")}</p>
        <p className="text-xs text-muted">{t("about.copyright", { year: new Date().getFullYear() })}</p>

        {WEBSITE_URL ? (
          <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="mt-4 text-sm text-primary underline">
            {t("about.website")}
          </a>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("about.websiteUnavailable")}</p>
        )}

        <button
          type="button"
          onClick={() => setShowChangelog(true)}
          className="mt-6 rounded-lg border border-border px-4 py-2.5 text-sm text-text transition-colors hover:border-primary/50"
        >
          {t("about.whatsNew")}
        </button>
      </div>

      {showChangelog && (
        <ConfirmDialog
          title={`SeenList ${APP_VERSION}`}
          message="Lançamento inicial: busca, biblioteca, progresso de episódios, perfil e configurações."
          onDismiss={() => setShowChangelog(false)}
          actions={[{ label: t("common.back"), variant: "primary", onClick: () => setShowChangelog(false) }]}
        />
      )}
    </div>
  );
}
