/** Converte "30d", "24h", "1h", "90s" em milissegundos. */
export function parseDuration(valor: string, fallbackMs: number): number {
  const m = /^(\d+)([smhd])$/.exec(valor.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const mult = m[2] === "s" ? 1_000 : m[2] === "m" ? 60_000 : m[2] === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}
