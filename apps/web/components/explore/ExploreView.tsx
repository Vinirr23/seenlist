"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { ExploreTabs, type ExploreTab } from "./ExploreTabs";
import { ExploreFeedTab } from "./ExploreFeedTab";
import { ExploreDiscoverTab } from "./ExploreDiscoverTab";
import { ExploreActivityTab } from "./ExploreActivityTab";

/**
 * TASK-058 — reaproveita SearchBar/SearchResults inteiros (já
 * existiam). Enquanto há termo de busca, mostra os resultados no
 * lugar das abas — mesmo comportamento de sempre, só que agora as
 * abas aparecem quando a busca está vazia, em vez da tela ficar em
 * branco.
 */
export function ExploreView() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("feed");

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
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
          {tab === "feed" && <ExploreFeedTab />}
          {tab === "discover" && <ExploreDiscoverTab />}
          {tab === "activity" && <ExploreActivityTab />}
        </>
      )}
    </div>
  );
}
