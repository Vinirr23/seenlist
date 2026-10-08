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

/**
 * CORREÇÃO (2026-10-08, comparando com o card real do Bingers que o
 * usuário mandou print) — ANTES esse selo usava um ícone de pasta
 * genérico (`<path d="M4 4h5l1.5 2H20a2...`), inventado por mim, no
 * lugar da marca de verdade do SeenList. Agora é a marca real
 * (recortada de `apps/mobile/assets/images/adaptive-icon-foreground.png`,
 * já usada no ícone do app/splash), reduzida pra 96×96 e embutida como
 * `data:` URI — `ImageResponse`/satori não carrega arquivo de disco,
 * só URL ou `data:` inline.
 */
const SEENLIST_MARK_BASE64 =
  "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";

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
            {/* eslint-disable-next-line @next/next/no-img-element -- marca real do app, embutida como data: URI (ver SEENLIST_MARK_BASE64 acima). */}
            <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={64} height={64} />
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
          {/*
            CORREÇÃO (2026-10-08, print do card real do Bingers) — o
            card deles tem uma luz iluminando o canto superior
            esquerdo, por trás do conteúdo; o nosso estava totalmente
            chapado. `position: absolute` + `overflow: hidden` no card
            (acima) pro brilho nunca vazar pra fora do cantos
            arredondados; fica ATRÁS do conteúdo (os blocos de
            avatar/estatísticas/etc. vêm depois no JSX, então ficam por
            cima).
          */}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={20} height={20} />
              <span style={{ fontSize: 17, fontWeight: 700, color: BRAND.text }}>SeenList</span>
            </div>
          </div>

          {/*
            Estatísticas — só quando a biblioteca é pública (ver
            `fetchProfileShareCard`). CORREÇÃO (2026-10-08, print do
            card real do Bingers): lá "7,974" e "watched" são quase do
            mesmo tamanho — o nosso número estava desproporcionalmente
            maior que o rótulo ao lado. Número reduzido (22, perto do
            rótulo) pra bater com essa proporção.
          */}
          {stats && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 36, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: BRAND.text }}>{stats.watchedCount}</span>
                <span style={{ fontSize: 18, color: BRAND.muted }}>assistidos</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: BRAND.text }}>{formatWatchMinutesPlain(stats.watchMinutes)}</span>
                <span style={{ fontSize: 18, color: BRAND.muted }}>de tela</span>
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

          {/*
            Rodapé — CORREÇÃO (2026-10-08, print do card real do
            Bingers): o deles tem duas linhas — ícone de globo + o
            domínio puro (sem o caminho do perfil) em cima, e "<nome>
            on Bingers" embaixo. O nosso tinha uma linha só, com o
            caminho completo de um lado e uma tagline genérica do
            outro, sem nenhuma relação com o rótulo do Bingers — agora
            segue a mesma estrutura.
          */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7389" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
              </svg>
              <span style={{ fontSize: 16, color: "#6b7389" }}>seenlist.app</span>
            </div>
            <span style={{ fontSize: 15, color: BRAND.muted }}>{`${card.displayName} on SeenList`}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
