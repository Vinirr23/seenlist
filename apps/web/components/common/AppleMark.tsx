/**
 * A PEDIDO (2026-10-08, reportado — "os símbolos da apple e do
 * android nos bullets estão muito pequenos"/"visualmente feias") —
 * causa raiz: `public/apple-mark.png` (usado pelo componente `Apple`
 * de `components/landing/shared.tsx`) é um PNG de 320×320 em paleta
 * de cor reduzida, cinza chapado sem nitidez — ficava borrado e sem
 * contraste ao ser ampliado. A rede deste sandbox bloqueia até sites
 * de terceiros (não só o domínio do próprio app), então não deu pra
 * baixar o selo oficial da Apple aqui — pra não usar um arquivo de
 * procedência duvidosa (agregadores de logo não oficiais), o símbolo
 * foi reconstruído como SVG vetorial (mesmo path usado por
 * bibliotecas de ícone de marca conhecidas), preenchimento sólido via
 * `currentColor` — sempre nítido em qualquer tamanho, sem depender de
 * PNG nenhum. Usado em `ProfileAppPromoModal.tsx` e
 * `MobileAppPromoBanner.tsx` (os dois pontos que mostravam o ícone
 * antigo) — `components/landing/shared.tsx`/`Apple` (usado na landing
 * page) ficou como estava, fora do escopo deste pedido.
 */
export function AppleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.05 12.536c-.03-2.953 2.42-4.374 2.53-4.44-1.38-2.016-3.524-2.293-4.282-2.317-1.824-.186-3.56 1.075-4.484 1.075-.925 0-2.348-1.05-3.86-1.02-1.986.03-3.822 1.155-4.846 2.934-2.07 3.587-.53 8.9 1.486 11.812.986 1.424 2.158 3.017 3.698 2.96 1.486-.06 2.045-.96 3.84-.96 1.793 0 2.296.96 3.868.93 1.596-.027 2.606-1.448 3.58-2.878 1.13-1.646 1.595-3.24 1.62-3.322-.035-.016-3.11-1.194-3.14-4.734zM14.17 4.03c.814-.986 1.363-2.355 1.213-3.72-1.17.047-2.588.78-3.432 1.766-.754.86-1.414 2.267-1.238 3.6 1.33.102 2.65-.673 3.457-1.646z" />
    </svg>
  );
}
