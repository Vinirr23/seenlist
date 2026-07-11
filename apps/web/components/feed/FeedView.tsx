"use client";

import { ExploreFeedTab } from "../explore/ExploreFeedTab";

/**
 * TASK-072 — Feed virou aba própria na navegação inferior, separada
 * de Explorar (antes era uma sub-aba dentro dela, junto com
 * Descobrir/Atividade). Reaproveita `ExploreFeedTab` inteiro, sem
 * nenhuma mudança nele — o conteúdo (posts, onboarding de
 * categorias, botão de criar post) continua exatamente o mesmo, só
 * mudou de qual tela ele é acessado.
 */
export function FeedView() {
  return (
    <div className="w-full pb-32 md:mx-auto md:max-w-[430px]">
      <ExploreFeedTab />
    </div>
  );
}
