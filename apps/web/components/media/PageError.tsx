"use client";

import Link from "next/link";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

export interface PageErrorProps {
  message?: string;
  /** Chamado ao tocar "Tentar de novo" — normalmente o `refetch` do React Query. */
  onRetry?: () => void;
  /** Ação secundária opcional (ex.: "Voltar para a série" no erro de episódio) — mesmo componente, sem duplicar o layout. */
  secondaryAction?: { label: string; href: string };
}

/**
 * UNIFICAÇÃO (achado real, auditoria de UX) — as 3 telas de
 * conteúdo mais visitadas do app (Série, Filme, Episódio) mostravam
 * erro de carregamento como texto solto, sem nenhum jeito de tentar
 * de novo — se o TMDB tivesse um problema passageiro, o único
 * recurso era recarregar a página inteira manualmente, sem nenhuma
 * pista de que isso ajudaria. `useSeriesDetails`/`useMovieDetails`/
 * `useEpisodeDetails` já expõem `refetch()` prontinho — só nunca
 * tinha sido conectado a um botão.
 */
export function PageError({ message, onRetry, secondaryAction }: PageErrorProps) {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  /*
   * CORREÇÃO (a pedido — auditoria de consistência web/mobile, mesmo
   * achado do Bloco 2 no mobile) — toda falha mostrava a mesma
   * mensagem genérica, sem distinguir "você está sem internet" de
   * "nosso servidor/o TMDB falhou". São situações com AÇÕES
   * diferentes: numa, checar o Wi-Fi; na outra, só esperar. O hook
   * já existia (`useOnlineStatus`, usado no `OfflineBanner`) — só
   * nunca tinha sido usado aqui. Estar offline vence a mensagem
   * específica da tela.
   */
  const displayMessage = !isOnline ? t("error.offline") : (message ?? t("error.generic"));

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {isOnline ? (
        <AlertTriangle className="h-8 w-8 text-danger" strokeWidth={1.75} />
      ) : (
        <WifiOff className="h-8 w-8 text-danger" strokeWidth={1.75} />
      )}
      <p className="text-sm text-muted">{displayMessage}</p>
      <div className="flex items-center gap-4">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            {t("error.tryAgain")}
          </button>
        )}
        {secondaryAction && (
          <Link href={secondaryAction.href} className="text-sm font-medium text-primary underline">
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}
