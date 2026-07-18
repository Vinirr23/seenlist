"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShieldOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  useReceivedRecommendations,
  useMarkRecommendationRead,
  useDismissRecommendation,
  useBlockUser,
  useUnblockUser,
  useBlockedUsers,
  type ReceivedRecommendation,
} from "@/lib/queries/recommendations";
import { tmdbImage } from "@/lib/tmdb/image";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { SectionPageHeader } from "./SectionPageHeader";
import { EmptyState } from "../search/EmptyState";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-169 — recomendações recebidas ("fulano recomendou X pra
 * você"), acessada pelo Perfil (bolinha de aviso no ícone da aba,
 * ver BottomNavigation.tsx). Marca como lida ao TOCAR no card (não
 * ao só abrir a tela) — mesmo raciocínio de e-mail/notificação: só
 * "lido" quando a pessoa de fato viu do que se trata, não quando a
 * lista carregou.
 *
 * Bloquear mora aqui (não numa tela de Configurações separada) de
 * propósito — é a ação mais provável de precisar bem no momento em
 * que uma recomendação indesejada chega, não um ajuste que alguém
 * vai procurar deliberadamente no menu de Configurações.
 */
export function RecommendationsPageView() {
  const { data: recommendations, isLoading } = useReceivedRecommendations();
  const markRead = useMarkRecommendationRead();
  const dismiss = useDismissRecommendation();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const { data: blockedUsers } = useBlockedUsers();
  const toast = useToast();
  const [showBlocked, setShowBlocked] = useState(false);

  function handleOpen(rec: ReceivedRecommendation) {
    if (!rec.readAt) markRead.mutate(rec.id);
  }

  function handleDismiss(id: string) {
    hapticTick();
    dismiss.mutate(id);
  }

  function handleBlock(rec: ReceivedRecommendation) {
    hapticTick();
    if (!window.confirm(`Bloquear @${rec.sender.username}? Você não vai mais receber recomendações dessa pessoa.`)) {
      return;
    }
    blockUser.mutate(rec.sender.userId, {
      onSuccess: () => toast.success(`@${rec.sender.username} bloqueado.`),
      onError: () => toast.error("Não foi possível bloquear agora."),
    });
  }

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title="Recomendações" />

      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {!isLoading && recommendations && recommendations.length === 0 && (
        <EmptyState message="Ninguém te recomendou nada ainda." />
      )}

      {!isLoading && recommendations && recommendations.length > 0 && (
        <div className="space-y-2.5">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`flex gap-3 rounded-lg border p-2.5 ${
                rec.readAt ? "border-border bg-surface" : "border-primary/40 bg-primary/5"
              }`}
            >
              <Link
                href={`/${rec.mediaType === "movie" ? "movies" : "series"}/${rec.mediaId}`}
                onClick={() => handleOpen(rec)}
                className="flex min-w-0 flex-1 gap-3"
              >
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-background">
                  {rec.posterPath && (
                    <Image src={tmdbImage(rec.posterPath, "w185") ?? ""} alt="" fill sizes="56px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-text">
                      {rec.sender.displayName ?? `@${rec.sender.username}`}
                    </span>{" "}
                    recomendou
                  </p>
                  <p className="truncate text-sm font-medium text-text">{rec.title}</p>
                  {rec.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted">&quot;{rec.message}&quot;</p>}
                  <p className="mt-1 text-[10px] text-muted">{dateFormatter.format(new Date(rec.createdAt))}</p>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-center justify-between gap-1 py-0.5">
                <button
                  type="button"
                  onClick={() => handleDismiss(rec.id)}
                  aria-label="Dispensar"
                  className="text-muted hover:text-text"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => handleBlock(rec)}
                  aria-label={`Bloquear @${rec.sender.username}`}
                  className="text-muted hover:text-danger"
                >
                  <ShieldOff className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {blockedUsers && blockedUsers.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-muted"
          >
            Usuários bloqueados ({blockedUsers.length})
            {showBlocked ? <ChevronUp className="h-4 w-4" strokeWidth={2} /> : <ChevronDown className="h-4 w-4" strokeWidth={2} />}
          </button>

          {showBlocked && (
            <div className="mt-2 space-y-1.5">
              {blockedUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <span className="text-sm text-text">{user.displayName ?? `@${user.username}`}</span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTick();
                      unblockUser.mutate(user.userId, {
                        onSuccess: () => toast.success(`@${user.username} desbloqueado.`),
                      });
                    }}
                    className="text-xs font-medium text-primary"
                  >
                    Desbloquear
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
