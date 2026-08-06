import type { ObservabilityMetrics } from "@/lib/queries/observability";

/**
 * A PEDIDO — dashboard de observabilidade, reorganizado na estrutura
 * Crescimento / Engajamento / Biblioteca / Social / Saúde.
 * Componente de servidor puro: os números chegam prontos, não tem
 * interação, então não manda JavaScript pro navegador.
 */
function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string | number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-danger" : "text-text"}`}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
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

function pct(retained: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((retained / total) * 100)}%`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "sem atividade";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  return `há ${Math.round(diffH / 24)} d`;
}

/** Barra do funil — largura proporcional à primeira etapa, pra enxergar a queda de relance. */
function FunnelRow({ label, value, base }: { label: string; value: number; base: number }) {
  const width = base > 0 ? Math.max(2, Math.round((value / base) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-text">{label}</span>
        <span className="text-muted">
          {value.toLocaleString("pt-BR")} · {base > 0 ? `${Math.round((value / base) * 100)}%` : "—"}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ObservabilityView({ metrics }: { metrics: ObservabilityMetrics }) {
  const { users, platform, activity, social, health, library, advanced } = metrics;
  const { retention, funnel, topSeries, ratings, presence, growth, activeUsers, engagement } = advanced;

  const perActive = (n: number) =>
    engagement.activeUsers > 0 ? (n / engagement.activeUsers / 30).toFixed(1) : "0,0";

  const staleWarning = presence.lastActivityAt
    ? Date.now() - new Date(presence.lastActivityAt).getTime() > 6 * 60 * 60 * 1000
    : true;

  return (
    <div className="w-full space-y-6 px-4 pb-24 pt-4 md:mx-auto md:max-w-[900px]">
      <div>
        <h1 className="text-xl font-bold text-text">Observabilidade</h1>
        <p className="mt-1 text-xs text-muted">
          Lido direto do banco quando a página abre. Sem cache — recarregue para atualizar.
        </p>
      </div>

      <Section title="Agora">
        <StatCard label="Online agora" value={presence.onlineNow} hint="últimos 5 min" />
        <StatCard label="Ativos (1 hora)" value={presence.activeLastHour} />
        <StatCard
          label="Última atividade"
          value={relativeTime(presence.lastActivityAt)}
          hint={staleWarning ? "silêncio longo — vale investigar" : undefined}
          alert={staleWarning}
        />
      </Section>

      <Section title="Crescimento">
        <StatCard label="Total de usuários" value={users.total} />
        <StatCard label="Novos hoje" value={growth.today} hint={`+${growth.week} na semana`} />
        <StatCard label="Novos (30 dias)" value={growth.month} />
        {/* CORREÇÃO (bug real, visto no painel: "MAU 773.480" com 381 usuários) — contava LINHAS de episódio assistido, não pessoas. Agora vem do RPC, com `count(distinct user_id)`. */}
        <StatCard label="MAU" value={activeUsers.month} hint="pessoas ativas em 30 dias" />
      </Section>

      <Section title="Retenção">
        <StatCard
          label="D1"
          value={pct(retention.d1.retained, retention.d1.total)}
          hint={`${retention.d1.retained} de ${retention.d1.total}`}
        />
        <StatCard
          label="D7"
          value={pct(retention.d7.retained, retention.d7.total)}
          hint={`${retention.d7.retained} de ${retention.d7.total}`}
        />
        <StatCard
          label="D30"
          value={pct(retention.d30.retained, retention.d30.total)}
          hint={`${retention.d30.retained} de ${retention.d30.total}`}
        />
      </Section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Funil de onboarding</h2>
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <FunnelRow label="Criou conta" value={funnel.signedUp} base={funnel.signedUp} />
          <FunnelRow label="Adicionou 1º título" value={funnel.addedFirstTitle} base={funnel.signedUp} />
          <FunnelRow label="Marcou 1º episódio" value={funnel.watchedFirstEpisode} base={funnel.signedUp} />
          <FunnelRow label="Voltou depois do 1º dia" value={funnel.cameBack} base={funnel.signedUp} />
          <p className="text-[11px] text-muted">Contas criadas nos últimos 90 dias.</p>
        </div>
      </section>

      <Section title="Engajamento">
        <StatCard label="Episódios/dia" value={perActive(engagement.episodes)} hint="por usuário ativo" />
        <StatCard label="Avaliações/dia" value={perActive(engagement.reviews)} hint="por usuário ativo" />
        <StatCard label="Comentários/dia" value={perActive(engagement.comments)} hint="por usuário ativo" />
        <StatCard label="Posts/dia" value={perActive(engagement.posts)} hint="por usuário ativo" />
      </Section>

      <Section title="Plataforma">
        <StatCard label="Instalações mobile" value={platform.mobileInstalls} hint="com notificação ativa" />
        <StatCard label="Mobile ativo (30 dias)" value={platform.mobileActive30d} />
        <StatCard label="Android" value={platform.android} />
        <StatCard label="iOS" value={platform.ios} />
      </Section>

      <Section title="Biblioteca">
        <StatCard label="Séries acompanhadas" value={library.seriesTracked} />
        <StatCard label="Filmes na biblioteca" value={library.moviesTracked} />
        <StatCard label="Episódios assistidos" value={library.watchedEpisodes} />
        <StatCard
          label="Nota média"
          value={Number(ratings.average).toFixed(2).replace(".", ",")}
          hint={`${ratings.total.toLocaleString("pt-BR")} avaliações`}
        />
      </Section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Top 10 séries</h2>
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {topSeries.length === 0 && <li className="p-4 text-xs text-muted">Nenhuma série acompanhada ainda.</li>}
          {topSeries.map((item, i) => (
            <li key={item.series_id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 shrink-0 text-xs font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-text">{item.title ?? `#${item.series_id}`}</span>
              <span className="shrink-0 text-xs text-muted">{item.tracked.toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ol>
      </section>

      <Section title="Social">
        <StatCard label="Seguidas (total)" value={social.follows} />
        <StatCard label="Recomendações (7 dias)" value={social.recommendations7d} />
        <StatCard label="Comentários (7 dias)" value={social.comments7d} />
        <StatCard label="Posts (7 dias)" value={activity.posts7d} />
      </Section>

      <Section title="Saúde">
        {/* A PEDIDO — o card virou link pra tela de moderação: antes mostrava o número mas não dava pra ver do que se tratava. */}
        <a href="/admin/moderation" className="contents">
          <StatCard
            label="Denúncias"
            value={health.pendingReports}
            hint={health.pendingReports > 0 ? "abrir moderação →" : "nenhuma"}
            alert={health.pendingReports > 0}
          />
        </a>
        <StatCard label="Feedback (7 dias)" value={health.feedbackLast7d} />
        <StatCard label="Feedback (total)" value={health.feedbackTotal} />
      </Section>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">O que este painel ainda NÃO cobre</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          <span className="text-text">Erros do app e conversão de convites</span> exigem gravar eventos que hoje não
          existem em lugar nenhum (erro só aparece no aparelho; convite exibido/dispensado fica só no armazenamento
          local). Precisam de tabela nova + instrumentação no cliente.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="text-text">Web vs mobile:</span> os números de plataforma vêm de quem instalou o app E
          permitiu notificação — é um piso, não o total.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Crash nativo no <span className="text-text">Play Console → Android vitals</span>; tempo de consulta no{" "}
          <span className="text-text">Supabase → Query Performance</span>; funções agendadas em{" "}
          <span className="text-text">Supabase → Edge Functions</span>; tempo de rota no painel da{" "}
          <span className="text-text">Vercel</span>.
        </p>
      </div>
    </div>
  );
}
