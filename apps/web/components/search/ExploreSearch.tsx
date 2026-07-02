"use client";

import { useState } from "react";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";

export function ExploreSearch() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <SearchBar onDebouncedChange={setQuery} />
      <SearchResults query={query} />
    </div>
  );
}
