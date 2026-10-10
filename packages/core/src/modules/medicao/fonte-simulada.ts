import { litros } from "../../util/num";
import type { FonteLeituras, LeituraExterna, LoteLeituras } from "./fonte-leituras.port";

const HORA = 3_600_000;
const FUSO_MS = -3 * HORA; // America/Sao_Paulo, sem horário de verão desde 2019
/** Começo do histórico simulado: meia-noite de 01/01/2025 em São Paulo. */
const EPOCA = Date.UTC(2025, 0, 1, 3);

/** Perfil horário doméstico de GLP: banho de manhã, almoço, banho e jantar à noite. */
const PERFIL = [0, 0, 0, 0, 0, 0.004, 0.05, 0.09, 0.05, 0.012, 0.01, 0.06, 0.085, 0.03, 0.008, 0.006, 0.008, 0.02, 0.06, 0.095, 0.07, 0.035, 0.015, 0.004];
/** Mais água quente no inverno. */
const ESTACAO = [0.85, 0.85, 0.9, 1.0, 1.15, 1.3, 1.35, 1.25, 1.1, 1.0, 0.9, 0.88];

function hash(s: string, n = 0): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Roteiro da demonstração, ancorado numa data fixa para o histórico nunca mudar de um dia pro outro. */
export interface Cenarios {
  ancora: Date;
  /** Medidores que param de transmitir 3 dias antes da âncora. */
  mudos: string[];
  /** Fluxo contínuo de madrugada 8 dias antes da âncora (possível vazamento). */
  vazamento: string[];
  /** Consumo alto 4 dias antes da âncora. */
  consumoAlto: string[];
  bateriaBaixa: string[];
}

export const CENARIOS_DEMO: Cenarios = {
  ancora: new Date(process.env.SIMULADA_ANCORA || "2026-10-10T03:00:00Z"),
  mudos: ["SIM-0015", "SIM-0024"],
  vazamento: ["SIM-0006"],
  consumoAlto: ["SIM-0009"],
  bateriaBaixa: ["SIM-0014"],
};

/**
 * Dublê da integração. Gera, de forma determinística a partir do id do medidor, o que um
 * DLA NB entregaria: uma leitura acumulada por hora, transmitida em lote uma vez por dia num
 * horário próprio de cada medidor (spec §8.1). Mesmo id + mesmo intervalo = mesmas leituras,
 * então sincronizar de novo nunca muda o passado.
 */
export class FonteSimulada implements FonteLeituras {
  readonly nome = "simulada";

  constructor(private readonly cenarios: Cenarios = CENARIOS_DEMO) {}

  /** Consumo (m³) na hora que começa em `inicioHora`. */
  consumoNaHora(id: string, inicioHora: number): number {
    const local = new Date(inicioHora + FUSO_MS);
    const h = local.getUTCHours(), dow = local.getUTCDay(), mes = local.getUTCMonth();
    const k = Math.round((inicioHora - EPOCA) / HORA);
    const r = (n: number) => hash(id, k * 4 + n);
    let base: number;
    if (id.includes("SALAO")) base = (dow === 0 || dow === 6) && h >= 11 && h <= 15 ? 0.12 : 0;
    else {
      const tamanho = 0.55 + hash(id, 7) * 0.95;
      base = PERFIL[h] * 0.25 * tamanho * ESTACAO[mes] * (dow === 0 || dow === 6 ? 1.15 : 1);
    }
    let v = r(0) < 0.22 ? 0 : base * (0.35 + 1.3 * r(1));
    if (base > 0.01 && r(2) < 0.01) v *= 2.2;
    const ancora = this.cenarios.ancora.getTime();
    /** A hora cai no dia local que começa `dias` dias antes da âncora (a âncora é meia-noite local). */
    const naAncora = (dias: number) => inicioHora >= ancora - dias * 24 * HORA && inicioHora < ancora - (dias - 1) * 24 * HORA;
    if (this.cenarios.vazamento.includes(id) && naAncora(8) && h >= 1 && h < 9) v += 0.011;
    if (this.cenarios.consumoAlto.includes(id) && naAncora(4) && h >= 17 && h < 23) v += 0.09;
    return litros(v);
  }

  private leituraInicial(id: string): number {
    return litros(180 + hash(id, 3) * 600);
  }

  /** Última transmissão até `agora`: uma por dia, no horário do medidor. */
  ultimaTransmissao(id: string, agora: Date): Date | null {
    let limite = agora.getTime();
    if (this.cenarios.mudos.includes(id)) limite = Math.min(limite, this.cenarios.ancora.getTime() - 3 * 24 * HORA);
    const horaTx = 2 + Math.floor(hash(id, 5) * 9);
    const local = new Date(limite + FUSO_MS);
    let tx = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), horaTx) - FUSO_MS;
    if (tx > limite) tx -= 24 * HORA;
    return tx < EPOCA ? null : new Date(tx);
  }

  async buscarLeituras(id: string, desde: Date, ate: Date): Promise<LoteLeituras> {
    const tx = this.ultimaTransmissao(id, ate);
    const leituras: LeituraExterna[] = [];
    if (tx) {
      const fim = Math.min(tx.getTime(), ate.getTime());
      let acumulado = this.leituraInicial(id);
      for (let t = EPOCA; t + HORA <= fim; t += HORA) {
        acumulado = litros(acumulado + this.consumoNaHora(id, t));
        const instante = t + HORA;
        if (instante > desde.getTime()) leituras.push({ instante: new Date(instante), valorM3: acumulado });
      }
    }
    const bateriaV = this.cenarios.bateriaBaixa.includes(id) ? 3.31 : Math.round((3.55 + hash(id, 9) * 0.07) * 100) / 100;
    return { idExterno: id, leituras, transmitidoEm: tx, bateriaV };
  }
}
