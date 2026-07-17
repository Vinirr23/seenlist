"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Trash2, X, ShieldAlert } from "lucide-react";

interface ReportGroup {
  postId: string;
  post: {
    type: string;
    body: string | null;
    imageUrl: string | null;
    mediaTitle: string | null;
    createdAt: string;
    deletedAt: string | null;
    authorUsername: string;
    authorDisplayName: string | null;
  } | null;
  reportCount: number;
  reports: { id: string; reason: string; createdAt: string; reporterUsername: string }[];
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function postPreview(post: ReportGroup["post"]): string {
  if (!post) return "";
  if (post.type === "poll") return post.body ?? "Enquete";
  if (post.type === "review") return `Review${post.mediaTitle ? ` de ${post.mediaTitle}` : ""}${post.body ? `: ${post.body}` : ""}`;
  if (post.body) return post.body;
  if (post.imageUrl) return "(post só com imagem/GIF, sem legenda)";
  return "(post vazio)";
}

/**
 * Fila de moderação de `/api/admin/post-reports` — agrupada por
 * post, mais denunciados primeiro (a própria rota já ordena assim).
 * Duas ações por post: "Apagar post" (soft-delete + limpa a fila
 * daquele post) e "Dispensar" (só limpa a fila, post continua no
 * ar) — sem coluna de status em `post_reports`, "dispensar" é
 * remover a denúncia de verdade, não só marcar como lida.
 */
export function AdminReportsView() {
  const [groups, setGroups] = useState<ReportGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/post-reports");
      const data = await response.json();
      if (!response.ok) {
        setLoadError(data.error ?? "Não foi possível carregar a fila.");
        return;
      }
      setGroups(data.groups);
    } catch (error) {
      console.error("[admin/reports] Falha ao buscar denúncias", error);
      setLoadError("Erro de rede ao carregar a fila.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(postId: string, action: "delete_post" | "dismiss") {
    if (action === "delete_post" && !window.confirm("Apagar este post? Não dá pra desfazer.")) return;

    setActionError(null);
    setBusyPostId(postId);
    try {
      const response = await fetch("/api/admin/post-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionError(data.error ?? "Não foi possível concluir a ação.");
        return;
      }
      setGroups((prev) => (prev ? prev.filter((g) => g.postId !== postId) : prev));
    } catch (error) {
      console.error("[admin/reports] Falha ao aplicar ação", error);
      setActionError("Erro de rede. Tenta de novo.");
    } finally {
      setBusyPostId(null);
    }
  }

  return (
    <div className="w-full px-4 pb-32 pt-6 md:mx-auto md:max-w-[430px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Denúncias</h1>
        <button type="button" onClick={load} aria-label="Recarregar lista" className="text-muted hover:text-text">
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <p className="mb-5 text-sm text-muted">Posts denunciados no Feed, agrupados por post — mais denunciados primeiro.</p>

      {loadError && <p className="mb-3 text-sm text-danger">{loadError}</p>}
      {actionError && <p className="mb-3 text-sm text-danger">{actionError}</p>}

      {groups === null && !loadError && (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando fila">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 h-5 w-24 animate-pulse rounded-full bg-background" />
              <div className="mb-2.5 h-16 w-full animate-pulse rounded-md bg-background" />
              <div className="mb-3 h-3 w-4/5 animate-pulse rounded bg-background" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-background" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-background" />
              </div>
            </div>
          ))}
        </div>
      )}

      {groups && groups.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-muted">
          Nenhuma denúncia pendente.
        </p>
      )}

      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.postId} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-bold text-danger">
                  <ShieldAlert className="h-3 w-3" strokeWidth={2.5} />
                  {group.reportCount} {group.reportCount === 1 ? "denúncia" : "denúncias"}
                </div>
                {group.post?.deletedAt && <span className="text-[10px] font-semibold text-muted">já apagado</span>}
                {!group.post && <span className="text-[10px] font-semibold text-muted">post não existe mais</span>}
              </div>

              {group.post && (
                <div className="mb-2.5 rounded-md border border-border bg-background p-2.5">
                  <p className="mb-1 text-xs text-muted">
                    @{group.post.authorUsername}
                    {group.post.authorDisplayName ? ` (${group.post.authorDisplayName})` : ""} ·{" "}
                    {dateFormatter.format(new Date(group.post.createdAt))}
                  </p>
                  <p className="line-clamp-3 text-sm text-text">{postPreview(group.post)}</p>
                </div>
              )}

              <div className="mb-3 space-y-1.5">
                {group.reports.map((report) => (
                  <p key={report.id} className="text-xs text-muted">
                    <span className="font-semibold text-text">@{report.reporterUsername}</span> — {report.reason} ·{" "}
                    {dateFormatter.format(new Date(report.createdAt))}
                  </p>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(group.postId, "dismiss")}
                  disabled={busyPostId === group.postId}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-text disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Dispensar
                </button>
                {group.post && !group.post.deletedAt && (
                  <button
                    type="button"
                    onClick={() => handleAction(group.postId, "delete_post")}
                    disabled={busyPostId === group.postId}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger py-2 text-xs font-bold text-background disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Apagar post
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
