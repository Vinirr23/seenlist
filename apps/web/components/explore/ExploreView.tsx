"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { ExploreTabs, type ExploreTab } from "./ExploreTabs";
import { ExploreDiscoverTab } from "./ExploreDiscoverTab";
import { ExploreActivityTab } from "./ExploreActivityTab";

/**
 * TASK-058 — reaproveita SearchBar/SearchResults inteiros (já
 * existiam). Enquanto há termo de busca, mostra os resultados no
 * lugar das abas — mesmo comportamento de sempre, só que agora as
 * abas aparecem quando a busca está vazia, em vez da tela ficar em
 * branco.
 *
 * TASK-072 — "Feed" saiu daqui (virou aba própria na navegação
 * inferior, ver `components/feed/FeedView.tsx`) — Explorar agora só
 * tem Descobrir/Atividade.
 */
export function ExploreView() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("discover");

  return (
    <div className="w-full pb-32 md:mx-auto md:max-w-[430px]">
      <div className="px-4 pt-4">
        <SearchBar onDebouncedChange={setQuery} />
      </div>

      {query ? (
        <div className="px-4 pt-4">
          <SearchResults query={query} />
        </div>
      ) : (
        <>
          <div className="px-4 pt-3">
            <ExploreTabs active={tab} onChange={setTab} />
          </div>
          {tab === "discover" && <ExploreDiscoverTab />}
          {tab === "activity" && <ExploreActivityTab />}
        </>
      )}
    </div>
  );
}
