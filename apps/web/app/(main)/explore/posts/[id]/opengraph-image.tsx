import { ImageResponse } from "next/og";
import { fetchPostShareCard } from "@/lib/server/postShareCard";
import { loadGoogleFont } from "@/lib/server/loadGoogleFont";
import { AvatarFallbackOg, BRAND, SEENLIST_MARK_BASE64, VerifiedBadgeOg, fetchAvatarDataUri } from "@/lib/server/ogShared";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social" — extensão pedida
 * depois de testar a Fase 1). Mesmo padrão de
 * `app/r/[reviewId]/opengraph-image.tsx` (ler aquele arquivo primeiro
 * — aqui só o que muda está comentado): mesma marca visual
 * (`BRAND`/logo/selo/avatar-com-fallback, vindos de `ogShared.tsx`),
 * mesmo `revalidate`.
 *
 * Card do POST (diferente da review): só gera card próprio quando
 * `post.type === "review"` (`fetchPostShareCard` já filtra isso,
 * devolve `null` pros outros tipos) — texto/imagem/enquete continuam
 * sem OG personalizado, mesmo comportamento de antes.
 */
export const runtime = "edge";
export const alt = "Post no SeenList";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const MAX_TEXT_LENGTH = 220;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, bold, extrabold] = await Promise.all([
    fetchPostShareCard(id),
    loadGoogleFont("Plus Jakarta Sans", 700),
    loadGoogleFont("Plus Jakarta Sans", 800),
  ]);
  const boldFont = { name: "Plus Jakarta Sans", data: bold, weight: 700 as const };
  const extraboldFont = { name: "Plus Jakarta Sans", data: extrabold, weight: 800 as const };
  const fonts = [boldFont, extraboldFont];

  if (!card) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: BRAND.bg,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`. */}
            <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={84} height={64} />
            <span style={{ fontSize: 52, fontWeight: 800, color: BRAND.text }}>SeenList</span>
          </div>
        </div>
      ),
      { ...size, fonts: [extraboldFont] }
    );
  }

  const avatarDataUri = await fetchAvatarDataUri(card.author.avatarUrl);

  const displayText = card.body
    ? card.body.length > MAX_TEXT_LENGTH
      ? `${card.body.slice(0, MAX_TEXT_LENGTH).trim()}…`
      : card.body
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(120% 140% at 15% 0%, #1a2230 0%, #0B0E14 55%)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background: BRAND.surface,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 28,
            padding: "44px 48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -180,
              left: -180,
              width: 520,
              height: 520,
              borderRadius: 999,
              background: "radial-gradient(circle, rgba(232,163,61,0.35) 0%, rgba(232,163,61,0) 70%)",
              display: "flex",
            }}
          />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`, precisa de `<img>` cru.
                <img
                  src={avatarDataUri}
                  width={64}
                  height={64}
                  style={{ borderRadius: 999, border: "3px solid rgba(232,163,61,0.5)", objectFit: "cover" }}
                />
              ) : (
                <AvatarFallbackOg name={card.author.displayName} size={64} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: BRAND.text }}>{card.author.displayName}</span>
                  {card.author.verifiedTier && <VerifiedBadgeOg tier={card.author.verifiedTier} size={22} />}
                </div>
                <span style={{ fontSize: 17, color: BRAND.muted }}>{`@${card.author.username}`}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`. */}
              <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={26} height={20} />
              <span style={{ fontSize: 17, fontWeight: 700, color: BRAND.text }}>SeenList</span>
            </div>
          </div>

          {card.rating !== null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: BRAND.primary }}>{card.rating.toFixed(1)}</span>
              <span style={{ fontSize: 22, color: BRAND.primary }}>★</span>
            </div>
          )}

          <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 28, marginTop: 8 }}>
            <div style={{ display: "flex", flex: 1 }}>
              <span style={{ fontSize: 28, lineHeight: 1.4, color: BRAND.text, fontWeight: 700 }}>
                {displayText ?? card.mediaTitle ?? "Post no SeenList"}
              </span>
            </div>
            {card.mediaPosterUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`.
              <img src={card.mediaPosterUrl} style={{ width: 160, height: 240, borderRadius: 14, objectFit: "cover" }} />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7389" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
                </svg>
                <span style={{ fontSize: 16, color: "#6b7389" }}>seenlist.app</span>
              </div>
              <span style={{ fontSize: 15, color: BRAND.muted }}>{card.mediaTitle || "Post no SeenList"}</span>
            </div>
            <span style={{ fontSize: 15, color: BRAND.muted }}>Organize e acompanhe tudo que você assiste</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
