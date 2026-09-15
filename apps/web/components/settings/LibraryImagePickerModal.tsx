"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X, ArrowLeft, Search, ChevronRight, Film, Tv } from "lucide-react";
import type { LibraryItem, MovieDetails, SeriesDetails } from "@seenlist/types";
import { useLibraryItems } from "@/lib/queries/library-state";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

interface PickOption {
  key: string;
  url: string;
}

/**
 * A PEDIDO (2026-09-15 — "em alterar banner, quero que apareça
 * opções de banner de séries e filmes que o usuário já marcou").
 * Porte fiel de `LibraryImagePickerSheet.tsx` (mobile) — mesmo fluxo
 * de 2 passos, mesma decisão (nenhum upload: a URL do TMDB vai direto
 * pra `profiles.banner_url`, ver `useSetBannerFromLibrary`):
 *   1. Lista com busca da biblioteca INTEIRA do usuário
 *      (`useLibraryItems`, sem filtro de status — confirmado: "toda a
 *      biblioteca") — pôster pequeno + título + tipo (ícone +
 *      "Série"/"Filme") + seta, um por linha, campo de busca fixo no
 *      topo, filtro local (sem chamada nova). Mesmo padrão visual do
 *      print de referência que o usuário mandou (a pedido: "quero que
 *      apareça um sheet igual esse aí, com opção pra procurar por
 *      nome, e em lista, tudo igual essa foto"), porte do redesign já
 *      aplicado em `LibraryImagePickerSheet.tsx` (mobile).
 *   2. Detalhes do título escolhido, via as MESMAS rotas
 *      `/api/tmdb/movie|series/[id]` que `useMovieDetails`/
 *      `useSeriesDetails` já usam nas telas de título — nenhuma rota
 *      nova. Galeria de cenas (`gallery`, só série tem — filme só tem
 *      UM backdrop, aplica direto sem grade), em grade (imagens pra
 *      comparar lado a lado).
 *
 * SIMPLIFICADO (a pedido, 2026-09-15, mesma leva — "na escolha de
 * avatar deixa pra a pessoa selecionar do celular como estava antes.
 * ... a mudança do sheet com opções, fica só no banner") — chegou a
 * suportar `mode="avatar"` (elenco do título) também, mas o usuário
 * reverteu o avatar pro seletor de arquivo do navegador puro e
 * simples — removido daqui (fica só banner), mesma simplificação já
 * feita no componente mobile equivalente.
 */
export function LibraryImagePickerModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: items, isLoading } = useLibraryItems();
  const [search, setSearch] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<LibraryItem | null>(null);
  const [options, setOptions] = useState<PickOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!items) return items;
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, search]);

  async function handlePickTitle(item: LibraryItem) {
    setError(null);
    setOptions(null);
    setSelectedTitle(item);
    setLoadingOptions(true);
    try {
      if (item.mediaType === "movie") {
        const details = await fetchMovieDetailsRaw(item.id);
        if (details.backdropPath) {
          onSelect(tmdbImage(details.backdropPath, "w780") as string);
          return;
        }
        setError(t("settings.libraryPickerNoImages"));
        setSelectedTitle(null);
      } else {
        const details = await fetchSeriesDetailsRaw(item.id);
        const paths = details.gallery.length > 0 ? details.gallery : details.backdropPath ? [details.backdropPath] : [];
        if (paths.length === 0) {
          setError(t("settings.libraryPickerNoImages"));
          setSelectedTitle(null);
        } else {
          setOptions(paths.map((path, index) => ({ key: `${path}-${index}`, url: tmdbImage(path, "w780") as string })));
        }
      }
    } catch (err) {
      console.error("[LibraryImagePickerModal] Falha ao buscar detalhes do título", err);
      setError(t("error.generic"));
      setSelectedTitle(null);
    } finally {
      setLoadingOptions(false);
    }
  }

  function handleBack() {
    setSelectedTitle(null);
    setOptions(null);
    setError(null);
  }

  const title = selectedTitle ? t("settings.libraryPickerChooseImage") : t("settings.libraryPickerTitleBanner");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <button
          type="button"
          onClick={selectedTitle ? handleBack : onClose}
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          {selectedTitle ? <ArrowLeft className="h-5 w-5" strokeWidth={2} /> : <X className="h-5 w-5" strokeWidth={2} />}
        </button>
        <h2 className="flex-1 truncate text-center text-lg font-bold text-text">{title}</h2>
        <div className="w-8" />
      </div>

      {!selectedTitle && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("settings.libraryPickerSearchPlaceholder")}
              autoCapitalize="none"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}

        {!selectedTitle &&
          (isLoading ? (
            <p className="mt-8 text-center text-sm text-muted">{t("common.loading")}</p>
          ) : !filteredItems || filteredItems.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted">
              {search.trim() ? t("settings.libraryPickerNoResults") : t("settings.libraryPickerEmpty")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item) => (
                <button
                  key={`${item.mediaType}-${item.id}`}
                  type="button"
                  onClick={() => handlePickTitle(item)}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-surface">
                    {item.posterPath ? (
                      <Image src={tmdbImage(item.posterPath, "w185") ?? ""} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        {item.mediaType === "movie" ? <Film className="h-4 w-4" strokeWidth={2} /> : <Tv className="h-4 w-4" strokeWidth={2} />}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{item.title}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      {item.mediaType === "movie" ? <Film className="h-3 w-3" strokeWidth={2} /> : <Tv className="h-3 w-3" strokeWidth={2} />}
                      <span>{item.mediaType === "movie" ? t("media.movie") : t("media.series")}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
                </button>
              ))}
            </div>
          ))}

        {selectedTitle && loadingOptions && <p className="mt-8 text-center text-sm text-muted">{t("common.loading")}</p>}

        {/*
          * CORREÇÃO (a pedido, 2026-09-16, com print de referência —
          * "o sheet de selecionar banner deve ficar assim como nesses
          * prints") — era uma grade de 2 colunas; a referência mostra
          * uma LISTA de 1 coluna só, cada cena ocupando a largura
          * inteira, rolando verticalmente. Mesmo ajuste já feito em
          * `LibraryImagePickerSheet.tsx` (mobile).
          */}
        {selectedTitle && !loadingOptions && options && (
          <div className="flex flex-col gap-3">
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelect(option.url)}
                className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface"
              >
                <Image src={option.url} alt="" fill sizes="430px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchMovieDetailsRaw(movieId: number): Promise<MovieDetails> {
  const response = await fetch(`/api/tmdb/movie/${movieId}`);
  if (!response.ok) throw new Error("movie details fetch failed");
  return response.json() as Promise<MovieDetails>;
}

async function fetchSeriesDetailsRaw(seriesId: number): Promise<SeriesDetails> {
  const response = await fetch(`/api/tmdb/series/${seriesId}`);
  if (!response.ok) throw new Error("series details fetch failed");
  return response.json() as Promise<SeriesDetails>;
}
