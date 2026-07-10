export interface FormattedDuration {
  /** Maior unidade — o "valor grande" do card. */
  primary: string;
  /** Unidades menores restantes — o subtexto, quando fizer sentido mostrar. */
  secondary?: string;
}

function unit(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Ajuste (Perfil — Estatísticas): "o componente deve converter
 * automaticamente para anos/meses/dias quando necessário". Sempre
 * mostra a maior unidade não-zero como valor principal, e as duas
 * unidades seguintes (se houver) como subtexto — bate com os dois
 * exemplos da tarefa ("14 meses / 8 dias / 1 hora" e "327 dias").
 */
export function formatWatchDuration(totalMinutes: number): FormattedDuration {
  if (totalMinutes <= 0) return { primary: "0 horas" };

  const totalHours = Math.round(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const years = Math.floor(totalDays / 365);
  const remDaysAfterYears = totalDays % 365;
  const months = Math.floor(remDaysAfterYears / 30);
  const days = remDaysAfterYears % 30;

  if (years > 0) {
    const secondary = [months > 0 ? unit(months, "mês", "meses") : null, days > 0 ? unit(days, "dia", "dias") : null]
      .filter(Boolean)
      .join(" · ");
    return { primary: unit(years, "ano", "anos"), secondary: secondary || undefined };
  }

  if (months > 0) {
    const secondary = [
      days > 0 ? unit(days, "dia", "dias") : null,
      remHours > 0 ? unit(remHours, "hora", "horas") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { primary: unit(months, "mês", "meses"), secondary: secondary || undefined };
  }

  if (totalDays > 0) {
    return {
      primary: unit(totalDays, "dia", "dias"),
      secondary: remHours > 0 ? unit(remHours, "hora", "horas") : undefined,
    };
  }

  return { primary: unit(totalHours, "hora", "horas") };
}
