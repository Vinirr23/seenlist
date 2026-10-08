import { ImageResponse } from "next/og";
import { fetchProfileShareCard } from "@/lib/server/profileShareCard";
import { formatWatchMinutesRounded } from "@/lib/server/formatWatchMinutesPlain";
import { loadGoogleFontSafe } from "@/lib/server/loadGoogleFont";
import { AvatarFallbackOg, BRAND, SEENLIST_MARK_BASE64, VerifiedBadgeOg, fetchAvatarDataUri } from "@/lib/server/ogShared";

/**
 * REDESIGN (2026-10-08, "estilo Unwind" — mesmo mockup aprovado do
 * card de review, https://claude.ai/artifact/SvYnmVJedKZkRjvXNHbsdm).
 *
 * CORREÇÃO FINAL (2026-10-08, "ainda está com a caixa ao redor. pare
 * de inventar.") — as duas tentativas anteriores erraram a ESTRUTURA,
 * não só o conteúdo das estatísticas: eu tinha inventado um layout de
 * 2 camadas (div externa com `radial-gradient` de fundo + padding 48,
 * contendo um card interno com `background: BRAND.surface` + borda +
 * `border-radius: 28`) — isso É a "caixa ao redor" que o usuário
 * reportou, porque o card de verdade nunca teve essa moldura externa.
 *
 * Fui direto na fonte (ler o HTML/CSS real do artifact aprovado em vez
 * de adivinhar por print) e o card de PERFIL reaproveita a MESMA regra
 * do card de review (`.card-new`/`.glow-bg`/`.content`, já implementado
 * em `app/r/[reviewId]/opengraph-image.tsx`): é uma ÚNICA camada que
 * ocupa o canvas inteiro —
 *   .card-new { background:#070a10; border:1px solid var(--border);
 *     border-radius:20px; overflow:hidden; position:relative }
 *   .glow-bg { position:absolute; inset:0; <dois radial-gradient +
 *     1 linear-gradient escuro>; filter:blur(2px) }
 *   .glow-bg::after { <linear-gradient diagonal, mix-blend:multiply,
 *     opacity:.6> }
 *   .content.profile-new { padding:18px 20px; height:100%;
 *     display:flex; flex-direction:column; justify-content:space-between }
 * — SEM nenhuma camada/moldura por fora disso. Os valores abaixo são
 * os mesmos do CSS do mockup, multiplicados pela escala real
 * (mockup renderiza a prévia em 440×231px; a imagem final é
 * 1200×630px — fator exato 1200/440 = 630/231 = 30/11 ≈ 2.7273),
 * em vez de estimados de novo por print.
 *
 * Mantém a estrutura "Estilo Bingers" já aprovada antes (avatar+nome à
 * esquerda / logo+nome real à direita no topo; fileira de pôsteres) —
 * só ajusta pra bater com o `.card-new` de verdade: 3 estatísticas
 * (número+rótulo empilhados, sem caixa, espaçadas por
 * `justify-content:space-between` do `.content` — não por `marginTop`
 * manual) e rodapé reduzido a só `seenlist.app/u/<username>` (texto
 * puro, sem ícone de link — o mockup aprovado não tem ícone no rodapé
 * do card de perfil).
 *
 * CORREÇÃO (2026-10-08, comparado com o print real do mockup v21 que
 * o usuário aprovou — primeira versão daqui tinha só 2 tiles com
 * caixa de fundo/borda, inventada sem conferir o mockup de novo antes
 * de implementar): as 3 estatísticas de verdade são tempo de tela,
 * EPISÓDIOS assistidos (não "filmes+episódios" somados — por isso
 * `ProfileShareStats` ganhou `episodesWatched` separado de
 * `watchedCount`) e quantidade de AVALIAÇÕES escritas (`reviewsCount`,
 * nova contagem em `profileShareCard.ts`, mesma definição de
 * `reviewsGiven` em `lib/queries/social-counts.ts`). `watchedCount`
 * continua existindo só porque `app/u/[username]/page.tsx` ainda usa
 * ele no texto do `<meta name="description">`.
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

/**
 * Número+rótulo empilhados, SEM caixa nenhuma — só texto solto, igual
 * ao `.card-new` do mockup aprovado (confirmado lendo o CSS real, não
 * por print). Tamanho de fonte = valor do mockup (20px/11px num card
 * de prévia 440×231) × escala real (30/11) — ver comentário grande no
 * topo do arquivo.
 */
