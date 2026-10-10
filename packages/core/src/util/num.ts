/** Colunas `numeric` chegam do driver como string; converte com segurança. */
export const num = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));

/** Arredonda para a resolução do medidor (1 litro = 0,001 m³). */
export const litros = (m3: number): number => Math.round(m3 * 1000) / 1000;
