/**
 * Porta da integração (spec §8.2). Estas são as NOSSAS estruturas: cada fonte externa (hoje o
 * dublê, amanhã a API da Aépio) tem um adaptador que traduz a resposta dela para cá. O resto do
 * sistema não sabe de onde as leituras vêm.
 */
export interface LeituraExterna {
  /** Fim da hora medida (ex.: 14:00 = acumulado no fim da hora 13:00–14:00). */
  instante: Date;
  /** Leitura acumulada do mostrador, em m³ (RN-100). */
  valorM3: number;
}

export interface LoteLeituras {
  idExterno: string;
  leituras: LeituraExterna[];
  /** Quando o dispositivo transmitiu pela última vez (null se nunca). */
  transmitidoEm: Date | null;
  bateriaV: number | null;
}

export interface FonteLeituras {
  readonly nome: string;
  /** Leituras com instante em (desde, ate], já disponíveis na fonte. */
  buscarLeituras(idExterno: string, desde: Date, ate: Date): Promise<LoteLeituras>;
}

/** Token de injeção do registro de fontes, indexado por `condominio.fonte`. */
export const FONTES_LEITURAS = Symbol("FONTES_LEITURAS");
export type RegistroFontes = Map<string, FonteLeituras>;
