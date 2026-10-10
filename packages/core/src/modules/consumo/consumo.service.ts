import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Database } from "@gas/db";
import type { Granularidade } from "@gas/types";

import { DATABASE } from "../../db/db.module";
import { num } from "../../util/num";

const FORMATO: Record<Granularidade, string> = { hora: 'YYYY-MM-DD"T"HH24:00', dia: "YYYY-MM-DD", mes: "YYYY-MM" };
const UNIDADE_SQL: Record<Granularidade, string> = { hora: "hour", dia: "day", mes: "month" };
/** O `execute` cru devolve timestamps como texto; normaliza para Date. */
const dt = (v: unknown): Date | null => (v == null ? null : v instanceof Date ? v : new Date(String(v)));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** RN-005: média do condomínio só com 5+ unidades no período, para não permitir dedução. */
export const MINIMO_PARA_MEDIA = 5;
/** RN-302: sem transmissão há mais de 36 horas = sensor mudo. */
export const LIMITE_MUDO_MS = 36 * 3_600_000;
/** Bateria do DLA (3,6 V nominal) abaixo disto pede troca. */
export const BATERIA_BAIXA_V = 3.4;

export interface PontoSerie {
  periodo: string;
  m3: number;
  mediaCondominio: number | null;
}

type Linha = Record<string, unknown>;

/**
 * Consultas de consumo (UC-02, UC-03, UC-13). Datas de entrada e os rótulos de saída estão no
 * fuso do condomínio (o dia fecha à meia-noite local, RN-105); o banco guarda tudo em UTC.
 */
