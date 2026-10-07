-- CORREÇÃO (a pedido, 2026-10-07 — "preciso de tire o - entre
-- 'titulos - igual'") — o travessão na descrição de "Lista
-- compartilhada" ficava estranho lido na tela de Novidades (print
-- real: "remover títulos — igual pros dois lados" cortado em duas
-- linhas, com o travessão meio solto). Troca por vírgula, mesmo
-- conteúdo. `update` direto (não um `insert ... on conflict`) porque a
-- linha já existe — inserida pela migration anterior
-- (`20261007030000_whats_new.sql`), que já estava aplicada quando este
-- ajuste foi pedido.
update public.whats_new_entries
set description = 'Convide alguém pra montar listas com você. Os dois podem adicionar e remover títulos, igual pros dois lados.'
where title = 'Lista compartilhada';
