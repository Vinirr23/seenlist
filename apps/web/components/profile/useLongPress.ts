import { useRef } from "react";

const LONG_PRESS_MS = 500;

/**
 * Pointer events cobrem touch e mouse com a mesma API — não precisa
 * de handlers separados pra cada um. `suppressNextClick` evita que o
 * `<Link>` por baixo navegue pra série quando o gesto foi na verdade
 * um long press (sem isso, soltar o dedo depois de segurar também
 * dispara um clique normal).
 */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const start = () => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const onClickCapture = (event: React.MouseEvent) => {
    if (firedRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClickCapture,
  };
}
