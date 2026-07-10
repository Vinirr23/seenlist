import type { CurrentUser } from "@/lib/queries/current-user";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2.5 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="truncate text-sm text-text">{value}</span>
    </div>
  );
}

/** Item 4: Nome, Email, UID — UID só em desenvolvimento (item explícito: "opcional, apenas para debug"). */
export function AccountSection({ user }: { user: CurrentUser }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-sm font-semibold text-text">Conta</h2>
      <div className="rounded-lg border border-border bg-surface">
        <Row label="Nome" value={user.name} />
        <Row label="Email" value={user.email} />
        {process.env.NODE_ENV === "development" && <Row label="UID" value={user.id} />}
      </div>
    </section>
  );
}
