import { litros } from "../../util/num";

export interface PontoLeitura {
  instante: Date;
  valorM3: number;
}

export interface ResultadoDerivacao {
  /** Consumo por hora: `hora` é o INÍCIO da hora medida. */
  consumos: { hora: Date; m3: number }[];
  /** RN-102: leituras menores que a anterior. */
  anomalas: Date[];
}

const HORA = 3_600_000;

/**
 * RN-100/102/104: o consumo é sempre derivado da diferença entre leituras acumuladas.
 * - A diferença vai para a hora que termina no instante da leitura. Se houve buraco (horas sem
 *   leitura), o consumo acumulado no buraco aparece inteiro nessa hora: nada se perde.
 * - Leitura menor que a anterior é anômala (troca de medidor, virada, erro): não gera consumo
 *   negativo e vira a nova base.
 * `anterior` é a última leitura já conhecida antes do lote, para a primeira hora ter base.
 */
export function derivarConsumo(leituras: PontoLeitura[], anterior?: PontoLeitura | null): ResultadoDerivacao {
  const consumos: ResultadoDerivacao["consumos"] = [];
  const anomalas: Date[] = [];
  let base = anterior?.valorM3 ?? null;
  for (const l of leituras) {
    if (base == null) {
      base = l.valorM3;
      continue;
    }
    const diff = litros(l.valorM3 - base);
    const hora = new Date(l.instante.getTime() - HORA);
    if (diff < 0) {
      anomalas.push(l.instante);
      consumos.push({ hora, m3: 0 });
    } else {
      consumos.push({ hora, m3: diff });
    }
    base = l.valorM3;
  }
  return { consumos, anomalas };
}
