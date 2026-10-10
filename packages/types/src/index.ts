/** Tipos de domínio compartilhados entre db, core e apps (spec §2 e §3). */

/** Papel do usuário num condomínio (DEC-001). O operador é global e fica fora desta lista. */
export type Papel = "morador" | "admin";

/** RN-206: área comum é uma unidade sem morador. */
export type TipoUnidade = "residencial" | "area_comum";

/** Tipo de convite (RN-002): para morador de uma unidade ou admin de um condomínio. */
export type TipoConvite = "morador" | "admin";

/** Granularidade das séries de consumo (RN-105). */
export type Granularidade = "hora" | "dia" | "mes";

/** Fuso em que o dia e o mês fecham (RN-105). */
export const FUSO_PADRAO = "America/Sao_Paulo";
