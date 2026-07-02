import type { MovieDetails } from "@seenlist/types";
import { MetaRow } from "../media/MetaRow";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "Inglês",
  pt: "Português",
  es: "Espanhol",
  fr: "Francês",
  ja: "Japonês",
  ko: "Coreano",
  de: "Alemão",
  it: "Italiano",
  zh: "Mandarim",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function MovieInfo({ movie }: { movie: MovieDetails }) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-text">{movie.overview || "Sem sinopse disponível."}</p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <MetaRow label="Diretor" value={movie.director ?? "—"} />
        <MetaRow label="Estúdios" value={movie.studios.join(", ") || "—"} />
        <MetaRow label="País" value={movie.country ?? "—"} />
        <MetaRow
          label="Idioma"
          value={movie.language ? (LANGUAGE_NAMES[movie.language] ?? movie.language) : "—"}
        />
        {movie.budget !== null && (
          <MetaRow label="Orçamento" value={currencyFormatter.format(movie.budget)} />
        )}
        {movie.revenue !== null && (
          <MetaRow label="Bilheteria" value={currencyFormatter.format(movie.revenue)} />
        )}
      </dl>
    </div>
  );
}
