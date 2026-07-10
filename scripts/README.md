# scripts/

Ferramentas de diagnóstico que rodam fora do app — Node puro, sem
React, sem Next.js. Não fazem parte do build (`apps/web` não importa
nada daqui).

## check-library.ts (TASK-020)

Valida o backend do Supabase diretamente: conexão, tabelas
(`movie_status`, `series_status`, `profiles`), schema completo
(colunas/PK/FK), um INSERT → SELECT → DELETE de teste, e as policies
de RLS. Não esconde nenhum erro — imprime em três formatos
diferentes (`console.log`, `JSON.stringify`, `console.dir` com
profundidade total).

### Como rodar

```bash
cd scripts
npm install
cp .env.example .env
# preencha .env com as credenciais do seu projeto Supabase
npx tsx check-library.ts
```

`SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD` precisam ser de um
usuário real que já existe no seu projeto (crie um pela tela de
cadastro do próprio app se não tiver um só pra teste). Sem login de
verdade, RLS bloqueia tudo — o script avisa e para antes de rodar
qualquer coisa, pra não confundir "ninguém logou" com "RLS está
quebrado".

`SUPABASE_DB_URL` é opcional. Sem ela, as Partes 2 e 5 (schema
completo via `information_schema`, policies via `pg_policies`) são
puladas com um aviso — essas duas não são visíveis pela API REST do
Supabase (`supabase-js`), só por conexão direta em Postgres. Pegue a
connection string em Project Settings → Database → Connection string
→ URI. **Nunca commite essa variável preenchida.**

### O que o script NÃO faz

Não altera nenhum código do app. Não corrige nada sozinho — só
diagnostica e imprime tudo, pra decidir o próximo passo com base em
dado real, não em suposição.
