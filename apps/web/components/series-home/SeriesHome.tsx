"use client";

import { useEffect, useRef, useState } from "react";
import { HomeTabs, type HomeTab } from "../media/HomeTabs";
import { MinhaListaSection } from "./MinhaListaSection";
import { EmBreveSection } from "./EmBreveSection";
import { WebPushPrompt } from "../push/WebPushPrompt";
import { markElapsed } from "@/lib/perfMarks";

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
   * e `mark()`/`markElapsed()` só fazem sentido pro tempo do NAVEGADOR
   * da pessoa.
   *
   * CORREÇÃO (bug real, achado com dado de teste real em celular) —
   * `SeriesHome` desmonta e remonta de verdade toda vez que a pessoa
   * sai pra outra aba principal do app (Perfil, Explorar etc.) e volta
   * pra Séries — confirmado comparando com `providers_mounted` (que só
   * dispara uma vez, porque mora na raiz do app e não remonta com
   * navegação interna): numa rodada de teste real, `providers_mounted`
   * apareceu 1x mas `series_home_render` apareceu 2x, ~93s de
   * diferença. Usar `mark()` puro (relativo ao início da navegação)
   * fazia a revisita parecer ter "demorado 93 segundos", quando na
   * verdade só fazia 93s desde que a página tinha carregado
   * originalmente — nada a ver com a velocidade real da revisita.
   * `mountStartRef` grava o instante em que ESTA montagem específica
   * começou, e `markElapsed()` mede a partir daí — funciona certo
   * tanto na 1ª carga real quanto em qualquer remontagem depois.
   */
  const mountStartRef = useRef<number | null>(null);
  if (typeof window !== "undefined" && mountStartRef.current === null) {
    mountStartRef.current = performance.now();
  }

  useEffect(() => {
    if (mountStartRef.current !== null) {
      markElapsed("series_home_render", mountStartRef.current);
    }
  }, []);

  return (
    <div className="relative w-full px-2 pb-32 pt-4 md:mx-auto md:max-w-[430px]">
      {/*
        * "Vidro" (mesmo padrão do Perfil/Explorar) — campo de manchas
        * desfocadas atrás do conteúdo. Pintado primeiro, sem z-index
        * negativo nenhum — ordem de DOM só, fica atrás dos irmãos
        * seguintes (ver ProfileView.tsx pro histórico completo de causa
        * raiz).
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "280px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "520px", left: "-18%", background: "#0D3B5C" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "740px", right: "-18%", background: "#2A7FB8" }} />
        <div className="absolute h-48 w-48 rounded-full opacity-24 blur-[60px]" style={{ top: "950px", left: "-16%", background: "#0D3B5C" }} />
      </div>

      <div className="relative">
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
    </div>
  );
}
