"use client";

import { useEffect, useState } from "react";
import { cn } from "@seenlist/utils";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export interface AvatarProps {
  /** URL da foto — `null`/`undefined`/string vazia já cai direto pras iniciais, sem tentar carregar nada. */
  src?: string | null;
  /** Nome usado tanto pro `alt` da foto quanto pras iniciais de reserva. */
  name: string;
  /**
   * Classes do CÍRCULO (tamanho, fundo, borda) — cada tela já usava um
   * tamanho/fundo diferente antes (20px a 80px; `bg-surface`,
   * `bg-white/10`, `bg-background`); preservadas aqui, passadas por
   * quem chama. Nenhum tamanho/fundo padrão aqui de propósito: `cn()`
   * deste projeto é só `clsx` (sem `tailwind-merge`), então duas
   * classes de fundo diferentes juntas (uma daqui, uma de quem chama)
   * não teriam garantia de qual vence — a de quem chama sempre é a
   * ÚNICA, sem conflito nenhum.
   */
  className?: string;
  /** Classe de TAMANHO da fonte das iniciais (ex.: `text-sm`, `text-[10px]`) — peso/cor (`font-semibold text-muted`) já é padrão, igual em toda tela que usava isso antes. */
  textClassName?: string;
}

/**
 * BUG REAL CORRIGIDO (2026-08-27, reportado — "algumas fotos de perfil
 * no sheet de recomendar continuam quebrando", DEPOIS de uma correção
 * anterior no mesmo dia que só tratava `avatarUrl` nulo/vazio) — causa
 * raiz: TODO lugar do app que mostra foto de perfil (achados via
 * `grep` por `avatarUrl`: `UserListRow.tsx`, `ReviewCard.tsx`,
 * `CommentItem.tsx`, `PublicProfileView.tsx`, `ProfileHeader.tsx`,
 * `ProfileRecommendationsPreview.tsx`, `EditProfileView.tsx`,
 * `RecommendSheet.tsx` — 8 arquivos, ~10 ocorrências) só decidia UMA
 * vez, na hora de renderizar, se mostrava `<img>` ou iniciais — quando
 * a URL EXISTE mas a imagem falha ao carregar DE VERDADE (link
 * apagado/expirado no Storage, bloqueio de host, hiccup de rede etc.),
 * o `<img>` ficava com o ícone de "imagem quebrada" do navegador pra
 * sempre. Só o caso "sem `avatarUrl` nenhum" tinha reserva; o caso
 * "tem link, mas ele não funciona" nunca foi tratado em lugar nenhum.
 *
 * Extraído aqui (a pedido — "tudo deve ser padronizado e alinhado")
 * num componente único reutilizado pelos 8 arquivos acima, em vez de
 * corrigir cada um separadamente: `onError` no `<img>` liga um estado
 * local (`failed`) que troca pras iniciais assim que o carregamento
 * falhar de verdade — antes NENHUM dos 8 lugares tinha esse `onError`.
 * De quebra, a função `initials()` (idêntica, duplicada em 7 dos 8
 * arquivos — só `ProfileRecommendationsPreview.tsx` usava uma versão
 * própria de 1 letra só) agora mora só aqui.
 *
 * `useEffect` reseta `failed` quando `src` muda — sem isso, se o mesmo
 * componente for reaproveitado pra pessoas diferentes sem remontar
 * (raro, mas possível), um erro antigo "vazaria" pro próximo avatar.
 */
export function Avatar({ src, name, className, textClassName }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = !!src && !failed;

  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image
        <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className={cn("font-semibold text-muted", textClassName)}>{initials(name)}</span>
      )}
    </div>
  );
}
