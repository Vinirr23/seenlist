import { ImageResponse } from "next/og";
import { fetchReviewShareCard } from "@/lib/server/reviewShareCard";
import {
  AvatarFallbackOg,
  BRAND,
  PLUS_JAKARTA_SANS_BOLD_BASE64,
  PLUS_JAKARTA_SANS_EXTRABOLD_BASE64,
  SEENLIST_MARK_BASE64,
  VerifiedBadgeOg,
  StarsRowOg,
  decodeBase64Font,
  fetchAvatarDataUri,
  truncateAtWord,
} from "@/lib/server/ogShared";

/**
 * REDESIGN (2026-10-08, "estilo Unwind" — mockup aprovado em
 * https://claude.ai/artifact/SvYnmVJedKZkRjvXNHbsdm, 21 versões de
 * iteração/aprovação com o usuário). Mantém o mesmo propósito e as
 * mesmas fontes de dados de antes (ver versão anterior deste arquivo
 * no histórico do git), só troca o LAYOUT visual: pôster sangrando
 * pro fundo do lado direito (com um gradiente de fade pro fundo do
 * card, não uma caixa separada flutuando), nota em 5 estrelas reais
 * (incluindo meia estrela) via `StarsRowOg`, comentário maior e sem
 * itálico truncado em limite de PALAVRA (não de caractere), e
 * logo+"SeenList" sozinhos no canto inferior direito (sem mais o
 * texto "seenlist.app" — a imagem só existe acoplada a uma página que
 * já tem o link; o rodapé anterior com "Organize e acompanhe..."
 * também saiu, a pedido do usuário, por ficar redundante com o resto
 * do card).
 *
 * Histórico (2026-10-08): nesta data trocou `loadGoogleFont` por
 * `loadGoogleFontSafe` — "falha universal" (TODA imagem de review,
 * não só uma específica) caía com 500 sempre que a API do Google
 * Fonts mudava de formato ou a rede falhava. NA MESMA SESSÃO, ainda
 * no mesmo dia, essa dependência da API ao vivo foi removida por
 * completo (mesma correção aplicada antes no card de perfil) — ver
 * `decodeBase64Font` e o comentário de `PLUS_JAKARTA_SANS_BOLD_BASE64`
 * em `ogShared.tsx` — depois de essa API servir um arquivo de fonte
 * corrompido em produção 3 vezes.
 */
export const runtime = "edge";
export const alt = "Avaliação no SeenList";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

// Limites de caracteres pra truncar ANTES de renderizar (ver
// `truncateAtWord`, `ogShared.tsx`) — o satori não suporta
// `-webkit-line-clamp` de forma confiável, então o corte de linha
// precisa ser feito em JS, não em CSS. Valores calculados pra caber
// na coluna de texto (~58% dos 1200px do card, menos padding) nos
// tamanhos de fonte escolhidos; ver nota de verificação abaixo.
const MAX_TITLE_LENGTH = 46;
const MAX_TEXT_LENGTH = 150;

export default async function Image({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const card = await fetchReviewShareCard(reviewId);

  // Fontes locais, embutidas em `ogShared.tsx` — sem chamada de rede,
  // sem `loadGoogleFontSafe`, sem possibilidade de vir corrompida (ver
  // comentário completo na declaração de `PLUS_JAKARTA_SANS_BOLD_BASE64`
  // em `ogShared.tsx`). Mesma correção aplicada antes no card de perfil.
  const fonts = [
    { name: "Plus Jakarta Sans", data: decodeBase64Font(PLUS_JAKARTA_SANS_BOLD_BASE64), weight: 700 as const },
    { name: "Plus Jakarta Sans", data: decodeBase64Font(PLUS_JAKARTA_SANS_EXTRABOLD_BASE64), weight: 800 as const },
  ];

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
      // Fontes locais embutidas (ver `decodeBase64Font`, importado de
      // `ogShared.tsx`) — sempre presentes, nunca mais um array vazio.
      { ...size, fonts: [fonts[1]] }
    );
  }

  // Ver comentário completo em `fetchAvatarDataUri` (`ogShared.tsx`):
  // avatar com URL que existe mas falha ao carregar no servidor (ex.:
  // foto do Google) cai pro fallback de iniciais, nunca um buraco
  // vazio no card.
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
            display: "flex",
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

          {/* Pôster sangrando pro fundo (metade direita do card), com
          fade pro fundo escuro em vez de uma caixa separada flutuando
          — decisão tomada depois de 3 rodadas de mockup (poster
          "isolado"/"afastado pra esquerda"). Evitado `mask-image`
          (suporte incerto no satori/vercel-og) — o fade é só um
          gradiente normal por cima da imagem, a mesma técnica já usada
          no círculo de glow acima, que o satori sabe desenhar com
          certeza. */}
          {card.mediaPosterUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`. */}
              <img
                src={card.mediaPosterUrl}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "56%",
                  height: "100%",
                  objectFit: "cover",
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "56%",
                  height: "100%",
                  background: `linear-gradient(to right, ${BRAND.surface} 0%, ${BRAND.surface} 18%, rgba(19,24,38,0) 72%)`,
                  display: "flex",
                }}
              />
            </>
          )}

          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "44px 48px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`, precisa de `<img>` cru.
                <img
                  src={avatarDataUri}
                  width={56}
                  height={56}
                  style={{ borderRadius: 999, border: "3px solid rgba(232,163,61,0.5)", objectFit: "cover" }}
                />
              ) : (
                <AvatarFallbackOg name={card.author.displayName} size={56} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: BRAND.text }}>{card.author.displayName}</span>
                  {card.author.verifiedTier && <VerifiedBadgeOg tier={card.author.verifiedTier} size={20} />}
                </div>
                <span style={{ fontSize: 15, color: BRAND.muted }}>{`@${card.author.username}`}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "58%" }}>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: BRAND.text,
                  lineHeight: 1.18,
                  display: "flex",
                }}
              >
                {mediaTitle}
              </span>

              {card.rating !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* 5 estrelas reais com preenchimento por `clipPath`
                  SVG — não texto `★` (risco de não existir no arquivo
                  da fonte carregada) nem % de largura em CSS (técnica
                  frágil, já causou "você bugou as estrelas" no mockup
                  por 2 rodadas antes dessa troca). Ver `StarsRowOg`,
                  `ogShared.tsx`. */}
                  <StarsRowOg rating={card.rating} size={28} />
                  <div style={{ width: 4, height: 4, borderRadius: 999, background: BRAND.muted, display: "flex" }} />
                  <span style={{ fontSize: 20, color: BRAND.muted }}>{mediaTypeLabel}</span>
                </div>
              )}

              {displayText && (
                <span style={{ fontSize: 26, lineHeight: 1.5, color: BRAND.text, fontWeight: 500, display: "flex" }}>
                  {displayText}
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`. */}
              <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={24} height={18} />
              <span style={{ fontSize: 18, fontWeight: 700, color: BRAND.text }}>SeenList</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
