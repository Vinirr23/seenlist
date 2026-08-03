"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { FLOATING_BUTTON_BOTTOM_OFFSET } from "@/lib/layout/bottomNavVisibility";

/**
 * AUDITORIA (perf, a pedido) — o formulário inteiro (upload de
 * imagem, mutation de criar post, textarea, preview) morava neste
 * mesmo arquivo, junto do botão "+" — que fica sempre visível no
 * Feed. Resultado: o JS do formulário completo ia junto no
 * carregamento inicial da tela, mesmo pra quem só rola o Feed e
 * nunca publica nada. Extraído pra `CreatePostModal.tsx` e
 * carregado via `dynamic()`, sem SSR (é 100% interativo, não tem
 * nada pra pré-renderizar no servidor) — o JS do modal só é baixado
 * na hora que `open` vira `true`. Nenhuma lógica mudou, só o
 * carregamento.
 */
const CreatePostModal = dynamic(() => import("./CreatePostModal").then((mod) => mod.CreatePostModal), {
  ssr: false,
});

/**
 * TASK-059 (fase 2) — criação de post. TASK-066 — segundo tipo de
 * post: imagem/GIF, com legenda opcional (o resto do pedido original
 * — poster/enquete/review/lista/spoiler — continua fase futura).
 */
export function CreatePostButton() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticTick();
          setOpen(true);
        }}
        aria-label={t("feed.createPost")}
        className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-background shadow-lg active:scale-95"
        style={{ bottom: FLOATING_BUTTON_BOTTOM_OFFSET }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {open && <CreatePostModal onClose={() => setOpen(false)} />}
    </>
  );
}
