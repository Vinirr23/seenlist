"use client";

import { EmptyShelf } from "../media/EmptyShelf";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * UNIFICAÇÃO (achado real, auditoria de UX) — usava o `EmptyState`
 * genérico (só texto, sem botão) enquanto o mesmo tipo de vazio
 * ("nenhum título nesta lista ainda") na Central de Séries/Filmes já
 * tinha um card com botão "Explorar". Resultado: a Biblioteca — o
 * lugar onde um usuário novo mais precisa de um empurrão pra
 * adicionar o primeiro título — era a versão MENOS útil desse
 * estado. Agora usa `EmptyShelf`, com CTA opcional.
 */
export function EmptyLibrary({ message, actionLabel, actionHref }: { message?: string; actionLabel?: string; actionHref?: string }) {
  const { t } = useTranslation();
  return <EmptyShelf message={message ?? t("library.emptyDefault")} actionLabel={actionLabel} actionHref={actionHref} />;
}
