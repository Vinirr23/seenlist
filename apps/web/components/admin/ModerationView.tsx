"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Check, ExternalLink } from "lucide-react";
import type { ReportedPost } from "@/lib/queries/moderation";

/**
 * A PEDIDO — tela de moderação. Antes, saber do que se tratava uma
 * denúncia exigia abrir o Supabase e cruzar UUIDs à mão. Aqui o
 * conteúdo denunciado aparece junto, com as duas ações possíveis.
 *
 * Cliente (não servidor) porque as ações precisam de interação e
 * atualização da lista sem recarregar a página inteira.
 */
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ModerationView({ reports }: { reports: ReportedPost[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(report: ReportedPost, action: "remove" | "dismiss") {
    if (action === "remove" && !window.confirm("Apagar este post? O autor perde o conteúdo, mas a linha fica no banco.")) {
      return;
    }
    setBusyId(report.reportId);
    setError(null);
    try {
      const response = await fetch("/api/admin/moderate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.reportId, postId: report.post?.id, action }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha na ação.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na ação.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full space-y-4 px-4 pb-24 pt-4 md:mx-auto md:max-w-[700px]">
      <div>
        <h1 className="text-xl font-bold text-text">Denúncias</h1>
        <p className="mt-1 text-xs text-muted">
          {reports.length === 0
            ? "Nenhuma denúncia pendente."
            : `${reports.length} ${reports.length === 1 ? "denúncia pendente" : "denúncias pendentes"}.`}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs text-danger">{error}</p>
      )}

      {reports.map((report) => (
        <div key={report.reportId} className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">Motivo: {report.reason}</p>
              <p className="text-[11px] text-muted">
                Denunciado por {report.reporterUsername ? `@${report.reporterUsername}` : "usuário removido"} ·{" "}
                {dateFormatter.format(new Date(report.reportedAt))}
              </p>
            </div>
          </div>

          {report.post ? (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[11px] text-muted">
                {report.post.authorName ?? "—"}{" "}
                {report.post.authorUsername && <span>@{report.post.authorUsername}</span>} ·{" "}
                {dateFormatter.format(new Date(report.post.createdAt))}
                {report.post.deletedAt && <span className="text-danger"> · já apagado</span>}
              </p>

              {report.post.mediaTitle && (
                <p className="mt-1 text-xs font-medium text-primary">{report.post.mediaTitle}</p>
              )}

              {report.post.body ? (
                <p className="mt-1 whitespace-pre-line text-sm text-text">{report.post.body}</p>
              ) : (
                <p className="mt-1 text-sm italic text-muted">(sem texto)</p>
              )}

              {report.post.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={report.post.imageUrl}
                  alt="Conteúdo denunciado"
                  className="mt-2 max-h-64 w-auto rounded-lg border border-border"
                />
              )}

              <a
                href={`/explore/posts/${report.post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-text"
              >
                Abrir post <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </a>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-background p-3 text-xs italic text-muted">
              O post denunciado não existe mais (apagado pelo autor).
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyId === report.reportId}
              onClick={() => act(report, "dismiss")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-muted disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              Dispensar
            </button>
            {report.post && !report.post.deletedAt && (
              <button
                type="button"
                disabled={busyId === report.reportId}
                onClick={() => act(report, "remove")}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger py-2 text-xs font-semibold text-background disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Apagar post
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
