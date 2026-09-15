"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ArrowLeft, Film, Tv } from "lucide-react";
import type { LibraryItem, MovieDetails, SeriesDetails } from "@seenlist/types";
import { useLibraryItems } from "@/lib/queries/library-state";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type Mode = "banner" | "avatar";
interface PickOption {
  key: string;
  url: string;
  label?: string;
}

/**
 * A PEDIDO (2026-09-15 — "em alterar banner, quero que apareça
 * opções de banner de séries e filmes que o usuário já marcou. em
 * alterar foto também quero que apareça opções de selecionar
 * personagens de filmes e séries que o usuário já marcou"). Porte
 * fiel de `LibraryImagePickerSheet.tsx` (mobile) — mesmo fluxo de 2
 * passos, mesma decisão (nenhum upload: a URL do TMDB vai direto pra
 * `profiles.avatar_url`/`banner_url`, ver `useSetAvatarFromLibrary`/
 * `useSetBannerFromLibrary`):
 *   1. Grade da biblioteca INTEIRA do usuário (`useLibraryItems`, sem
 *      filtro de status — confirmado: "toda a biblioteca").
 *   2. Detalhes do título escolhido, via as MESMAS rotas
 *      `/api/tmdb/movie|series/[id]` que `useMovieDetails`/
 *      `useSeriesDetails` já usam nas telas de título — nenhuma rota
 *      nova. `mode="banner"`: galeria de cenas (`gallery`, só série
 *      tem — filme só tem UM backdrop, aplica direto sem grade).
 *      `mode="avatar"`: elenco (`cast`, até 15).
 */
export function LibraryImagePickerModal({ mode, onSelect, onClose }: { mode: Mode; onSelect: (url: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: items, isLoading } = useLibraryItems();
  const [selectedTitle, setSelectedTitle] = useState<LibraryItem | null>(null);
  const [options, setOptions] = useState<PickOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickTitle(item: LibraryItem) {
    setError(null);
    setOptions(null);
    setSelectedTitle(item);
    setLoadingOptions(true);
    try {
      if (mode === "banner") {
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
      } else {
        const details = item.mediaType === "movie" ? await fetchMovieDetailsRaw(item.id) : await fetchSeriesDetailsRaw(item.id);
        const withPhoto = details.cast.filter((member) => member.profilePath);
        if (withPhoto.length === 0) {
          setError(t("settings.libraryPickerNoCharacters"));
          setSelectedTitle(null);
        } else {
          setOptions(
            withPhoto.map((member) => ({
              key: String(member.id),
              url: tmdbImage(member.profilePath, "w342") as string,
              label: member.character || member.name,
            }))
          );
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

  const title = selectedTitle
    ? mode === "banner"
      ? t("settings.libraryPickerChooseImage")
      : t("settings.libraryPickerChooseCharacter")
    : mode === "banner"
      ? t("settings.libraryPickerTitleBanner")
      : t("settings.libraryPickerTitleAvatar");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <button type="button" onClick={selectedTitle ? handleBack : onClose} aria-label={t("common.back")} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text">
          {selectedTitle ? <ArrowLeft className="h-5 w-5" strokeWidth={2} /> : <X className="h-5 w-5" strokeWidth={2} />}
        </button>
        <h2 className="flex-1 truncate text-center text-lg font-bold text-text">{title}</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}

        {!selectedTitle &&
          (isLoading ? (
            <p className="mt-8 text-center text-sm text-muted">{t("common.loading")}</p>
          ) : !items || items.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted">{t("settings.libraryPickerEmpty")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
              {items.map((item) => (
                <button
                  key={`${item.mediaType}-${item.id}`}
                  type="button"
                  onClick={() => handlePickTitle(item)}
                  className="flex flex-col items-center gap-1.5 text-center"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface">
                    {item.posterPath ? (
                      <Image src={tmdbImage(item.posterPath, "w185") ?? ""} alt="" fill sizes="150px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        {item.mediaType === "movie" ? <Film className="h-5 w-5" strokeWidth={2} /> : <Tv className="h-5 w-5" strokeWidth={2} />}
                      </div>
                    )}
                  </div>
                  <p className="w-full truncate text-xs text-muted">{item.title}</p>
                </button>
              ))}
            </div>
          ))}

        {selectedTitle && loadingOptions && <p className="mt-8 text-center text-sm text-muted">{t("common.loading")}</p>}

        {selectedTitle && !loadingOptions && options && mode === "avatar" && (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            {options.map((option) => (
              <button key={option.key} type="button" onClick={() => onSelect(option.url)} className="flex flex-col items-center gap-1.5 text-center">
                <div className="relative aspect-square w-full overflow-hidden rounded-full bg-surface">
                  <Image src={option.url} alt="" fill sizes="150px" className="object-cover" />
                </div>
                {option.label && <p className="w-full truncate text-xs text-muted">{option.label}</p>}
              </button>
            ))}
          </div>
        )}

        {selectedTitle && !loadingOptions && options && mode === "banner" && (
          <div className="grid grid-cols-2 gap-4">
            {options.map((option) => (
              <button key={option.key} type="button" onClick={() => onSelect(option.url)} className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface">
                <Image src={option.url} alt="" fill sizes="300px" className="object-cover" />
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
