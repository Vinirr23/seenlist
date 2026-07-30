import { useEffect, useState } from "react";

/**
 * UNIFICAÇÃO (achado real, auditoria de UX) — de 9 modais/bottom
 * sheets no app, só 2 (`WatchedActionsBottomSheet`,
 * `EpisodeRatingBottomSheet`) tinham animação de entrada/saída — os
 * outros 7 apareciam e desapareciam instantaneamente, sem
 * transição nenhuma. Esse hook extrai o padrão que já existia
 * (mount depois de um frame, pra disparar a transição CSS; fecha
 * "de verdade" só depois da transição de saída terminar) — cada
 * componente só decide QUAL classe CSS aplicar quando `mounted`
 * (slide-up pra bottom sheet, scale/fade pra modal centralizado).
 */
export function useDialogAnimation(onClose: () => void, durationMs = 200) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, durationMs);
  }

  return { mounted, handleClose };
}
