import { ImageResponse } from "next/og";
import { fetchProfileShareCard } from "@/lib/server/profileShareCard";
import { formatWatchMinutesPlain } from "@/lib/server/formatWatchMinutesPlain";
import { loadGoogleFontSafe } from "@/lib/server/loadGoogleFont";
import { AvatarFallbackOg, BRAND, SEENLIST_MARK_BASE64, VerifiedBadgeOg, fetchAvatarDataUri } from "@/lib/server/ogShared";

/**
 * REDESIGN (2026-10-08, "estilo Unwind" — mesmo mockup aprovado do
 * card de review, https://claude.ai/artifact/SvYnmVJedKZkRjvXNHbsdm).
 * Mantém a estrutura "Estilo Bingers" já aprovada antes (avatar+nome à
 * esquerda / logo+nome à direita no topo; fileira de pôsteres), só
 * ajusta: estatísticas em TILES (caixa com fundo e borda, número
 * grande) em vez de texto solto na mesma linha de base — mais
 * "peso" visual, igual ao mockup; rodapé reduzido a só
 * `seenlist.app/u/<username>` (sem a segunda linha "<nome> on
 * SeenList" nem a tagline "Organize e acompanhe..." do lado direito,
 * ambas redundantes ao lado do nome/avatar já visíveis no topo do
 * próprio card).
 *
 * NOTA IMPORTANTE (não decidida sem avisar — "nunca tome grandes
 * decisões, dê as opções pra eu decidir"): o mockup aprovado foi
 * descrito como tendo 3 tiles de estatística, mas `ProfileShareCard`
 * (`profileShareCard.ts`) só expõe 2 métricas reais: `watchedCount` e
 * `watchMinutes`. Implementado aqui com 2 tiles — nenhuma 3ª métrica
 * foi inventada. Se a intenção era mesmo 3 (ex.: filmes/séries
 * separados, ou contagem de títulos), me diga qual e eu ajusto
 * `fetchProfileShareCard` pra expor o dado real por trás dela.
 *
 * Também troca `loadGoogleFont` por `loadGoogleFontSafe` — mesma
 * causa raiz do "falha universal" corrigida no card de review (ver
 * `loadGoogleFont.ts`); aqui não tinha o mesmo bug reportado, mas o
 * risco era idêntico (chamada incondicional, sem try/catch, dentro do
 * `Promise.all`).
 *
 * `BRAND`/`SEENLIST_MARK_BASE64`/`VerifiedBadgeOg`/`AvatarFallbackOg`
 * agora vêm de `ogShared.tsx` em vez de definições locais duplicadas
 * — eram idênticas (mesma marca, mesmo selo, mesmo fallback de
 * avatar); consolidado numa fonte só pra não divergir se um dos dois
 * arquivos for ajustado no futuro e o outro não.
 */
export const runtime = "edge";
export const alt = "Perfil no SeenList";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Preview de rede social não precisa de dado em tempo real — 1h evita
// gerar a mesma imagem de novo a cada toque de "atualizar link" de
// quem está testando o compartilhamento.
export const revalidate = 3600;

function StatTileOg({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "16px 24px",
        background: "rgba(232,163,61,0.08)",
        border: `1px solid ${BRAND.border}`,
        borderRadius: 16,
      }}
    >
      <span style={{ fontSize: 34, fontWeight: 800, color: BRAND.text, display: "flex" }}>{value}</span>
      <span style={{ fontSize: 16, color: BRAND.muted, display: "flex" }}>{label}</span>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [card, bold, extrabold] = await Promise.all([
    fetchProfileShareCard(username),
    loadGoogleFontSafe("Plus Jakarta Sans", 700),
    loadGoogleFontSafe("Plus Jakarta Sans", 800),
  ]);
  const fonts = [
    bold ? { name: "Plus Jakarta Sans", data: bold, weight: 700 as const } : null,
    extrabold ? { name: "Plus Jakarta Sans", data: extrabold, weight: 800 as const } : null,
  ].filter((font): font is { name: string; data: ArrayBuffer; weight: 700 | 800 } => font !== null);

  // Ver comentário completo em `fetchAvatarDataUri` (`ogShared.tsx`):
  // `avatar_url` pode ser a foto direta do Google (copiada 1x no
  // cadastro), que o `fetch` do satori às vezes não consegue buscar —
  // cai pro mesmo círculo de gradiente + iniciais que `Avatar.tsx` já
  // usa no app normal, nunca um buraco vazio no card.
  const avatarDataUri = card ? await fetchAvatarDataUri(card.avatarUrl) : null;

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
            {/* eslint-disable-next-line @next/next/no-img-element -- marca real do app, embutida como data: URI. Proporção real 1.3125:1 (548×417 recortado) — largura/altura iguais distorcem o logo; 84×64 preserva a proporção. */}
            <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={84} height={64} />
            <span style={{ fontSize: 52, fontWeight: 800, color: BRAND.text }}>SeenList</span>
          </div>
        </div>
      ),
      { ...size, fonts: fonts.length ? [fonts[fonts.length - 1]!] : [] }
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

          {/* Topo: avatar + nome à esquerda, logo+nome real à direita — inalterado do design "Estilo Bingers" já aprovado antes */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`, precisa de `<img>` cru.
                <img
                  src={avatarDataUri}
                  width={84}
                  height={84}
                  style={{ borderRadius: 999, border: "3px solid rgba(232,163,61,0.5)", objectFit: "cover" }}
                />
              ) : (
                <AvatarFallbackOg name={card.displayName} size={84} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: BRAND.text }}>{card.displayName}</span>
                  {card.verifiedTier && <VerifiedBadgeOg tier={card.verifiedTier} size={26} />}
                </div>
                <span style={{ fontSize: 18, color: BRAND.muted }}>{`@${card.username}`}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- proporção real 1.3125:1 (548×417 recortado); 26×20 preserva a proporção. */}
              <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={26} height={20} />
              <span style={{ fontSize: 17, fontWeight: 700, color: BRAND.text }}>SeenList</span>
            </div>
          </div>

          {/* Estatísticas em tiles — só quando a biblioteca é pública (ver `fetchProfileShareCard`) */}
          {stats && (
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <StatTileOg value={String(stats.watchedCount)} label="assistidos" />
              <StatTileOg value={formatWatchMinutesPlain(stats.watchMinutes)} label="de tela" />
            </div>
          )}

          {/* Fileira de pôsteres — só os que existem de verdade em cache (ver `fetchProfileShareCard`), inalterada */}
          {card.posterUrls.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {card.posterUrls.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={index} src={url} style={{ flex: 1, height: 240, borderRadius: 10, objectFit: "cover" }} />
              ))}
            </div>
          )}

          {/* Rodapé — só o link, sem tagline/slogan. O pedido "tira o seenlist.app e deixa só a logo+nome" (feito durante a fase de mockup) se referia ao card de REVIEW, onde a marca já aparece em outro canto; aqui, no perfil, o link É o conteúdo do rodapé — fica, mas sozinho, sem a 2ª linha "<nome> on SeenList" nem a frase do lado direito, ambas redundantes com o nome já visível no topo. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7389" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
            </svg>
            <span style={{ fontSize: 16, color: "#6b7389" }}>{`seenlist.app/u/${card.username}`}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
