import { useQuery } from "@tanstack/react-query";
import type { AnimeCharacter } from "@/lib/anime/jikan";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * TASK-067 (personagem favorito, versão 2) — `staleTime`/`gcTime`
 * bem longos: personagem de anime não muda, e cada busca aqui já
 * passa pelo cache de 30 dias da própria rota (`route.ts`, via
 * `fetch(..., { next: { revalidate } })`) — o React Query só evita
 * repetir a MESMA chamada de rede várias vezes na mesma sessão.
 */
export function useAnimeCharacters(title: string | undefined, year: number | null) {
  return useQuery({
    queryKey: ["anime-characters", title, year],
    queryFn: async (): Promise<AnimeCharacter[]> => {
      const params = new URLSearchParams({ title: title as string });
      if (year) params.set("year", String(year));

      const response = await fetch(`/api/anime/characters?${params.toString()}`);
      if (!response.ok) return [];

      const data = (await response.json()) as { characters?: AnimeCharacter[] };
      return data.characters ?? [];
    },
    enabled: Boolean(title),
    staleTime: THIRTY_DAYS_MS,
    gcTime: THIRTY_DAYS_MS,
  });
}
