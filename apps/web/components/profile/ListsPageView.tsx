"use client";

import { SectionPageHeader } from "./SectionPageHeader";
import { ListsView } from "./ListsView";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function ListsPageView() {
  const { t } = useTranslation();
  return (
    <div className="relative w-full pb-24 md:mx-auto md:max-w-[430px]">
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Listas) — mesmo campo de manchas desfocadas de fundo do resto do app (Perfil/Explorar/Comentários). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "320px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "620px", left: "-18%", background: "#0D3B5C" }} />
      </div>

      <div className="relative px-4 pt-4">
        <SectionPageHeader title={t("profile.section.lists")} />
        <ListsView />
      </div>
    </div>
  );
}
