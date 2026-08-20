"use client";

import { useEffect, useState } from "react";
import { HomeTabs, type HomeTab } from "../media/HomeTabs";
import { MinhaListaSection } from "./MinhaListaSection";
import { EmBreveSection } from "./EmBreveSection";
import { WebPushPrompt } from "../push/WebPushPrompt";
import { mark } from "@/lib/perfMarks";

/**
 * TASK-019: a aba Séries virou a "central de acompanhamento" —
 * título + duas sub-abas internas (Minha Lista / Em breve), igual à
 * referência real do TV Time. Nenhum dado mock, nenhuma tabela nova;
 * "Minha Lista" é o antigo conteúdo de /library (só séries) movido
 * pra cá, "Em breve" é novo (busca o próximo episódio de cada série
 * acompanhada no TMDB).
 */
export function SeriesHome() {
  const [tab, setTab] = useState<HomeTab>("minha-lista");

  /**
   * TEMPORÁRIO (auditoria de performance) — equivalente exato do
   * `mark("series_home_render")` do mobile (`app/(tabs)/series/index.tsx`),
   * aqui na Home real de Séries (`/series`), não mais em `/library`
   * (rota legada, sem uso — ver `LibraryView.tsx`). `useEffect` em vez
   * de marca direta no corpo do componente porque este é um componente
   * "use client": o corpo roda uma vez no servidor antes de hidratar,
   * e `mark()` só faz sentido pro tempo do NAVEGADOR da pessoa.
   */
  useEffect(() => {
    mark("series_home_render");
  }, []);

  return (
    <div className="w-full px-2 pb-32 pt-4 md:mx-auto md:max-w-[430px]">
      {/*
        * A PEDIDO — convite de aviso de episódio fica AQUI, na Home de
        * Séries, e não numa tela de configuração: é onde a pessoa
        * acabou de demonstrar que acompanha série, que é exatamente o
        * contexto em que o aviso faz sentido. Oferecer isso perdido
        * nas Configurações teria uma fração da conversão.
        */}
      <WebPushPrompt />
      <HomeTabs active={tab} onChange={setTab} />
      {tab === "minha-lista" ? <MinhaListaSection /> : <EmBreveSection />}
    </div>
  );
}
