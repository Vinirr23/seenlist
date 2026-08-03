import { Star } from "lucide-react";
import type { ReviewAggregate } from "@/lib/queries/social/reviews";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — refinamento da aba Sobre (série), item 9: "antes do
 * formulário atual, mostrar um resumo da opinião da comunidade" —
 * nota média grande + barra de distribuição por estrela (5→1), tipo
 * Letterboxd. Some sozinho quando ninguém avaliou ainda (`count`
 * zero) — sem card vazio sem sentido.
 */
export function ReviewSummary({ aggregate }: { aggregate: ReviewAggregate }) {
  const { t } = useTranslation();
  if (aggregate.count === 0 || aggregate.average == null) return null;

  const maxCount = Math.max(1, ...aggregate.distribution.map((d) => d.count));

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="shrink-0 text-center">
        <p className="text-3xl font-extrabold text-primary">{aggregate.average.toFixed(1)}</p>
        <p className="mt-0.5 text-[11px] text-muted">{t("reviews.ratingsCount", { count: aggregate.count })}</p>
      </div>
      <div className="flex-1 space-y-1">
        {aggregate.distribution.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-1.5">
            <span className="flex w-6 shrink-0 items-center gap-0.5 text-[10px] text-muted">
              {star}
              <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
