"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ToastProvider } from "@/lib/toast/ToastProvider";
import { BottomNavVisibilityProvider } from "@/lib/layout/bottomNavVisibility";

export function Providers({ children }: { children: ReactNode }) {
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
      <ThemeProvider>
        <LocaleProvider>
          <ToastProvider>
            <BottomNavVisibilityProvider>{children}</BottomNavVisibilityProvider>
          </ToastProvider>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
