/**
 * Interface desacoplada de provedor de IA — TASK (Resumo da Temporada).
 * A rota /api/season-recap conhece só este contrato, nunca a chamada
 * HTTP de um provedor específico (ver `getAiProvider.ts`). Trocar de
 * provedor depois (Gemini → Mistral, por exemplo) é escrever um novo
 * arquivo em `providers/` implementando esta interface e adicionar um
 * `case` na fábrica — zero mudança na lógica da feature (cache, regra
 * de cobertura, prompt de alto nível, que mora em
 * `seasonRecapPrompt.ts`, compartilhado entre qualquer provedor).
 *
 * IMPORTANTE (privacidade, a pedido explícito do usuário) — `episodes`
 * só pode conter dado PÚBLICO do TMDB (nome e sinopse do episódio).
 * Quem monta este objeto (a rota) nunca deve incluir id de usuário,
 * perfil, histórico de visualização ou qualquer dado identificável —
 * o próprio formato deste tipo já não tem campo nenhum pra isso.
 */
export interface SeasonRecapAiInput {
  seriesName: string;
  seasonNumber: number;
  episodes: { episodeNumber: number; name: string; overview: string }[];
  /**
   * false quando o episódio final da temporada não passou a checagem
   * de overview utilizável (seção 7 da auditoria) — o provedor NÃO
   * deve gerar "onde terminou" nesse caso, nunca inferir.
   */
  includeEnding: boolean;
}

export interface SeasonRecapAiOutput {
  inThirtySeconds: string;
  keyEvents: string;
  whereItEnded: string | null;
}

export interface AiProvider {
  /** Gravado em `season_recaps.ai_provider` — auditoria de qual provedor gerou cada linha. */
  readonly name: string;
  generateSeasonRecap(input: SeasonRecapAiInput): Promise<SeasonRecapAiOutput>;
}
