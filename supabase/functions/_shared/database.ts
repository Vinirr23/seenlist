// supabase/functions/_shared/database.ts
//
// CORREÇÃO (2026-10-20, erros reais de `deno check` reportados pelo
// usuário em `library-summaries`, `season-recap` e `series-data`) —
// CAUSA RAIZ, confirmada nas mensagens de erro reais (não suposição):
// nenhuma Edge Function desta fase passava um tipo `Database` para
// `createClient<Database>(...)`. Sem esse genérico explícito, a
// versão de `@supabase/supabase-js` efetivamente importada (via
// `jsr:@supabase/supabase-js@2`) resolve DOIS tipos DIFERENTES pro
// "mesmo" cliente, dependendo de como ele é referenciado:
//
//   1. `createClient(url, key)` — CHAMADO de verdade, com argumentos
//      reais — resolve pra `SupabaseClient<any, "public", "public",
//      any, any>` (o compilador consegue inferir algo a partir da
//      chamada real).
//   2. `ReturnType<typeof createClient>` — usado em toda assinatura
//      de função auxiliar que recebia `supabase` como parâmetro, SEM
//      de fato invocar `createClient` — resolve pelos valores DEFAULT
//      da declaração de tipos da função, que nesta versão são
//      diferentes: `Database` cai pra `unknown` (não `any`), e como
//      `unknown` não tem nenhuma chave (`keyof unknown` é `never`), o
//      nome do schema (`SchemaName`) cai pra `never` em vez de
//      `"public"`.
//
// Os dois tipos (o da variável real `supabase` e o do parâmetro
// declarado via `ReturnType<typeof createClient>`) deixam de ser
// compatíveis — exatamente o erro real "Type '\"public\"' is not
// assignable to type 'never'" em toda função que recebia `supabase`
// como `ReturnType<typeof createClient>`. O MESMO motivo faz
// `.upsert(rows)`/`.upsert({...})` achar que a linha devolvida por
// `.from(nome_da_tabela)` é `never[]`/`never`: sem um `Database`
// explícito, esta versão não consegue inferir o formato da linha a
// partir do nome da tabela, e cai no tipo mais restritivo possível
// (`never`) em vez de aceitar qualquer formato.
//
// CORREÇÃO: declarar aqui, uma ÚNICA vez, o formato real das 3
// tabelas que as Edge Functions desta fase leem/gravam (confirmado
// contra as colunas de fato lidas/escritas em cada arquivo —
// **nenhuma coluna nova, nenhuma migration, isto é só a descrição em
// TypeScript do que já existe no banco**) — e usar
// `createClient<Database>(...)` + o tipo importado `SupabaseClient<Database>`
// (em vez de `ReturnType<typeof createClient>`) em toda função que
// recebe o cliente como parâmetro, nas 3 Edge Functions afetadas e no
// módulo compartilhado `_shared/tmdbSeries.ts`. `tmdb-catalog` não
// precisou de nenhuma mudança — não usa o cliente Supabase
// (passthrough puro de TMDB, confirmado pelo próprio usuário: "zero
// erros").
//
// CORREÇÃO 2 (2026-10-20, erro real de `deno check` reportado pelo
// usuário DEPOIS da correção acima — "upsert() continua inferindo
// never[] mesmo usando SupabaseClient<Database>") — CAUSA RAIZ: cada
// entrada de `Tables` nesta versão do `@supabase/postgrest-js` (usada
// internamente pelo `@supabase/supabase-js`) precisa satisfazer o
// tipo `GenericTable`, que exige QUATRO campos, não três:
// `{ Row; Insert; Update; Relationships }`. Esta declaração só tinha
// `Row`/`Insert`/`Update` — faltava `Relationships`. Sem esse quarto
// campo, cada entrada de tabela aqui NÃO é estruturalmente um
// `GenericTable` válido (é um subconjunto dele, não o tipo inteiro) —
// e a extração condicional de tipo que o `.insert()`/`.upsert()` usa
// internamente pra pegar o `Insert` certo a partir do nome da tabela
// (algo como "esta entrada estende GenericTable? então use o Insert
// dela; senão, never") cai no ramo `never`, porque a entrada não
// estende `GenericTable` sem `Relationships`. Isso explica também por
// que os erros de incompatibilidade de `SupabaseClient` tinham
// desaparecido mas o `upsert()` continuava quebrado: `.select()`/`.eq()`
// só precisam do campo `Row` (que já estava certo), só `.insert()`/
// `.upsert()` dependem da checagem completa contra `GenericTable`
// (que inclui `Relationships`).
//
// Nenhuma das 3 tabelas desta fase tem relacionamento de chave
// estrangeira usado em código (nenhuma chamada faz
// `.select("*, outra_tabela(*)")` em nenhum lugar) — `Relationships:
// []` (array vazio) é o valor correto e real pra isso, não um valor
// inventado: é exatamente o que o próprio CLI do Supabase gera pra
// qualquer tabela sem relacionamento declarado usado na consulta.
//
// CORREÇÃO 3 (2026-10-20, erro real de `deno check` reportado pelo
// usuário DEPOIS de `Relationships: []` — "os mesmos quatro erros
// persistem") — CAUSA RAIZ comprovada empiricamente (repro isolado
// rodado no compilador TypeScript real, não suposição): o problema
// nunca foi faltar `Relationships`. É que `Row`/`Insert` aqui
// referenciavam uma interface com NOME PRÓPRIO, separado
// (`MediaSummariesCacheRow`, etc.) — e esta versão do
// `@supabase/postgrest-js` exige que `Row`/`Insert`/`Update` sejam
// estruturalmente `Record<string, unknown>`. Uma interface nomeada
// com propriedades específicas e SEM assinatura de índice nunca
// satisfaz `Record<string, unknown>` quando comparada por `extends`
// (a regra de "tipo fresco"/objeto literal que permite isso em uma
// atribuição direta NÃO se aplica a uma referência de tipo nomeada).
// Confirmado isolando exatamente essa comparação
// (`InterfaceNomeada extends Record<string, unknown>`) no compilador
// real: dá erro ("Index signature for type 'string' is missing").
//
// Isso faz `Database["public"]["Tables"][nome]` não satisfazer
// `GenericTable`, o que faz `Database["public"]` não satisfazer
// `GenericSchema`, o que faz o generic `Schema` do `SupabaseClient`
// cair no valor default documentado para esse caso: `never` (não
// `"public"`, não `unknown` — literalmente `never`). Com `Schema =
// never`, `.from(nome_da_tabela)` NÃO erra (porque `never` satisfaz
// trivialmente qualquer constraint, sendo o tipo "bottom"), mas o
// `Insert`/`Row` extraído pra aquela tabela também vira `never` — e
// é exatamente aí que `.upsert(rows)`/`.upsert({...})` passam a
// exigir `never[]`/rejeitar toda propriedade. Reproduzido ponta a
// ponta num arquivo isolado com a cadeia real de tipos do
// `postgrest-js` (`GenericTable`/`GenericSchema`), reproduzindo os
// erros reais TS2345/TS2353 caractere por caractere.
//
// Confirmado também por que isso nunca afeta um projeto Supabase
// comum: o `supabase gen types typescript` NUNCA nomeia Row/Insert
// separadamente — ele escreve o formato da linha, literalmente,
// dentro da própria posição `Row`/`Insert` (sem dar nome próprio a
// esse literal). Um tipo-objeto ESCRITO DIRETO numa posição (sem
// passar por uma referência de nome) satisfaz `Record<string,
// unknown>` nessa mesma comparação — comprovado isolando os dois
// casos lado a lado no compilador real.
//
// CORREÇÃO (sem duplicar os campos de cada interface, sem perder a
// checagem de nomes de coluna errados em `.upsert()`/`.insert()`, e
// SEM usar `[key: string]: unknown` — que resolveria o erro mas
// abriria mão de toda checagem de digitação de coluna, uma
// alternativa pior, descartada após comparação empírica): um mapped
// type "identidade" (`TableRow<T>`) reconstrói o mesmo formato, mas
// como um tipo estruturalmente novo em cada uso — e um mapped type
// aplicado satisfaz `Record<string, unknown>` do mesmo jeito que um
// literal escrito direto (também comprovado isoladamente). `Update`
// não precisou de nenhuma mudança: `Partial<T>` já é, pelo mesmo
// motivo, um mapped type — por isso só os erros de `.upsert()`/
// `.insert()` apareciam, nunca de `.update()`.
type TableRow<T> = { [K in keyof T]: T[K] };

