"use client";

import { useState } from "react";
import Image from "next/image";
import { Send, X } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useFollowList } from "@/lib/queries/follow-list";
import { useSendRecommendation } from "@/lib/queries/recommendations";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";

const MAX_MESSAGE_LENGTH = 200;

/**
 * TASK-169 — "recomendar" reaproveita `useFollowList` (já existia
 * pra tela de seguidores/seguindo) filtrando por "following" — só
 * pra quem o usuário segue, decisão explícita. Sem busca de usuário
 * global de propósito (diferente do "buscar pessoas" de Explorar) —
 * essa lista já é pequena o bastante pra rolar, e limitar a quem já
 * se segue é a regra de negócio, não só uma conveniência de UI.
 */
export function RecommendSheet({
  mediaType,
  mediaId,
  mediaTitle,
  onClose,
}: {
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  onClose: () => void;
}) {
  const { data: currentUser } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { data: following, isLoading } = useFollowList(currentUser?.id ?? null, "following", search);
  const sendRecommendation = useSendRecommendation();
  const toast = useToast();

  function handleSend() {
    if (!selectedUserId) return;
    hapticTick();
    sendRecommendation.mutate(
      { recipientId: selectedUserId, mediaType, mediaId, message },
      {
        onSuccess: () => {
          toast.success("Recomendação enviada!");
          onClose();
        },
        onError: () => toast.error("Não foi possível enviar agora."),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">Recomendar &quot;{mediaTitle}&quot;</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar entre quem você segue..."
          className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
        />

        <div className="mb-3 flex-1 overflow-y-auto">
          {isLoading && <p className="py-4 text-center text-sm text-muted">Carregando...</p>}
          {!isLoading && following && following.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              {search.trim() ? "Ninguém encontrado." : "Você ainda não segue ninguém."}
            </p>
          )}
          {following?.map((person) => {
            const selected = selectedUserId === person.userId;
            return (
              <button
                key={person.userId}
                type="button"
                onClick={() => {
                  hapticTick();
                  setSelectedUserId(selected ? null : person.userId);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
                  selected ? "bg-primary/10" : "hover:bg-background"
                }`}
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-background">
                  {person.avatarUrl && (
                    <Image src={person.avatarUrl} alt="" fill sizes="36px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{person.displayName ?? person.username}</p>
                  <p className="truncate text-xs text-muted">@{person.username}</p>
                </div>
                <div
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    selected ? "border-primary bg-primary" : "border-border"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder="Escreva uma mensagem (opcional)"
          rows={2}
          className="mb-3 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!selectedUserId || sendRecommendation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
        >
          <Send className="h-4 w-4" strokeWidth={2.25} />
          {sendRecommendation.isPending ? "Enviando..." : "Enviar recomendação"}
        </button>
      </div>
    </div>
  );
}
