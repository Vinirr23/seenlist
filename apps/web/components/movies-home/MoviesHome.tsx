"use client";

import { useState } from "react";
import { HomeTabs, type HomeTab } from "../media/HomeTabs";
import { MinhaListaSection } from "./MinhaListaSection";
import { EmBreveSection } from "./EmBreveSection";

/**
 * TASK-020: mesma estrutura de `series-home/SeriesHome.tsx` — reusa
 * `HomeTabs` (o mesmo componente, já generalizado). "Minha Lista" é
 * o fluxo completo de filmes pedido nesta tarefa; "Em breve" fica
 * como placeholder, conforme pedido explicitamente no item 1.
 */
export function MoviesHome() {
  const [tab, setTab] = useState<HomeTab>("minha-lista");

  return (
    <div className="w-full px-2 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <h1 className="mb-3 px-1 text-2xl font-bold text-text">Filmes</h1>
      <HomeTabs active={tab} onChange={setTab} />
      {tab === "minha-lista" ? <MinhaListaSection /> : <EmBreveSection />}
    </div>
  );
}