export interface Database {
  public: {
    Tables: {
      media_summaries_cache: {
        Row: TableRow<MediaSummariesCacheRow>;
        Insert: TableRow<MediaSummariesCacheRow>;
        Update: Partial<MediaSummariesCacheRow>;
        Relationships: [];
      };
      series_season_episode_counts: {
        Row: TableRow<SeriesSeasonEpisodeCountRow>;
        Insert: TableRow<SeriesSeasonEpisodeCountRow>;
        Update: Partial<SeriesSeasonEpisodeCountRow>;
        Relationships: [];
      };
      season_recaps: {
        Row: TableRow<SeasonRecapsRow>;
        Insert: TableRow<SeasonRecapsRow>;
        Update: Partial<SeasonRecapsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/**
 * `media_summaries_cache` — colunas lidas/gravadas por
 * `library-summaries/index.ts` (leitura: `tmdb_id, media_type, title,
 * original_title, year, poster_path, total_episodes, ended,
 * runtime_minutes, release_date, genres, production_countries,
 * origin_countries, vote_average, vote_count`; gravação: as mesmas +
 * `language`, `fetched_at`). Chave composta real (`onConflict`):
 * `media_type, tmdb_id, language`.
 */
export interface MediaSummariesCacheRow {
  tmdb_id: number;
  media_type: "movie" | "series";
  language: string;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  total_episodes: number | null;
  ended: boolean | null;
  runtime_minutes: number | null;
  release_date: string | null;
  genres: number[] | null;
  production_countries: string[] | null;
  origin_countries: string[] | null;
  vote_average: number | null;
  vote_count: number | null;
  fetched_at: string;
}

/**
 * `series_season_episode_counts` — gravada por
 * `_shared/tmdbSeries.ts` (`cacheSeasonEpisodeCount`). Chave composta
 * real (`onConflict`): `series_id, season_number`.
 */
export interface SeriesSeasonEpisodeCountRow {
  series_id: number;
  season_number: number;
  episode_count: number;
  fetched_at: string;
}

/**
 * `season_recaps` — lida/gravada por `season-recap/index.ts`. Chave
 * composta real (`onConflict`): `tmdb_id, season_number, language`.
 */
export interface SeasonRecapsRow {
  tmdb_id: number;
  season_number: number;
  language: string;
  in_thirty_seconds: string;
  key_events: string[];
  where_it_ended: string | null;
  source_hash: string;
  episode_coverage: number;
  ai_provider: string;
  prompt_version: number;
  generated_at: string;
}
