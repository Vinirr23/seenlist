import { useQuery } from "@tanstack/react-query";
import type { AnimeCharacter } from "@/lib/anime/jikan";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface UseAnimeCharactersResult {
  characters: AnimeCharacter[];
  /** TASK-168 (plano B) — `true` quando a busca no MyAnimeList falhou de verdade (instabilidade externa), não quando só não achou nada (série não é anime, por exemplo). Quem chama usa isso pra decidir entre esconder a opção de personagem e cair pro elenco do TMDB. */
  searchFailed: boolean;
}

/**
 * TASK-067 (personagem favorito, versão 2) — `staleTime`/`gcTime`
 * bem longos: personagem de anime não muda, e cada busca aqui já
 * passa pelo cache de 30 dias da própria rota (`route.ts`, via
 * `fetch(..., { next: { revalidate } })`) — o React Query só evita
 * repetir a MESMA chamada de rede várias vezes na mesma sessão.
 *
 * TASK-168 (correção 5) — quando a busca falha de verdade
 * (`searchFailed: true`), NÃO fica em cache — próxima montagem tenta
 * de novo (diferente de "não é anime", que fica em cache normal,
 * já que essa resposta não muda).
 */
export function useAnimeCharacters(title: string | undefined, year: number | null) {
  return useQuery({
    queryKey: ["anime-characters", title, year],
    queryFn: async (): Promise<UseAnimeCharactersResult> => {
      const params = new URLSearchParams({ title: title as string });
      if (year) params.set("year", String(year));

      const response = await fetch(`/api/anime/characters?${params.toString()}`);
      if (!response.ok) return { characters: [], searchFailed: true };

      const data = (await response.json()) as { characters?: AnimeCharacter[]; searchFailed?: boolean };
      return { characters: data.characters ?? [], searchFailed: data.searchFailed ?? false };
    },
    enabled: Boolean(title),
    staleTime: (query) => (query.state.data?.searchFailed ? 0 : THIRTY_DAYS_MS),
    gcTime: THIRTY_DAYS_MS,
  });
}
