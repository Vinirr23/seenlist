"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { ExploreTabs, type ExploreTab } from "./ExploreTabs";
import { ExploreMoviesTab } from "./ExploreMoviesTab";
import { ExploreSeriesTab } from "./ExploreSeriesTab";
import { ExploreActivityTab } from "./ExploreActivityTab";

/**
 * TASK-058 — reaproveita SearchBar/SearchResults inteiros (já
 * existiam). Enquanto há termo de busca, mostra os resultados no
 * lugar das abas — mesmo comportamento de sempre, só que agora as
 * abas aparecem quando a busca está vazia, em vez da tela ficar em
 * branco.
 *
 * TASK-072 — "Feed" saiu daqui (virou aba própria na navegação
 * inferior, ver `components/feed/FeedView.tsx`).
 *
 * Reformulação da aba Explorar (2026-08-21, especificação completa
 * salva em `SEENLIST-EXPLORAR-REFORMULACAO-2026-08-21.md` no
 * projeto) — a antiga aba única "Descobrir" (misturava séries e
 * filmes) virou 2 abas dedicadas: Filmes | Séries | Atividade
 * (`ExploreDiscoverTab.tsx` não é mais usado por este arquivo — ver
 * `ExploreMoviesTab.tsx`/`ExploreSeriesTab.tsx`).
 *
 * CORREÇÃO (causa raiz de um bug real, reportado — o botão "Explorar
 * séries" do estado vazio de Séries/Home abria a Explorar sempre na
 * aba Filmes) — a aba inicial vinha só de `useState("movies")`,
 * fixa, sem nenhuma leitura da URL. Todo botão "Explorar séries"
 * espalhado pelo app (Minha Lista, Em breve, Pausadas, Assistir
 * depois, Concluídas — ver `series-home/*.tsx`) linkava pra
 * "/explore" pura, então caía sempre em Filmes por ser a aba padrão,
 * não importa de onde a pessoa veio — mesmo bug em 5 lugares
 * diferentes, mesma causa. Agora `?tab=series`/`?tab=movies`/
 * `?tab=activity` na URL escolhe a aba inicial (lida 1x, no mount —
 * trocar de aba depois continua só estado local, sem reescrever a
 * URL, mesmo comportamento de sempre). `useSearchParams` exige um
 * `<Suspense>` no App Router (mesmo padrão já usado em
 * `app/(auth)/login/page.tsx`) — por isso o conteúdo de verdade
 * ficou em `ExploreViewContent`, e `ExploreView` só embrulha isso
 * num Suspense.
 */
const EXPLORE_TABS: ExploreTab[] = ["movies", "series", "activity"];

function ExploreViewContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: ExploreTab = EXPLORE_TABS.includes(requestedTab as ExploreTab)
    ? (requestedTab as ExploreTab)
    : "movies";

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>(initialTab);

  return (
    <div className="relative w-full pb-32 md:mx-auto md:max-w-[430px]">
      {/*
       * "Vidro" (a pedido — "aplicar o mesmo efeito de vidro do
       * Perfil") — mesmo campo de manchas azuis desfocadas atrás do
       * conteúdo (ver ProfileView.tsx pra todo o histórico de causa
       * raiz: sem z-index negativo nenhum, ordem de DOM só — pintado
       * primeiro aqui, fica atrás dos irmãos seguintes). Ajustado
       * (reformulação da Explorar) — cada aba agora tem só 3
       * carrosséis (era 6 misturados antes), altura bem menor; ainda é
       * um PRIMEIRO PALPITE, não tem medição ao vivo pra esta tela.
       *
       * Fundo estático (2026-09-02, "implementa isso nas outras
       * abas" — mesmo pedido já aplicado e confirmado funcionando,
       * celular e desktop, em `SeriesHome.tsx`) — `position: sticky`
       * num wrapper de `h-screen` cancelado por `-mb-[100vh]`, no
       * lugar do antigo `absolute inset-0` que rolava junto com o
       * conteúdo. Ver comentário completo (motivo de não usar `fixed`,
       * por quê sem z-index) em `SeriesHome.tsx`. Só a técnica de
       * posicionamento mudou aqui — as manchas em si (cor, tamanho,
       * posição) continuam exatamente as mesmas de antes.
       */}
      <div className="pointer-events-none sticky top-0 h-screen -mb-[100vh]" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "280px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "520px", left: "-18%", background: "#0D3B5C" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "740px", right: "-18%", background: "#2A7FB8" }} />
        <div className="absolute h-48 w-48 rounded-full opacity-24 blur-[60px]" style={{ top: "950px", left: "-16%", background: "#0D3B5C" }} />
      </div>

      <div className="relative px-4 pt-4">
        <SearchBar onDebouncedChange={setQuery} />
      </div>

      {query ? (
        <div className="relative px-4 pt-4">
          <SearchResults query={query} />
        </div>
      ) : (
        <div className="relative">
          <div className="px-4 pt-3">
            <ExploreTabs active={tab} onChange={setTab} />
          </div>
          {tab === "movies" && <ExploreMoviesTab />}
          {tab === "series" && <ExploreSeriesTab />}
          {tab === "activity" && <ExploreActivityTab />}
        </div>
      )}
    </div>
  );
}

export function ExploreView() {
  return (
    <Suspense fallback={null}>
      <ExploreViewContent />
    </Suspense>
  );
}
