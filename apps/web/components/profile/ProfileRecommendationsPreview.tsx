"use client";

import Link from "next/link";
import Image from "next/image";
import { Send } from "lucide-react";
import { useReceivedRecommendations } from "@/lib/queries/recommendations";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * TASK-178 — "Recomendações" deixa de ser só "0 >" e ganha prévia de
 * verdade: avatares de quem recomendou (sobrepostos, mais recente
 * primeiro) + a recomendação mais recente em destaque (pôster +
 * "Fulano recomendou 'Título' pra você"). Mesmo dado que a tela
 * `/profile/recommendations` já usa (`useReceivedRecommendations`),
 * sem buscar nada novo.
 */
export function ProfileRecommendationsPreview() {
  const { data: recommendations, isLoading } = useReceivedRecommendations();

  if (isLoading) {
    return (
      <Link href="/profile/recommendations" className="mb-2 block h-20 animate-pulse rounded-lg bg-surface" />
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Link
        href="/profile/recommendations"
        className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/40"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12">
          <Send className="h-4 w-4 text-primary" strokeWidth={2} />
        </span>
        <span className="text-sm font-medium text-text">Recomendações</span>
        <span className="ml-auto text-xs text-muted">Nenhuma ainda</span>
      </Link>
    );
  }

  const latest = recommendations[0]!;
  const uniqueSenderIds = new Set(recommendations.map((r) => r.sender.userId));
  const uniqueSenders = [...new Map(recommendations.map((r) => [r.sender.userId, r.sender])).values()].slice(0, 4);
  const posterUrl = tmdbImage(latest.posterPath, "w185");
  const unreadCount = recommendations.filter((r) => !r.readAt).length;
  const extraCount = recommendations.length - 1;
  const senderName = latest.sender.displayName ?? latest.sender.username;

  return (
    // A pedido: com recomendação não lida, o card ganha contorno/fundo
    // de destaque (não só o selo nos avatares) pra chamar mais atenção
    // sem precisar entrar na tela pra notar.
    <Link
      href="/profile/recommendations"
      className={`mb-2 flex items-center gap-3 rounded-lg border px-4 py-3.5 transition-colors ${
        unreadCount > 0
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20 hover:border-primary"
          : "border-border bg-surface hover:border-primary/40"
      }`}
    >
      <div className="relative shrink-0">
        <div className="flex -space-x-3">
          {uniqueSenders.map((sender) => (
            <div key={sender.userId} className="h-8 w-8 overflow-hidden rounded-full border-2 border-surface bg-background">
              {sender.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image (mesmo padrão de ProfileHeader.tsx)
                <img src={sender.avatarUrl} alt={sender.displayName ?? sender.username} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted">
                  {(sender.displayName ?? sender.username).slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
        {/*
         * Achado real (feedback de usuário): a frase de recomendação
         * truncava no meio ("e mais 1 pessoa te re...") e a linha "N
         * não lida(s)" só piorava, roubando o espaço que faltava pro
         * texto. Removida a linha de texto; o indicador de não-lida
         * virou um selo numérico sobre os avatares (padrão comum de
         * notificação), sem competir por espaço com a frase.
         */}
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-primary px-1 text-[9px] font-bold leading-none text-background"
            aria-label={`${unreadCount} recomendação${unreadCount > 1 ? "ões" : ""} não lida${unreadCount > 1 ? "s" : ""}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/*
         * TASK-178 (ajuste — a pedido, "como fica quando tem mais de
         * uma?") — achado real: antes, o texto SEMPRE só mostrava a
         * recomendação mais recente, mesmo com várias — escondia que
         * tinha mais coisa ali. Agora diferencia 3 casos: só 1 no
         * total (texto de sempre); várias da MESMA pessoa ("e mais N
         * título(s)"); várias de pessoas DIFERENTES ("e mais N
         * pessoa(s) te recomendaram títulos"). `line-clamp-2` (em vez
         * de `truncate`) pra frase completa sempre aparecer, quebrando
         * em duas linhas quando não coube numa só.
         */}
        {extraCount === 0 ? (
          <p className="line-clamp-2 text-sm text-text">
            <span className="font-semibold">{senderName}</span> recomendou{" "}
            <span className="font-semibold">&quot;{latest.title}&quot;</span> pra você
          </p>
        ) : uniqueSenderIds.size === 1 ? (
          <p className="line-clamp-2 text-sm text-text">
            <span className="font-semibold">{senderName}</span> recomendou{" "}
            <span className="font-semibold">&quot;{latest.title}&quot;</span> e mais {extraCount}{" "}
            {extraCount === 1 ? "título" : "títulos"}
          </p>
        ) : (
          <p className="line-clamp-2 text-sm text-text">
            <span className="font-semibold">{senderName}</span> e mais {uniqueSenderIds.size - 1}{" "}
            {uniqueSenderIds.size - 1 === 1 ? "pessoa" : "pessoas"} te recomendaram títulos
          </p>
        )}
      </div>

      {posterUrl && (
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-background">
          <Image src={posterUrl} alt={latest.title} fill sizes="40px" className="object-cover" />
        </div>
      )}
    </Link>
  );
}
