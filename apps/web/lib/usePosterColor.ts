import { useEffect, useState } from "react";

/**
 * A PEDIDO — "cores extraídas dos pôsteres" pra dar identidade visual
 * a cada tela do "Seu ano". Não existe esse dado em lugar nenhum —
 * precisa ser calculado de verdade, lendo os pixels da imagem.
 *
 * Amostra 20x20 pixels (pequeno de propósito — rápido, e não
 * precisamos de precisão, só uma cor média razoável). Filtra pixels
 * muito escuros, muito claros ou muito acinzentados (baixa diferença
 * entre R/G/B) antes de tirar a média — sem isso, pôsteres com muita
 * área preta/branca (comum em cartaz de filme) puxam a média pra um
 * cinza sem graça; filtrando, sobra só a cor que realmente "aparece"
 * no pôster.
 *
 * `crossOrigin="anonymous"` é necessário pra o Canvas conseguir ler
 * os pixels de uma imagem de outro domínio (image.tmdb.org) — sem
 * isso, o navegador bloqueia a leitura por segurança ("tainted
 * canvas"). Se der errado por qualquer motivo (rede, CORS, imagem
 * corrompida), falha em silêncio — quem usa o hook recebe `null` e
 * cai no tema padrão (âmbar), nunca quebra a tela.
 */
export function usePosterColor(posterUrl: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    setColor(null);
    if (!posterUrl) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 20;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let usedPixels = 0;
        let rAll = 0;
        let gAll = 0;
        let bAll = 0;
        const totalPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i] ?? 0;
          const pg = data[i + 1] ?? 0;
          const pb = data[i + 2] ?? 0;
          rAll += pr;
          gAll += pg;
          bAll += pb;

          const brightness = (pr + pg + pb) / 3;
          const saturationSpread = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
          const isUsable = brightness > 25 && brightness < 230 && saturationSpread > 15;
          if (isUsable) {
            r += pr;
            g += pg;
            b += pb;
            usedPixels++;
          }
        }

        if (usedPixels > totalPixels * 0.05) {
          r = Math.round(r / usedPixels);
          g = Math.round(g / usedPixels);
          b = Math.round(b / usedPixels);
        } else {
          // Pôster quase todo neutro (preto/branco/cinza) — usa a média geral mesmo, sem filtro.
          r = Math.round(rAll / totalPixels);
          g = Math.round(gAll / totalPixels);
          b = Math.round(bAll / totalPixels);
        }

        if (!cancelled) setColor(`${r} ${g} ${b}`);
      } catch (error) {
        console.error("[usePosterColor] Falha ao extrair cor (provável bloqueio de CORS)", error);
      }
    };
    img.onerror = () => {
      // Falha de rede ao carregar o pôster — silencioso, cai no tema padrão.
    };
    img.src = posterUrl;

    return () => {
      cancelled = true;
    };
  }, [posterUrl]);

  return color;
}
