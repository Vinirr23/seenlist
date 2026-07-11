"use client";

import { useState } from "react";
import { HomeTabs, type HomeTab } from "../media/HomeTabs";
import { MinhaListaSection } from "./MinhaListaSection";
import { EmBreveSection } from "./EmBreveSection";

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

  return (
    <div className="w-full px-2 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <HomeTabs active={tab} onChange={setTab} />
      {tab === "minha-lista" ? <MinhaListaSection /> : <EmBreveSection />}
    </div>
  );
}
