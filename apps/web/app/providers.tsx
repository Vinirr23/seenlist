"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { ToastProvider } from "@/lib/toast/ToastProvider";
import { BottomNavVisibilityProvider } from "@/lib/layout/bottomNavVisibility";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { WebVitalsReporter } from "@/components/diagnostics/WebVitalsReporter";
import { mark } from "@/lib/perfMarks";

/**
 * A PEDIDO (2026-08-27 — "vi a cor do app branco, e não gostei, quero
 * que ele tenha apenas a cor padrão. tira a opção de cor de web e
 * mobile") — `<ThemeProvider>` (que ficava aqui) era o mecanismo que
 * deixava o app trocar pra tema claro (opção "Claro"/"Usar tema do
 * dispositivo" nas Configurações — ver histórico completo do que foi
 * removido em `lib/theme/ThemeProvider.tsx` e
 * `components/settings/ThemeRow.tsx`, apagados junto com esta
 * mudança). Removido por completo (não só escondido) — o `<html
 * className="dark">` fixo em `app/layout.tsx` já basta agora, já que
 * nada mais troca essa classe. Importante: isso também vale pra quem
 * JÁ tinha escolhido "Claro"/"Sistema" antes — como o provider (que
 * lia esse valor salvo no localStorage/perfil) não existe mais, essa
 * preferência antiga fica sem efeito nenhum e todo mundo volta a ver
 * só o tema escuro, sem precisar refazer nada.
 */
export function Providers({ children }: { children: ReactNode }) {
  // TEMPORÁRIO — ver lib/perfMarks.ts. Primeiro ponto garantido de
  // execução no NAVEGADOR (useEffect nunca roda no servidor) —
  // equivalente web do `root_layout_render` do mobile.
  useEffect(() => {
    mark("providers_mounted");
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * AUDITORIA — sem isso, o padrão do React Query é
             * `staleTime: 0`: toda consulta do app é considerada
             * desatualizada a qualquer remontagem de componente E a
             * cada vez que a aba volta a ficar em foco
             * (`refetchOnWindowFocus`, ligado por padrão). Combinado
             * com o Feed disparando várias consultas por post
             * (curtida, comentário, salvo), trocar de aba e voltar
             * disparava tudo de novo. 30s é conservador o bastante
             * pra não fazer nada parecer desatualizado, mas evita a
             * rajada de refetch em toda volta de foco. Tabelas com
             * `useRealtimeInvalidate` (Biblioteca) continuam
             * atualizando na hora via Supabase Realtime,
             * independente disso.
             */
            staleTime: 30 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ToastProvider>
          <BottomNavVisibilityProvider>
            <WebVitalsReporter />
            <OfflineBanner />
            {children}
          </BottomNavVisibilityProvider>
        </ToastProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
