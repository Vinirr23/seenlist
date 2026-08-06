import type { ObservabilityMetrics } from "@/lib/queries/observability";

/**
 * A PEDIDO — dashboard de observabilidade. Componente de servidor
 * puro (sem "use client"): os números já chegam prontos, não tem
 * interação nenhuma, então não faz sentido mandar JavaScript pro
 * navegador só pra desenhar isto.
 */
function StatCard({ label, value, hint, alert }: { label: string; value: number; hint?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-danger" : "text-text"}`}>{value.toLocaleString("pt-BR")}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

export function ObservabilityView({ metrics }: { metrics: ObservabilityMetrics }) {
  const { users, activity, social, health, library } = metrics;

  return (
    <div className="w-full space-y-6 px-4 pb-24 pt-4 md:mx-auto md:max-w-[900px]">
      <div>
        <h1 className="text-xl font-bold text-text">Observabilidade</h1>
        <p className="mt-1 text-xs text-muted">
          Números lidos direto do banco, na hora que a página abre. Sem cache — recarregue para atualizar.
        </p>
      </div>

      <Section title="Usuários">
        <StatCard label="Total" value={users.total} />
        <StatCard label="Novos (7 dias)" value={users.newLast7d} />
        <StatCard label="Ativos hoje" value={users.activeToday} hint="marcaram episódio" />
        <StatCard label="Ativos (30 dias)" value={users.active30d} hint="marcaram episódio" />
      </Section>

      <Section title="Atividade">
        <StatCard label="Episódios hoje" value={activity.episodesToday} />
        <StatCard label="Episódios (7 dias)" value={activity.episodes7d} />
        <StatCard label="Avaliações (7 dias)" value={activity.reviews7d} />
        <StatCard label="Posts (7 dias)" value={activity.posts7d} />
      </Section>

      <Section title="Social">
        <StatCard label="Seguidas (total)" value={social.follows} />
        <StatCard label="Recomendações (7 dias)" value={social.recommendations7d} />
        <StatCard label="Comentários (7 dias)" value={social.comments7d} />
      </Section>

      <Section title="Saúde">
        <StatCard
          label="Denúncias"
          value={health.pendingReports}
          hint={health.pendingReports > 0 ? "requer revisão manual" : "nenhuma"}
          alert={health.pendingReports > 0}
        />
        <StatCard label="Feedback (7 dias)" value={health.feedbackLast7d} />
        <StatCard label="Feedback (total)" value={health.feedbackTotal} />
      </Section>

      <Section title="Biblioteca">
        <StatCard label="Séries acompanhadas" value={library.seriesTracked} />
        <StatCard label="Filmes na biblioteca" value={library.moviesTracked} />
        <StatCard label="Episódios assistidos" value={library.watchedEpisodes} />
      </Section>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">O que este painel NÃO cobre</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Aqui só aparece o que está no nosso banco. Erro de execução, crash e tempo de resposta vivem em outros
          lugares e continuam precisando de olhada separada: crash do app no{" "}
          <span className="text-text">Play Console → Android vitals</span>; tempo de consulta no{" "}
          <span className="text-text">Supabase → Query Performance</span>; execução das funções agendadas em{" "}
          <span className="text-text">Supabase → Edge Functions</span>; e tempo das rotas de API no painel da{" "}
          <span className="text-text">Vercel</span>.
        </p>
      </div>
    </div>
  );
}
