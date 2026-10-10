/** Formatação pt-BR. Datas de série chegam como texto no fuso do condomínio ("2026-10-02T05:00"). */
export const nf = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const diaMes = (periodo: string) => `${periodo.slice(8, 10)}/${periodo.slice(5, 7)}`;
export const diaSemana = (periodo: string) => DIAS_SEMANA[new Date(`${periodo.slice(0, 10)}T12:00:00Z`).getUTCDay()];

/** Data local AAAA-MM-DD somando dias (sem fuso: aritmética de calendário). */
export function somaDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "hoje, 06:00" / "ontem, 14:00" / "07/10, 05:00" no fuso de São Paulo. */
export function quando(iso: string | null): string {
  if (!iso) return "nunca";
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const d = new Date(iso);
  const h = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86_400_000);
  if (fmt(d) === fmt(hoje)) return `hoje, ${h}`;
  if (fmt(d) === fmt(ontem)) return `ontem, ${h}`;
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}, ${h}`;
}

export const SITUACAO: Record<string, [string, string]> = {
  normal: ["good", "Normal"],
  sem_comunicacao: ["crit", "Sem comunicação"],
  bateria_baixa: ["warn", "Bateria baixa"],
  sem_medidor: ["neutral", "Sem medidor"],
};
