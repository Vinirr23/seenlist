import { ImageResponse } from "next/og";
import { fetchReviewShareCard } from "@/lib/server/reviewShareCard";
import { loadGoogleFontSafe } from "@/lib/server/loadGoogleFont";
import { AvatarFallbackOg, BRAND, SEENLIST_MARK_BASE64, VerifiedBadgeOg, StarsRowOg, fetchAvatarDataUri, truncateAtWord } from "@/lib/server/ogShared";

/**
 * NOVO (2026-10-08, "Opção B — Stories", aprovada junto da opção A no
 * mesmo mockup — https://claude.ai/artifact/SvYnmVJedKZkRjvXNHbsdm).
 * Formato vertical 1080×1920 (Stories do Instagram/WhatsApp), pensado
 * pra exportação/download — NUNCA pro `og:image` do link (por isso
 * não usa a convenção de arquivo `opengraph-image.tsx`, que o Next
 * injeta automaticamente nas meta tags; isto é uma rota comum,
 * chamada só pela ação explícita "Exportar pra Stories" do app).
 *
 * Decisão explícita do usuário (ver resumo da sessão): "Compartilhar
 * link" (usa a Opção A, `opengraph-image.tsx`, como preview do link) e
 * "Exportar pra Stories" (usa esta rota) são DUAS AÇÕES DISTINTAS —
 * nunca substituir uma pela outra automaticamente, pra não perder o
 * acesso direto à review em apps que só aceitam compartilhar imagem
 * (ex.: Stories do Threads/Instagram).
 *
 * Ajustes pedidos sobre o mockup original (3 pontos, todos aplicados
 * aqui):
 * 1. Nome de usuário com menos destaque que a avaliação (fonte menor,
 *    cor `BRAND.muted` em vez de `BRAND.text`).
 * 2. Gradiente escuro mais forte/adiantado por trás do texto — chega a
 *    ~90% de opacidade por volta de 56% da altura, pra garantir
 *    leitura com qualquer pôster (claro, com rosto, etc.).
 * 3. Margens de segurança maiores no topo e no rodapé, pra não
 *    sobrepor a interface do Stories (relógio/ícones no topo, barra de
 *    reply/reações embaixo).
 */
export const runtime = "edge";
export const revalidate = 3600;

const WIDTH = 1080;
const HEIGHT = 1920;
// Margens de segurança — ver ajuste 3 na nota acima. Topo: espaço pra
// relógio/ícones de bateria/sinal que o Instagram/WhatsApp desenham
// por cima de qualquer imagem de Stories. Rodapé: espaço pra barra de
// reply que esses apps sempre sobrepõem na parte de baixo.
const SAFE_TOP = 140;
const SAFE_BOTTOM = 160;

const MAX_TITLE_LENGTH = 54;
const MAX_TEXT_LENGTH = 190;

export async function GET(_request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  // Mesma correção de resiliência aplicada nos dois `opengraph-image.tsx`
  // — ver `loadGoogleFontSafe`, `loadGoogleFont.ts`.
  const [card, bold, extrabold] = await Promise.all([
    fetchReviewShareCard(reviewId),
    loadGoogleFontSafe("Plus Jakarta Sans", 700),
    loadGoogleFontSafe("Plus Jakarta Sans", 800),
  ]);
  const fonts = [
    bold ? { name: "Plus Jakarta Sans", data: bold, weight: 700 as const } : null,
    extrabold ? { name: "Plus Jakarta Sans", data: extrabold, weight: 800 as const } : null,
  ].filter((font): font is { name: string; data: ArrayBuffer; weight: 700 | 800 } => font !== null);

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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`. */}
            <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={126} height={96} />
            <span style={{ fontSize: 52, fontWeight: 800, color: BRAND.text }}>SeenList</span>
          </div>
        </div>
      ),
      { width: WIDTH, height: HEIGHT, fonts: fonts.length ? [fonts[fonts.length - 1]!] : [] }
    );
  }

  const avatarDataUri = await fetchAvatarDataUri(card.author.avatarUrl);

  const displayText = card.containsSpoiler
    ? "Contém spoiler — abra no SeenList pra ler."
    : card.reviewText
      ? truncateAtWord(card.reviewText, MAX_TEXT_LENGTH)
      : null;

  const mediaTitle = truncateAtWord(card.mediaTitle || "Avaliação no SeenList", MAX_TITLE_LENGTH);
  const mediaTypeLabel = card.mediaType === "movie" ? "Filme" : "Série";

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          background: BRAND.bg,
          overflow: "hidden",
        }}
      >
        {card.mediaPosterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`.
          <img
            src={card.mediaPosterUrl}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", display: "flex" }}
          />
        )}

        {/* Scrim escuro — ajuste 2 da nota acima: adiantado e reforçado
        (chega perto da opacidade máxima bem antes do meio da imagem),
        pra ler o texto por cima de QUALQUER pôster, não só os escuros
        testados no mockup. Gradiente simples (`linear-gradient`), sem
        depender de `mask-image` (suporte incerto no satori). */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(to bottom, rgba(11,14,20,0.35) 0%, rgba(11,14,20,0.55) 30%, rgba(11,14,20,0.9) 56%, rgba(11,14,20,0.97) 78%, rgba(11,14,20,1) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: `${SAFE_TOP}px 72px ${SAFE_BOTTOM}px`,
          }}
        >
          {/* Topo: avatar + nome, com menos destaque que a avaliação — ajuste 1 da nota acima. */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {avatarDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`, precisa de `<img>` cru.
              <img
                src={avatarDataUri}
                width={48}
                height={48}
                style={{ borderRadius: 999, border: "2px solid rgba(232,163,61,0.5)", objectFit: "cover" }}
              />
            ) : (
              <AvatarFallbackOg name={card.author.displayName} size={48} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: BRAND.muted }}>{card.author.displayName}</span>
              {card.author.verifiedTier && <VerifiedBadgeOg tier={card.author.verifiedTier} size={18} />}
            </div>
          </div>

          {/* Zona inferior: nota, título, trecho — protagonistas do card, como pedido. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {card.rating !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <StarsRowOg rating={card.rating} size={40} />
                <div style={{ width: 5, height: 5, borderRadius: 999, background: BRAND.muted, display: "flex" }} />
                <span style={{ fontSize: 24, color: BRAND.muted }}>{mediaTypeLabel}</span>
              </div>
            )}

            <span style={{ fontSize: 52, fontWeight: 800, color: BRAND.text, lineHeight: 1.2, display: "flex" }}>
              {mediaTitle}
            </span>

            {displayText && (
              <span style={{ fontSize: 30, lineHeight: 1.5, color: BRAND.text, fontWeight: 500, display: "flex" }}>
                {displayText}
              </span>
            )}

            {/* Rodapé: logo+nome centralizados — "a logo+nome do stories, deixa ela centralizada" (causa raiz do bug anterior: a única regra `display:flex` pro `.footer` era escopada a uma classe-pai diferente no mockup; aqui, inline `style` garante o centro sem depender de nenhuma classe). */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`. */}
              <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={30} height={23} />
              <span style={{ fontSize: 22, fontWeight: 700, color: BRAND.text }}>SeenList</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts }
  );
}
