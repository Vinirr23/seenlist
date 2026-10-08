import { ImageResponse } from "next/og";
import { fetchProfileShareCard } from "@/lib/server/profileShareCard";
import { formatWatchMinutesPlain } from "@/lib/server/formatWatchMinutesPlain";
import { loadGoogleFont } from "@/lib/server/loadGoogleFont";

/**
 * A PEDIDO (2026-10-08 — "preciso que o perfil fique compartilhável
 * nas redes sociais igual ao Bingers") — arquivo de convenção do
 * Next.js: colocado ao lado de `page.tsx` em `app/u/[username]/`, ele
 * sozinho já injeta as tags `og:image`/`twitter:image` certas (URL
 * absoluta, `width`/`height`/`alt`) — `generateMetadata` (`page.tsx`)
 * não precisa (e não deve) declarar `openGraph.images` na mão, pra não
 * duplicar.
 *
 * Opção "Estilo Bingers", escolhida pelo usuário num mockup
 * (`https://claude.ai/artifact/JHmDHgk4XT4D8o2FzCijRu`) — card com
 * avatar+nome à esquerda, selo do app à direita, linha de
 * estatísticas, fileira de pôsteres, rodapé com o link. Dados reais
 * vêm de `fetchProfileShareCard` — ver o comentário grande lá pro
 * porquê de usar a chave de serviço aqui (crawler de rede social, sem
 * sessão de usuário nenhuma).
 */
export const runtime = "edge";
export const alt = "Perfil no SeenList";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Preview de rede social não precisa de dado em tempo real — 1h evita
// gerar a mesma imagem de novo a cada toque de "atualizar link" de
// quem está testando o compartilhamento.
export const revalidate = 3600;

const BRAND = {
  bg: "#0B0E14",
  surface: "#131826",
  border: "#262D40",
  primary: "#E8A33D",
  muted: "#8C93A8",
  text: "#F4F1E8",
};

function VerifiedBadgeOg({ tier, size: badgeSize }: { tier: "gold" | "blue"; size: number }) {
  return (
    <svg width={badgeSize} height={badgeSize} viewBox="0 0 100 100">
      {tier === "gold" && (
        <defs>
          <linearGradient id="verified-gold-og" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#7a5420" />
            <stop offset="28%" stopColor="#f6dd91" />
            <stop offset="50%" stopColor="#caa04a" />
            <stop offset="72%" stopColor="#fdf0bd" />
            <stop offset="100%" stopColor="#8a6425" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="50,2 64.5,14.9 83.9,16.1 85.1,35.5 98,50 85.1,64.5 83.9,83.9 64.5,85.1 50,98 35.5,85.1 16.1,83.9 14.9,64.5 2,50 14.9,35.5 16.1,16.1 35.5,14.9"
        fill={tier === "gold" ? "url(#verified-gold-og)" : "#2B90F0"}
      />
      <polyline
        points="28,52 43,67 74,33"
        fill="none"
        stroke={tier === "gold" ? "#8a6425" : "#ffffff"}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [card, bold, extrabold] = await Promise.all([
    fetchProfileShareCard(username),
    loadGoogleFont("Plus Jakarta Sans", 700),
    loadGoogleFont("Plus Jakarta Sans", 800),
  ]);

  // Nomeados em vez de indexados (`fonts[1]`) de propósito: com
  // `noUncheckedIndexedAccess` ligado no tsconfig, o TS trata todo
  // acesso por índice de array como possivelmente `undefined` — mesmo
  // sabendo estaticamente que o array tem 2 posições fixas.
  const boldFont = { name: "Plus Jakarta Sans", data: bold, weight: 700 as const };
  const extraboldFont = { name: "Plus Jakarta Sans", data: extrabold, weight: 800 as const };
  const fonts = [boldFont, extraboldFont];

  // Perfil inexistente ou privado: card genérico de marca — nunca
  // revela que um perfil privado existe com aquele nome, mesma regra
  // da página em si.
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
            fontFamily: "Plus Jakarta Sans",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: BRAND.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill={BRAND.bg}>
                <path d="M4 4h5l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
            </div>
            <span style={{ fontSize: 52, fontWeight: 800, color: BRAND.text }}>SeenList</span>
          </div>
        </div>
      ),
      { ...size, fonts: [extraboldFont] }
    );
  }

  const { stats } = card;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          background: "radial-gradient(120% 140% at 15% 0%, #1a2230 0%, #0B0E14 55%)",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: BRAND.surface,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 28,
            padding: "44px 48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Topo: avatar + nome à esquerda, selo do app à direita */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {card.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`, precisa de `<img>` cru.
                <img
                  src={card.avatarUrl}
                  width={84}
                  height={84}
                  style={{ borderRadius: 999, border: "3px solid rgba(232,163,61,0.5)", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #3a4a6b 0%, #1c2335 100%)",
                    border: "3px solid rgba(232,163,61,0.5)",
                    display: "flex",
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: BRAND.text }}>{card.displayName}</span>
                  {card.verifiedTier && <VerifiedBadgeOg tier={card.verifiedTier} size={26} />}
                </div>
                <span style={{ fontSize: 18, color: BRAND.muted }}>{`@${card.username}`}</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(232,163,61,0.1)",
                border: "1px solid rgba(232,163,61,0.3)",
                borderRadius: 999,
                padding: "10px 18px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={BRAND.primary}>
                <path d="M4 4h5l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
              <span style={{ fontSize: 17, fontWeight: 700, color: BRAND.text }}>SeenList</span>
            </div>
          </div>

          {/* Estatísticas — só quando a biblioteca é pública (ver `fetchProfileShareCard`) */}
          {stats && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 36, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: BRAND.text }}>{stats.watchedCount}</span>
                <span style={{ fontSize: 17, color: BRAND.muted }}>assistidos</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: BRAND.text }}>{formatWatchMinutesPlain(stats.watchMinutes)}</span>
                <span style={{ fontSize: 17, color: BRAND.muted }}>de tela</span>
              </div>
            </div>
          )}

          {/* Fileira de pôsteres — só os que existem de verdade em cache (ver `fetchProfileShareCard`) */}
          {card.posterUrls.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {card.posterUrls.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={url}
                  style={{ flex: 1, height: 240, borderRadius: 10, objectFit: "cover" }}
                />
              ))}
            </div>
          )}

          {/* Rodapé */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 16, color: "#6b7389" }}>{`seenlist.app/u/${card.username}`}</span>
            <span style={{ fontSize: 15, color: BRAND.muted }}>Organize filmes, séries e animes</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
