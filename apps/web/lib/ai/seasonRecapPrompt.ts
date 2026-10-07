import type { SeasonRecapAiInput } from "./types";

/**
 * Instrução compartilhada entre TODOS os provedores de IA — o texto do
 * prompt em si não é "do Gemini", é da FEATURE. Cada provider.ts
 * (gemini.ts, e um mistral.ts futuro, por exemplo) só cuida da
 * mecânica de chamar sua própria API; a substância do que pedimos pro
 * modelo mora aqui, uma vez só, pra qualquer provedor usar.
 *
 * Bump este número sempre que o TEXTO do prompt mudar de um jeito que
 * justifique regenerar recaps já gravados em cache (ver coluna
 * `prompt_version` em `season_recaps`) — sem isso, melhorar o prompt
 * não teria como invalidar recaps antigos gerados com a instrução
 * velha (`source_hash` só muda se o TMDB mudar o overview, não cobre
 * este caso).
 */
export const SEASON_RECAP_PROMPT_VERSION = 1;

export function buildSeasonRecapPrompt(input: SeasonRecapAiInput): string {
  const episodesText = input.episodes
    .map((ep) => `Episódio ${ep.episodeNumber}: ${ep.name}\n${ep.overview}`)
    .join("\n\n");

  const endingField = input.includeEnding
    ? `"whereItEnded": string — como a temporada termina, baseado SOMENTE na sinopse do último episódio acima, em texto corrido (1-2 frases)`
    : `"whereItEnded": null — não gere esta seção; a sinopse do episódio final não está disponível nos dados fornecidos`;

  return `Você é um redator que resume temporadas de séries de TV para um app de acompanhamento de séries, usando SOMENTE as sinopses de episódio fornecidas abaixo.

REGRA MAIS IMPORTANTE: nunca invente, deduza ou complete acontecimentos que não estejam EXPLICITAMENTE escritos nessas sinopses. Se uma informação não estiver nos dados fornecidos, deixe de fora — não tente adivinhar o que "provavelmente" aconteceu, mesmo que você reconheça a obra e saiba como a história continua. Use exclusivamente o material abaixo.

Série: ${input.seriesName}
Temporada: ${input.seasonNumber}

Sinopses dos episódios, em ordem cronológica:

${episodesText}

Gere um JSON com exatamente estes campos, sempre em português do Brasil:
{
  "inThirtySeconds": string — um resumo de 2-3 frases, que dá pra ler em uns 30 segundos,
  "keyEvents": string — os principais acontecimentos da temporada, em texto corrido,
  ${endingField}
}

Responda só com o JSON, sem nenhum texto antes ou depois, sem markdown.`;
}