@Injectable()
export class ConsumoService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private async linhas(q: ReturnType<typeof sql>): Promise<Linha[]> {
    return (await this.db.execute(q)) as unknown as Linha[];
  }

  async condominio(condominioId: string) {
    const [c] = await this.linhas(sql`
      SELECT c.id, c.nome, c.cidade, c.fuso, c.fator_m3_kg AS fator,
        (SELECT t.preco_kg FROM tarifa t WHERE t.condominio_id = c.id
           AND t.vigente_desde <= (now() AT TIME ZONE c.fuso)::date
         ORDER BY t.vigente_desde DESC LIMIT 1) AS preco_kg,
        to_char(now() AT TIME ZONE c.fuso, 'YYYY-MM-DD') AS hoje
      FROM condominio c WHERE c.id = ${condominioId}`);
    if (!c) throw new NotFoundException("Condomínio não encontrado.");
    return {
      id: String(c.id),
      nome: String(c.nome),
      cidade: (c.cidade as string | null) ?? null,
      fuso: String(c.fuso),
      fatorM3Kg: num(c.fator as string),
      precoKg: c.preco_kg == null ? null : num(c.preco_kg as string),
      hoje: String(c.hoje),
    };
  }

  /** Série de uma unidade com a média do condomínio no mesmo período (RN-005). */
  async serieUnidade(unidadeId: string, condominioId: string, gran: Granularidade, de: string, ate: string, desde: Date | null): Promise<PontoSerie[]> {
    if (!FORMATO[gran]) throw new BadRequestException("Granularidade inválida.");
    if (!DATA.test(de) || !DATA.test(ate) || de >= ate) throw new BadRequestException("Período inválido: use de < ate no formato AAAA-MM-DD.");
    const { fuso } = await this.condominio(condominioId);
    const fmt = FORMATO[gran];
    const trunc = UNIDADE_SQL[gran];
    const inicio = sql`(${de}::timestamp AT TIME ZONE ${fuso})`;
    const fim = sql`(${ate}::timestamp AT TIME ZONE ${fuso})`;
    const piso = desde ? sql`AND ch.hora >= ${desde.toISOString()}::timestamptz` : sql``;
    const minhas = await this.linhas(sql`
      SELECT to_char(date_trunc(${trunc}, ch.hora AT TIME ZONE ${fuso}), ${fmt}) AS periodo, sum(ch.m3) AS m3
      FROM consumo_hora ch JOIN medidor m ON m.id = ch.medidor_id
      WHERE m.unidade_id = ${unidadeId} AND ch.hora >= ${inicio} AND ch.hora < ${fim} ${piso}
      GROUP BY 1 ORDER BY 1`);
    const medias = await this.linhas(sql`
      WITH por_unidade AS (
        SELECT to_char(date_trunc(${trunc}, ch.hora AT TIME ZONE ${fuso}), ${fmt}) AS periodo, m.unidade_id, sum(ch.m3) AS m3
        FROM consumo_hora ch
        JOIN medidor m ON m.id = ch.medidor_id
        JOIN unidade u ON u.id = m.unidade_id
        JOIN bloco b ON b.id = u.bloco_id
        WHERE b.condominio_id = ${condominioId} AND u.tipo = 'residencial'
          AND ch.hora >= ${inicio} AND ch.hora < ${fim}
        GROUP BY 1, 2)
      SELECT periodo, avg(m3) AS media, count(*) AS n FROM por_unidade GROUP BY 1`);
    const mapa = new Map(medias.map((r) => [String(r.periodo), num(r.n as string) >= MINIMO_PARA_MEDIA ? num(r.media as string) : null]));
    return minhas.map((r) => ({ periodo: String(r.periodo), m3: num(r.m3 as string), mediaCondominio: mapa.get(String(r.periodo)) ?? null }));
  }

  /** UC-02: o painel do morador. */
  async resumoUnidade(unidadeId: string, condominioId: string, desde: Date | null) {
    const cond = await this.condominio(condominioId);
    const piso = desde ? sql`AND ch.hora >= ${desde.toISOString()}::timestamptz` : sql``;
    const [u] = await this.linhas(sql`
      SELECT u.id, u.identificacao, u.tipo, b.nome AS bloco,
        m.id_externo, m.modelo, m.ultima_transmissao, m.ultimo_instante, m.bateria_v,
        (SELECT l.valor_m3 FROM leitura l WHERE l.medidor_id = m.id ORDER BY l.instante DESC LIMIT 1) AS leitura_atual
      FROM unidade u JOIN bloco b ON b.id = u.bloco_id
      LEFT JOIN medidor m ON m.unidade_id = u.id AND m.fim IS NULL
      WHERE u.id = ${unidadeId}`);
    if (!u) throw new NotFoundException("Unidade não encontrada.");
    const [tot] = await this.linhas(sql`
      SELECT
        coalesce(sum(ch.m3) FILTER (WHERE ch.hora >= (date_trunc('month', now() AT TIME ZONE ${cond.fuso}) AT TIME ZONE ${cond.fuso})), 0) AS mes,
        coalesce(sum(ch.m3) FILTER (WHERE ch.hora >= (date_trunc('day', now() AT TIME ZONE ${cond.fuso}) AT TIME ZONE ${cond.fuso})), 0) AS hoje,
        extract(epoch FROM (date_trunc('month', now() AT TIME ZONE ${cond.fuso}) + interval '1 month' - date_trunc('month', now() AT TIME ZONE ${cond.fuso}))) / 86400 AS dias_no_mes,
        to_char(date_trunc('month', now() AT TIME ZONE ${cond.fuso}), 'YYYY-MM') AS mes_ref
      FROM consumo_hora ch JOIN medidor m ON m.id = ch.medidor_id
      WHERE m.unidade_id = ${unidadeId} ${piso}`);
    const ultimoInstante = dt(u.ultimo_instante);
    const m3Mes = num(tot.mes as string);
    // Projeção: ritmo do mês até a última leitura recebida, estendido ao mês inteiro.
    const inicioMes = await this.linhas(sql`SELECT (date_trunc('month', now() AT TIME ZONE ${cond.fuso}) AT TIME ZONE ${cond.fuso}) AS t`);
    const diasComDados = ultimoInstante ? (ultimoInstante.getTime() - dt(inicioMes[0].t)!.getTime()) / 86_400_000 : 0;
    const projecaoM3 = diasComDados >= 1 ? (m3Mes / diasComDados) * num(tot.dias_no_mes as string) : null;

    // Janela dos últimos 30 dias completos antes da última leitura.
    let comparacao: { mediaDiaria: number; mediaCondominio: number | null; dias: number; de: string; ate: string } | null = null;
    if (ultimoInstante) {
      const [j] = await this.linhas(sql`
        SELECT to_char((${ultimoInstante.toISOString()}::timestamptz AT TIME ZONE ${cond.fuso})::date - 30, 'YYYY-MM-DD') AS de,
               to_char((${ultimoInstante.toISOString()}::timestamptz AT TIME ZONE ${cond.fuso})::date, 'YYYY-MM-DD') AS ate`);
      const serie = await this.serieUnidade(unidadeId, condominioId, "dia", String(j.de), String(j.ate), desde);
      if (serie.length) {
        const mediaDiaria = serie.reduce((s, p) => s + p.m3, 0) / serie.length;
        const comMedia = serie.filter((p) => p.mediaCondominio != null);
        comparacao = {
          mediaDiaria,
          mediaCondominio: comMedia.length ? comMedia.reduce((s, p) => s + (p.mediaCondominio ?? 0), 0) / comMedia.length : null,
          dias: serie.length,
          de: String(j.de),
          ate: String(j.ate),
        };
      }
    }
    const kg = (m3: number) => m3 * cond.fatorM3Kg;
    const reais = (m3: number) => (cond.precoKg == null ? null : kg(m3) * cond.precoKg);
    return {
      unidade: { id: String(u.id), identificacao: String(u.identificacao), bloco: String(u.bloco), tipo: String(u.tipo) },
      condominio: { id: cond.id, nome: cond.nome, fatorM3Kg: cond.fatorM3Kg, precoKg: cond.precoKg },
      medidor: u.id_externo
        ? {
            idExterno: String(u.id_externo),
            modelo: (u.modelo as string | null) ?? null,
            ultimaTransmissao: dt(u.ultima_transmissao),
            dadosAte: ultimoInstante,
            bateriaV: u.bateria_v == null ? null : num(u.bateria_v as string),
            leituraAtualM3: u.leitura_atual == null ? null : num(u.leitura_atual as string),
          }
        : null,
      mes: { referencia: String(tot.mes_ref), m3: m3Mes, kg: kg(m3Mes), valor: reais(m3Mes), projecaoValor: projecaoM3 == null ? null : reais(projecaoM3) },
      hoje: { m3: num(tot.hoje as string) },
      comparacao,
    };
  }

  /** UC-13: painel do condomínio. */
  async painelCondominio(condominioId: string) {
    const cond = await this.condominio(condominioId);
    const unidades = await this.unidadesDoCondominio(condominioId);
    const m3Mes = unidades.reduce((s, u) => s + u.m3Mes, 0);
    const [fimRef] = await this.linhas(sql`
      SELECT to_char((max(m.ultimo_instante) AT TIME ZONE ${cond.fuso})::date, 'YYYY-MM-DD') AS ate
      FROM medidor m WHERE m.condominio_id = ${condominioId} AND m.fim IS NULL`);
    let porDia: { periodo: string; m3: number; medidores: number }[] = [];
    if (fimRef?.ate) {
      const ate = String(fimRef.ate);
      const linhas = await this.linhas(sql`
        SELECT to_char((ch.hora AT TIME ZONE ${cond.fuso})::date, 'YYYY-MM-DD') AS periodo, sum(ch.m3) AS m3, count(DISTINCT ch.medidor_id) AS medidores
        FROM consumo_hora ch JOIN medidor m ON m.id = ch.medidor_id
        WHERE m.condominio_id = ${condominioId}
          AND ch.hora >= ((${ate}::date - 30)::timestamp AT TIME ZONE ${cond.fuso})
          AND ch.hora < (${ate}::timestamp AT TIME ZONE ${cond.fuso})
        GROUP BY 1 ORDER BY 1`);
      porDia = linhas.map((r) => ({ periodo: String(r.periodo), m3: num(r.m3 as string), medidores: num(r.medidores as string) }));
    }
    const comMedidor = unidades.filter((u) => u.medidor);
    return {
      condominio: { id: cond.id, nome: cond.nome, cidade: cond.cidade, fatorM3Kg: cond.fatorM3Kg, precoKg: cond.precoKg },
      mes: { m3: m3Mes, kg: m3Mes * cond.fatorM3Kg, valor: cond.precoKg == null ? null : m3Mes * cond.fatorM3Kg * cond.precoKg },
      medidores: { total: comMedidor.length, semComunicacao: comMedidor.filter((u) => u.situacao === "sem_comunicacao").length },
      pendencias: unidades.filter((u) => u.situacao !== "normal"),
      maiorConsumo: unidades
        .filter((u) => u.tipo === "residencial" && u.mediaDiariaMes != null)
        .sort((a, b) => (b.mediaDiariaMes ?? 0) - (a.mediaDiariaMes ?? 0))
        .slice(0, 5),
      porDia,
    };
  }

  /** UC-10/13: unidades com medidor, moradores e situação. */
  async unidadesDoCondominio(condominioId: string) {
    const cond = await this.condominio(condominioId);
    const linhas = await this.linhas(sql`
      SELECT u.id, u.identificacao, u.tipo, b.nome AS bloco,
        m.id_externo, m.modelo, m.ultima_transmissao, m.ultimo_instante, m.bateria_v,
        (SELECT string_agg(us.nome, ', ' ORDER BY us.nome) FROM vinculo v JOIN usuario us ON us.id = v.usuario_id
          WHERE v.unidade_id = u.id AND (v.fim IS NULL OR v.fim > now())) AS moradores,
        (SELECT coalesce(sum(ch.m3), 0) FROM consumo_hora ch JOIN medidor mm ON mm.id = ch.medidor_id
          WHERE mm.unidade_id = u.id
            AND ch.hora >= (date_trunc('month', now() AT TIME ZONE ${cond.fuso}) AT TIME ZONE ${cond.fuso})) AS m3_mes,
        (date_trunc('month', now() AT TIME ZONE ${cond.fuso}) AT TIME ZONE ${cond.fuso}) AS inicio_mes
      FROM unidade u JOIN bloco b ON b.id = u.bloco_id
      LEFT JOIN medidor m ON m.unidade_id = u.id AND m.fim IS NULL
      WHERE b.condominio_id = ${condominioId}
      ORDER BY u.tipo, b.nome, length(u.identificacao), u.identificacao`);
    const agora = Date.now();
    const base = linhas.map((r) => {
      const ultimaTx = dt(r.ultima_transmissao);
      const dadosAte = dt(r.ultimo_instante);
      const bateria = r.bateria_v == null ? null : num(r.bateria_v as string);
      const m3Mes = num(r.m3_mes as string);
      const dias = dadosAte ? (dadosAte.getTime() - dt(r.inicio_mes)!.getTime()) / 86_400_000 : 0;
      let situacao: "normal" | "sem_comunicacao" | "bateria_baixa" | "sem_medidor" = "normal";
      if (!r.id_externo) situacao = "sem_medidor";
      else if (!ultimaTx || agora - ultimaTx.getTime() > LIMITE_MUDO_MS) situacao = "sem_comunicacao";
      else if (bateria != null && bateria < BATERIA_BAIXA_V) situacao = "bateria_baixa";
      return {
        id: String(r.id),
        identificacao: String(r.identificacao),
        bloco: String(r.bloco),
        tipo: String(r.tipo) as "residencial" | "area_comum",
        moradores: (r.moradores as string | null) ?? null,
        medidor: r.id_externo ? { idExterno: String(r.id_externo), modelo: (r.modelo as string | null) ?? null, ultimaTransmissao: ultimaTx, dadosAte, bateriaV: bateria } : null,
        m3Mes,
        mediaDiariaMes: dias >= 1 ? m3Mes / dias : null,
        situacao,
        vsMedia: null as number | null,
      };
    });
    const residenciais = base.filter((u) => u.tipo === "residencial" && u.mediaDiariaMes != null);
    if (residenciais.length >= MINIMO_PARA_MEDIA) {
      const media = residenciais.reduce((s, u) => s + (u.mediaDiariaMes ?? 0), 0) / residenciais.length;
      for (const u of residenciais) u.vsMedia = media > 0 ? ((u.mediaDiariaMes ?? 0) / media - 1) * 100 : null;
    }
    return base;
  }

  /** UC-11: moradores com vínculo vigente e convites ainda abertos. */
  async moradoresDoCondominio(condominioId: string) {
    const ativos = await this.linhas(sql`
      SELECT v.id, us.nome, us.email, v.inicio, u.id AS unidade_id, u.identificacao, b.nome AS bloco
      FROM vinculo v JOIN usuario us ON us.id = v.usuario_id
      JOIN unidade u ON u.id = v.unidade_id JOIN bloco b ON b.id = u.bloco_id
      WHERE b.condominio_id = ${condominioId} AND (v.fim IS NULL OR v.fim > now())
      ORDER BY b.nome, length(u.identificacao), u.identificacao`);
    const convites = await this.linhas(sql`
      SELECT c.id, c.nome, c.email, c.tipo, c.expira_em, u.identificacao, b.nome AS bloco
      FROM convite c LEFT JOIN unidade u ON u.id = c.unidade_id LEFT JOIN bloco b ON b.id = u.bloco_id
      WHERE c.condominio_id = ${condominioId} AND c.usado_em IS NULL AND c.expira_em > now()
      ORDER BY c.created_at DESC`);
    return {
      ativos: ativos.map((r) => ({ id: String(r.id), nome: String(r.nome), email: String(r.email), desde: dt(r.inicio)!, unidadeId: String(r.unidade_id), unidade: `${r.identificacao} · Bloco ${r.bloco}` })),
      convitesPendentes: convites.map((r) => ({
        id: String(r.id), nome: String(r.nome), email: String(r.email), tipo: String(r.tipo), expiraEm: dt(r.expira_em)!,
        unidade: r.identificacao ? `${r.identificacao} · Bloco ${r.bloco}` : null,
      })),
    };
  }
}
