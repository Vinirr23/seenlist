"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, RefreshCw } from "lucide-react";

interface Signup {
  email: string;
  created_at: string;
}

interface ResultRow {
  email: string;
  ok: boolean;
  error?: string;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function parseExtraEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean))];
}

/**
 * TASK-077 (correção) — a lista de e-mails agora vem PRONTA de quem
 * já preencheu `/beta` (`GET /api/admin/send-beta-invite`), com uma
 * caixinha por pessoa pra escolher quem chamar — em vez de precisar
 * copiar e colar do Supabase manualmente. Ainda dá pra colar
 * e-mails extras (alguém que avisou por fora, por exemplo) no campo
 * de baixo, que somam aos marcados.
 */
export function AdminInviteView() {
  const [signups, setSignups] = useState<Signup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraRaw, setExtraRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadSignups() {
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/send-beta-invite");
      const data = await response.json();
      if (!response.ok) {
        setLoadError(data.error ?? "Não foi possível carregar a lista.");
        return;
      }
      setSignups(data.signups);
      setSelected(new Set((data.signups as Signup[]).map((s) => s.email)));
    } catch (error) {
      console.error("[admin/invite] Falha ao buscar beta_signups", error);
      setLoadError("Erro de rede ao carregar a lista.");
    }
  }

  useEffect(() => {
    void loadSignups();
  }, []);

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function toggleAll() {
    if (!signups) return;
    setSelected((prev) => (prev.size === signups.length ? new Set() : new Set(signups.map((s) => s.email))));
  }

  const extraEmails = useMemo(() => parseExtraEmails(extraRaw), [extraRaw]);
  const totalToSend = useMemo(() => new Set([...selected, ...extraEmails]).size, [selected, extraEmails]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setResults(null);

    const emails = [...new Set([...selected, ...extraEmails])];
    if (emails.length === 0) {
      setFormError("Marca pelo menos um e-mail da lista, ou cola algum extra.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/send-beta-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error ?? "Não foi possível enviar agora.");
        return;
      }
      setResults(data.results);
    } catch (error) {
      console.error("[admin/invite] Falha ao chamar a rota de convite", error);
      setFormError("Erro de rede. Tenta de novo.");
    } finally {
      setSending(false);
    }
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results ? results.length - successCount : 0;

  return (
    <div className="w-full px-4 pb-32 pt-6 md:mx-auto md:max-w-[430px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Convidar pra beta</h1>
        <button type="button" onClick={loadSignups} aria-label="Recarregar lista" className="text-muted hover:text-text">
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <p className="mb-5 text-sm text-muted">
        Manda o link de teste da Play Store pra quem já deixou o e-mail em <span className="text-text">seenlist.app/beta</span>.
      </p>

      {loadError && <p className="mb-3 text-sm text-danger">{loadError}</p>}

      {signups === null && !loadError && (
        <div className="space-y-1 rounded-lg border border-border bg-surface p-1" aria-busy="true" aria-label="Carregando lista">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-none">
              <div className="h-3.5 w-3.5 shrink-0 animate-pulse rounded bg-background" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-background" />
              <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-background" />
            </div>
          ))}
        </div>
      )}

      {signups && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-surface">
            <button
              type="button"
              onClick={toggleAll}
              className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold text-muted"
            >
              {signups.length} na lista de espera
              <span className="text-primary">{selected.size === signups.length ? "Desmarcar todos" : "Marcar todos"}</span>
            </button>
            <div className="max-h-72 overflow-y-auto">
              {signups.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted">Ninguém deixou o e-mail em /beta ainda.</p>
              ) : (
                signups.map((signup) => (
                  <label key={signup.email} className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-none">
                    <input
                      type="checkbox"
                      checked={selected.has(signup.email)}
                      onChange={() => toggle(signup.email)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <span className="flex-1 truncate text-sm text-text">{signup.email}</span>
                    <span className="shrink-0 text-[10px] text-muted">{dateFormatter.format(new Date(signup.created_at))}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label htmlFor="extra-emails" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              E-mails extras (opcional)
            </label>
            <textarea
              id="extra-emails"
              value={extraRaw}
              onChange={(e) => setExtraRaw(e.target.value)}
              rows={3}
              placeholder="alguem@exemplo.com, outro@exemplo.com"
              className="w-full resize-none rounded-lg border border-border bg-surface p-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <button
            type="submit"
            disabled={sending || totalToSend === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
          >
            <Send className="h-4 w-4" strokeWidth={2.5} />
            {sending ? `Enviando ${totalToSend}...` : `Enviar convite (${totalToSend})`}
          </button>
        </form>
      )}

      {results && (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-text">
            <span className="font-semibold text-secondary">{successCount} enviado(s)</span>
            {failCount > 0 && <span className="text-danger"> · {failCount} falhou(aram)</span>}
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface p-2">
            {results.map((r) => (
              <p key={r.email} className={r.ok ? "text-xs text-muted" : "text-xs text-danger"}>
                {r.ok ? "✓" : "✕"} {r.email} {r.error ? `— ${r.error}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
