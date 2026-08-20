-- TEMPORÁRIO (auditoria de performance, a pedido) — tabela só de
-- coleta, sem política de LEITURA pra ninguém (nem client anônimo,
-- nem usuário logado) — só entra dado; análise é sempre via SQL
-- Editor/consulta direta, nunca pelo app. Motivo de existir: medir o
-- web em CELULAR DE VERDADE não dá pra fazer só com console.log (não
-- tem DevTools fácil no navegador do celular, diferente do
-- computador) — cada marca/métrica (`lib/perfMarks.ts`,
-- `WebVitalsReporter.tsx`) passa a gravar aqui também, pra virar
-- número real depois, sem suposição.
--
-- Política de INSERT aberta pra QUALQUER UM (anônimo incluído,
-- `with check (true)`) de propósito — a maioria de quem visita o
-- site nem está logada ainda (tela de login, cadastro, perfil
-- público /u/...), e a medição precisa cobrir isso também. Risco
-- aceito conscientemente: é uma tabela só de telemetria, sem dado
-- sensível — o pior caso é alguém mandar linha de spam nela (fácil
-- de limpar, e a tabela inteira é descartável quando a auditoria
-- terminar).
create table if not exists public.perf_measurements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Nome da métrica: Core Web Vitals (LCP, INP, CLS, TTFB, FCP) ou
  -- marca customizada (providers_mounted, library_view_mounted,
  -- library_data_loaded).
  metric text not null,
  -- Milissegundos (marcas customizadas e a maioria das Web Vitals) ou
  -- score adimensional (CLS).
  value numeric not null,
  -- Só Web Vitals têm isso: 'good' | 'needs-improvement' | 'poor',
  -- já classificado pelo próprio Next.js/Chrome.
  rating text,
  -- De qual página veio (pathname) — pra separar "Biblioteca lenta"
  -- de "site lento em geral".
  page text,
  -- Pra filtrar depois por aparelho/navegador real (iPhone Safari,
  -- Android Chrome, etc.) sem precisar perguntar pra cada pessoa.
  user_agent text
);

create index if not exists perf_measurements_metric_idx
  on public.perf_measurements (metric, created_at desc);

alter table public.perf_measurements enable row level security;

drop policy if exists "qualquer um pode registrar medicao" on public.perf_measurements;
create policy "qualquer um pode registrar medicao"
  on public.perf_measurements for insert
  to anon, authenticated
  with check (true);