function StatTileOg({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 55, fontWeight: 800, color: BRAND.text, lineHeight: 1.15, display: "flex" }}>{value}</span>
      <span style={{ fontSize: 30, color: "#9aa2b5", display: "flex" }}>{label}</span>
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
      // .card-new — ÚNICA camada, ocupa o canvas 1200×630 inteiro. SEM
      // moldura/fundo externo por fora disso (essa moldura extra era a
      // "caixa ao redor" reportada — removida).
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: "#070a10",
          border: "3px solid " + BRAND.border,
          borderRadius: 55,
          overflow: "hidden",
          display: "flex",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        {/* .glow-bg — camada decorativa absoluta, mesmos 2 radial-gradient + 1 linear-gradient escuro do mockup */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            background:
              "radial-gradient(60% 80% at 75% 20%, rgba(232,163,61,.35), transparent 60%), radial-gradient(70% 90% at 15% 90%, rgba(79,209,197,.25), transparent 55%), linear-gradient(180deg, rgba(7,10,16,.4), rgba(7,10,16,.92) 70%), linear-gradient(135deg, rgba(44,58,82,.6) 0%, rgba(20,27,40,.6) 55%, rgba(11,14,20,.6) 100%)",
            filter: "blur(5px)",
          }}
        />

        {/* .content.profile-new — conteúdo real, acima do glow (z-index via ordem no DOM do satori) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "49px 55px",
          }}
        >
          {/* Topo: avatar + nome à esquerda, logo+nome real à direita — inalterado do design "Estilo Bingers" já aprovado antes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 27 }}>
              {avatarDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element -- `ImageResponse` (satori) não suporta `next/image`, precisa de `<img>` cru.
                <img
                  src={avatarDataUri}
                  width={98}
                  height={98}
                  style={{ borderRadius: 999, border: "5px solid rgba(255,255,255,0.25)", objectFit: "cover" }}
                />
              ) : (
                <AvatarFallbackOg name={card.displayName} size={98} />
              )}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 41, fontWeight: 800, color: BRAND.text, display: "flex" }}>{card.displayName}</span>
                  {card.verifiedTier && <VerifiedBadgeOg tier={card.verifiedTier} size={34} />}
                </div>
                <span style={{ fontSize: 30, color: "#c3c9d6", display: "flex" }}>{`@${card.username}`}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- proporção real 1.3125:1 (548×417 recortado); 44×34 preserva a proporção, igual ao .brand-new do mockup (ícone 16px × escala 2.7273). */}
              <img src={`data:image/png;base64,${SEENLIST_MARK_BASE64}`} width={44} height={34} style={{ borderRadius: 11 }} />
              <span style={{ fontSize: 35, fontWeight: 800, color: BRAND.text, display: "flex" }}>SeenList</span>
            </div>
          </div>

          {/* Estatísticas — 3, nessa ordem, igual ao mockup v21 aprovado ("7 meses / de tela", "7.904 / episódios", "612 / avaliações"); espaçadas pelo justify-content:space-between do pai, sem marginTop manual */}
          {stats && (
            <div style={{ display: "flex", gap: 60 }}>
              <StatTileOg value={formatWatchMinutesRounded(stats.watchMinutes)} label="de tela" />
              <StatTileOg value={stats.episodesWatched.toLocaleString("pt-BR")} label="episódios" />
              <StatTileOg value={stats.reviewsCount.toLocaleString("pt-BR")} label="avaliações" />
            </div>
          )}

          {/* Fileira de pôsteres — .poster-row-new.wide do mockup: altura 34% do card, gap 16, cantos 19, borda clara fina, sombra suave; só os que existem de verdade em cache (ver `fetchProfileShareCard`).
              CORREÇÃO (2026-10-08, print do deploy mostrando o rodapé coberto pelos pôsteres) — faltava `height: "100%"` no <img>; só com `flex: 1` (sem altura), o satori usa a proporção natural do pôster (alto, ~2:3), que estourava bem além dos 34% reservados pela linha e cobria o rodapé por baixo. */}
          {card.posterUrls.length > 0 && (
            <div style={{ display: "flex", gap: 16, alignItems: "stretch", height: "34%" }}>
              {card.posterUrls.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={url}
                  style={{
                    flex: 1,
                    height: "100%",
                    borderRadius: 19,
                    border: "3px solid rgba(255,255,255,.14)",
                    boxShadow: "0 11px 27px -14px rgba(0,0,0,.5)",
                    objectFit: "cover",
                  }}
                />
              ))}
            </div>
          )}

          {/* Rodapé — só o link, texto puro, sem ícone (o mockup aprovado não tem ícone no rodapé do card de perfil) */}
          <div style={{ display: "flex" }}>
            <span style={{ fontSize: 30, color: "#9aa2b5", display: "flex" }}>{`seenlist.app/u/${card.username}`}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
