import type { useTranslation } from "./i18n/LocaleProvider";

export interface FormattedDuration {
  /** Maior unidade — o "valor grande" do card. */
  primary: string;
  /** Unidades menores restantes — o subtexto, quando fizer sentido mostrar. */
  secondary?: string;
}

type TFunction = ReturnType<typeof useTranslation>["t"];

function unit(n: number, t: TFunction, singularKey: string, pluralKey: string): string {
  return t(n === 1 ? singularKey : pluralKey, { n });
}

/**
 * Ajuste (Perfil — Estatísticas): "o componente deve converter
 * automaticamente para anos/meses/dias quando necessário". Sempre
 * mostra a maior unidade não-zero como valor principal, e as duas
 * unidades seguintes (se houver) como subtexto — bate com os dois
 * exemplos da tarefa ("14 meses / 8 dias / 1 hora" e "327 dias").
 *
 * Correção (bug real, achado pelo usuário testando em inglês) —
 * essa função devolvia "ano"/"mês"/"dia"/"hora" fixos em português,
 * sem passar pelo sistema de tradução — só o RESTO da tela de
 * Estatísticas tinha sido traduzido, esse valor específico não.
 * Agora recebe `t()` como parâmetro (assim como os componentes que
 * chamam esta função) em vez de montar o texto direto.
 */
export function formatWatchDuration(totalMinutes: number, t: TFunction): FormattedDuration {
  if (totalMinutes <= 0) return { primary: t("duration.zeroHours") };

  const totalHours = Math.round(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const years = Math.floor(totalDays / 365);
  const remDaysAfterYears = totalDays % 365;
  const months = Math.floor(remDaysAfterYears / 30);
  const days = remDaysAfterYears % 30;

  if (years > 0) {
    const secondary = [
      months > 0 ? unit(months, t, "duration.month", "duration.months") : null,
      days > 0 ? unit(days, t, "duration.day", "duration.days") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { primary: unit(years, t, "duration.year", "duration.years"), secondary: secondary || undefined };
  }

  if (months > 0) {
    const secondary = [
      days > 0 ? unit(days, t, "duration.day", "duration.days") : null,
      remHours > 0 ? unit(remHours, t, "duration.hour", "duration.hours") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { primary: unit(months, t, "duration.month", "duration.months"), secondary: secondary || undefined };
  }

  if (totalDays > 0) {
    return {
      primary: unit(totalDays, t, "duration.day", "duration.days"),
      secondary: remHours > 0 ? unit(remHours, t, "duration.hour", "duration.hours") : undefined,
    };
  }

  return { primary: unit(totalHours, t, "duration.hour", "duration.hours") };
}
