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
    <div className="relative w-full px-2 pb-32 pt-4 md:mx-auto md:max-w-[430px]">
      {/*
        * "Vidro" (mesmo padrão do Perfil/Explorar/SeriesHome.tsx) —
        * campo de manchas desfocadas atrás do conteúdo. Ver
        * SeriesHome.tsx/ProfileView.tsx pro histórico completo.
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "280px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "520px", left: "-18%", background: "#0D3B5C" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "740px", right: "-18%", background: "#2A7FB8" }} />
        <div className="absolute h-48 w-48 rounded-full opacity-24 blur-[60px]" style={{ top: "950px", left: "-16%", background: "#0D3B5C" }} />
      </div>

      <div className="relative">
        <HomeTabs active={tab} onChange={setTab} />
        {tab === "minha-lista" ? <MinhaListaSection /> : <EmBreveSection />}
      </div>
    </div>
  );
}
