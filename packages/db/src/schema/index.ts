import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Modelo de dados da spec §7.5. PKs uuidv7() nativo do Postgres 18 (mesma convenção do coda);
 * timestamps sempre timestamptz. Os nomes são NOSSOS: nada aqui depende do formato da Aépio.
 * O adaptador da integração traduz para estas tabelas (spec §8.2).
 */

const id = () => uuid().primaryKey().default(sql`uuidv7()`);
const criadoEm = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const ts = () => timestamp({ withTimezone: true });

export const tipoUnidade = pgEnum("tipo_unidade", ["residencial", "area_comum"]);
export const tipoConvite = pgEnum("tipo_convite", ["morador", "admin"]);

// ---------------------------------------------------------------- identidade

export const usuario = pgTable(
  "usuario",
  {
    id: id(),
    email: text().notNull(),
    nome: text().notNull(),
    senhaHash: text().notNull(),
    /** Dono da plataforma: enxerga todos os condomínios (DEC-001). */
    operador: boolean().notNull().default(false),
    createdAt: criadoEm(),
    updatedAt: criadoEm(),
  },
  (t) => [uniqueIndex("usuario_email_uq").on(t.email)],
);

export const sessao = pgTable(
  "sessao",
  {
    id: id(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    expiraEm: ts().notNull(),
    createdAt: criadoEm(),
  },
  (t) => [uniqueIndex("sessao_token_uq").on(t.tokenHash), index("sessao_usuario_idx").on(t.usuarioId)],
);

// ---------------------------------------------------------------- condomínio

export const condominio = pgTable("condominio", {
  id: id(),
  nome: text().notNull(),
  cidade: text(),
  fuso: text().notNull().default("America/Sao_Paulo"),
  /** RN-201: m³ → kg de GLP. */
  fatorM3Kg: numeric("fator_m3_kg", { precision: 6, scale: 3 }).notNull().default("2.300"),
  /** Qual adaptador de leituras atende este condomínio ("simulada" até a Aépio existir). */
  fonte: text().notNull().default("simulada"),
  ativo: boolean().notNull().default(true),
  createdAt: criadoEm(),
  updatedAt: criadoEm(),
});

export const bloco = pgTable(
  "bloco",
  {
    id: id(),
    condominioId: uuid()
      .notNull()
      .references(() => condominio.id, { onDelete: "cascade" }),
    nome: text().notNull(),
  },
  (t) => [uniqueIndex("bloco_nome_uq").on(t.condominioId, t.nome)],
);

export const unidade = pgTable(
  "unidade",
  {
    id: id(),
    blocoId: uuid()
      .notNull()
      .references(() => bloco.id, { onDelete: "cascade" }),
    identificacao: text().notNull(),
    tipo: tipoUnidade().notNull().default("residencial"),
  },
  (t) => [uniqueIndex("unidade_ident_uq").on(t.blocoId, t.identificacao)],
);

export const medidor = pgTable(
  "medidor",
  {
    id: id(),
    /** RN-404: medidor sem unidade fica em "não vinculados", mas as leituras são guardadas. */
    unidadeId: uuid().references(() => unidade.id, { onDelete: "set null" }),
    condominioId: uuid()
      .notNull()
      .references(() => condominio.id, { onDelete: "cascade" }),
    /** Identificador do equipamento na fonte externa (na Aépio, o id do DLA). */
    idExterno: text().notNull(),
    modelo: text(),
    inicio: ts().notNull().defaultNow(),
    /** RN-104: troca de medidor encerra o anterior. */
    fim: ts(),
    ultimaTransmissao: ts(),
    /** Cursor de sincronização: instante da leitura mais nova já importada (RN-402). */
    ultimoInstante: ts(),
    bateriaV: numeric({ precision: 4, scale: 2 }),
  },
  (t) => [uniqueIndex("medidor_externo_uq").on(t.idExterno), index("medidor_unidade_idx").on(t.unidadeId)],
);

// ---------------------------------------------------------------- medição

/** RN-100/101: leitura acumulada, única por (medidor, instante). */
export const leitura = pgTable(
  "leitura",
  {
    medidorId: uuid()
      .notNull()
      .references(() => medidor.id, { onDelete: "cascade" }),
    instante: ts().notNull(),
    valorM3: numeric("valor_m3", { precision: 14, scale: 3 }).notNull(),
    /** RN-102: leitura menor que a anterior. Guardada, mas não gera consumo. */
    anomala: boolean().notNull().default(false),
    importadaEm: criadoEm(),
  },
  (t) => [primaryKey({ columns: [t.medidorId, t.instante] })],
);

/** RN-105: consumo derivado por hora e medidor. Dia e mês saem daqui por agregação. */
export const consumoHora = pgTable(
  "consumo_hora",
  {
    medidorId: uuid()
      .notNull()
      .references(() => medidor.id, { onDelete: "cascade" }),
    hora: ts().notNull(),
    m3: numeric({ precision: 12, scale: 3 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.medidorId, t.hora] })],
);

// ---------------------------------------------------------------- acesso

/** RN-010/012: vínculo morador↔unidade com vigência. */
export const vinculo = pgTable(
  "vinculo",
  {
    id: id(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    unidadeId: uuid()
      .notNull()
      .references(() => unidade.id, { onDelete: "cascade" }),
    inicio: ts().notNull().defaultNow(),
    fim: ts(),
  },
  (t) => [index("vinculo_usuario_idx").on(t.usuarioId), index("vinculo_unidade_idx").on(t.unidadeId)],
);

export const papelAdmin = pgTable(
  "papel_admin",
  {
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    condominioId: uuid()
      .notNull()
      .references(() => condominio.id, { onDelete: "cascade" }),
    createdAt: criadoEm(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.condominioId] })],
);

/** RN-002: entrada só por convite, uso único, expira em 7 dias. */
export const convite = pgTable(
  "convite",
  {
    id: id(),
    tipo: tipoConvite().notNull(),
    email: text().notNull(),
    nome: text().notNull(),
    condominioId: uuid()
      .notNull()
      .references(() => condominio.id, { onDelete: "cascade" }),
    /** Só para convite de morador. */
    unidadeId: uuid().references(() => unidade.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    expiraEm: ts().notNull(),
    usadoEm: ts(),
    criadoPor: uuid().references(() => usuario.id, { onDelete: "set null" }),
    createdAt: criadoEm(),
  },
  (t) => [uniqueIndex("convite_token_uq").on(t.tokenHash), index("convite_condominio_idx").on(t.condominioId)],
);

// ---------------------------------------------------------------- tarifa

/** RN-200: preço com vigência. Fechamentos já feitos não mudam com tarifa nova. */
export const tarifa = pgTable("tarifa", {
  id: id(),
  condominioId: uuid()
    .notNull()
    .references(() => condominio.id, { onDelete: "cascade" }),
  precoKg: numeric({ precision: 10, scale: 4 }).notNull(),
  vigenteDesde: date().notNull(),
  createdAt: criadoEm(),
});
