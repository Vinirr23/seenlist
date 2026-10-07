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
 *
 * BUMP 1 → 2 (2026-10-07, polimento visual a pedido do usuário após o
 * 1º teste real): `keyEvents` deixa de ser texto corrido e passa a
 * array de acontecimentos discretos (agora `jsonb` no banco, ver
 * migration `20261007020000_season_recaps_key_events_jsonb.sql`), e
 * "Em 30 segundos" ficou mais curto/direto. Recaps gravados com
 * `prompt_version = 1` têm `key_events` no formato antigo (string) —
 * a comparação de versão na rota trata essas linhas como cache
 * inválido e regenera sozinha, sob demanda.
 */
export const SEASON_RECAP_PROMPT_VERSION = 2;

export function buildSeasonRecapPrompt(input: SeasonRecapAiInput): string {
  const episodesText = input.episodes
    .map((ep) => `Episódio ${ep.episodeNumber}: ${ep.name}\n${ep.overview}`)
    .join("\n\n");

  const endingField = input.includeEnding
    ? `"whereItEnded": string — como a temporada termina, baseado SOMENTE na sinopse do último episódio acima, em texto corrido (1-2 frases)`
    : `"whereItEnded": null — não gere esta seção; a sinopse do episódio final não está disponível nos dados fornecidos`;

  const KEY_EVENTS_EXAMPLE = [
    "Ana descobre que o namorado está escondendo uma dívida antiga.",
    "Joel se muda para o apartamento de cima e os dois começam a se evitar.",
    "A empresa da família enfrenta uma auditoria inesperada.",
    "Ana e Joel são forçados a trabalhar juntos num projeto.",
    "A temporada termina com os dois finalmente se acertando.",
  ];

  return `Você é um redator que resume temporadas de séries de TV para um app de acompanhamento de séries, usando SOMENTE as sinopses de episódio fornecidas abaixo.

REGRA MAIS IMPORTANTE: nunca invente, deduza ou complete acontecimentos que não estejam EXPLICITAMENTE escritos nessas sinopses. Se uma informação não estiver nos dados fornecidos, deixe de fora — não tente adivinhar o que "provavelmente" aconteceu, mesmo que você reconheça a obra e saiba como a história continua. Use exclusivamente o material abaixo.

Série: ${input.seriesName}
Temporada: ${input.seasonNumber}

Sinopses dos episódios, em ordem cronológica:

${episodesText}

Gere um JSON com exatamente estes campos, sempre em português do Brasil:
{
  "inThirtySeconds": string — um resumo BEM direto de NO MÁXIMO 2-3 frases curtas, que dá pra ler de verdade em uns 30 segundos — não é um resumo completo, é só o essencial pra quem não vai ler o resto,
  "keyEvents": array de strings — os principais acontecimentos da temporada, cada item uma frase curta e autocontida descrevendo UM acontecimento discreto (nunca um parágrafo só, nunca juntar vários acontecimentos numa frase com "e"), em ordem cronológica, tipicamente entre 4 e 7 itens. Exemplo do formato esperado (conteúdo de outra série, só pra ilustrar o formato): ${JSON.stringify(KEY_EVENTS_EXAMPLE)},
  ${endingField}
}

Responda só com o JSON, sem nenhum texto antes ou depois, sem markdown.`;
}
