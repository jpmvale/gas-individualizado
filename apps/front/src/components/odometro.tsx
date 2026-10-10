import { nf } from "@/lib/formato";

/** Leitura no formato do mostrador do medidor: 5 dígitos de m³ e 3 vermelhos de litros. */
export function Odometro({ valor }: { valor: number }) {
  const [int, dec] = nf(valor, 3).replace(/\./g, "").split(",");
  return (
    <span className="odo" aria-label={`${nf(valor, 3)} metros cúbicos`}>
      {int.padStart(5, "0").split("").map((c, i) => <span key={`i${i}`}>{c}</span>)}
      <span className="sep">,</span>
      {dec.split("").map((c, i) => <span key={`d${i}`} className="red">{c}</span>)}
      <span className="unit">m³</span>
    </span>
  );
}

export function Chama() {
  return (
    <svg className="flame" viewBox="0 0 18 22" aria-hidden="true">
      <path fill="var(--accent)" d="M9 0C10 5 16 8 16 14a7 7 0 0 1-14 0c0-3 1.6-5 3.2-6.4C5.6 10 6.8 11 8 11 8 7 7.5 3.5 9 0Z" />
      <path fill="var(--surface)" d="M9 9.5c.6 2.4 3.4 3.6 3.4 6.4a3.4 3.4 0 0 1-6.8 0c0-1.6 1-2.6 1.8-3.3.3 1.1.9 1.6 1.5 1.6 0-1.8-.3-3.2.1-4.7Z" />
    </svg>
  );
}
