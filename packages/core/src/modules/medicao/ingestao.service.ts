import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { condominio, consumoHora, leitura, medidor, type Database } from "@gas/db";

import { DATABASE } from "../../db/db.module";
import { num } from "../../util/num";
import { derivarConsumo } from "./consumo.calc";
import { FONTES_LEITURAS, type FonteLeituras, type RegistroFontes } from "./fonte-leituras.port";

const HORA = 3_600_000;
const SOBREPOSICAO_MS = 24 * HORA; // RN-402: pega lotes atrasados; a RN-101 descarta repetidas
const LOTE_INSERT = 2_000;

export interface ResultadoSync {
  medidores: number;
  leiturasNovas: number;
  falhas: { idExterno: string; erro: string }[];
}

type Medidor = typeof medidor.$inferSelect;

/**
 * Importa leituras de uma fonte (UC-22) e recalcula o consumo horário (UC-23).
 * Idempotente: rodar duas vezes sobre o mesmo intervalo não muda nada.
 */
@Injectable()
export class IngestaoService {
  private readonly log = new Logger(IngestaoService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(FONTES_LEITURAS) private readonly fontes: RegistroFontes,
  ) {}

  async sincronizarTodos(agora = new Date()): Promise<ResultadoSync> {
    const conds = await this.db.select({ id: condominio.id }).from(condominio).where(eq(condominio.ativo, true));
    const total: ResultadoSync = { medidores: 0, leiturasNovas: 0, falhas: [] };
    for (const c of conds) {
      const r = await this.sincronizarCondominio(c.id, agora);
      total.medidores += r.medidores;
      total.leiturasNovas += r.leiturasNovas;
      total.falhas.push(...r.falhas);
    }
    return total;
  }

  async sincronizarCondominio(condominioId: string, agora = new Date()): Promise<ResultadoSync> {
    const [c] = await this.db.select({ fonte: condominio.fonte }).from(condominio).where(eq(condominio.id, condominioId));
    const fonte = c && this.fontes.get(c.fonte);
    if (!fonte) throw new Error(`Fonte de leituras desconhecida: ${c?.fonte ?? "condomínio inexistente"}`);
    const meds = await this.db
      .select()
      .from(medidor)
      .where(and(eq(medidor.condominioId, condominioId), isNull(medidor.fim)));
    const res: ResultadoSync = { medidores: meds.length, leiturasNovas: 0, falhas: [] };
    for (const m of meds) {
      try {
        res.leiturasNovas += await this.sincronizarMedidor(m, fonte, agora);
      } catch (e) {
        // Um medidor com problema não derruba os outros; a falha fica registrada.
        const erro = e instanceof Error ? e.message : String(e);
        this.log.warn(`falha ao sincronizar ${m.idExterno}: ${erro}`);
        res.falhas.push({ idExterno: m.idExterno, erro });
      }
    }
    return res;
  }

  private async sincronizarMedidor(m: Medidor, fonte: FonteLeituras, agora: Date): Promise<number> {
    const desde = m.ultimoInstante ? new Date(m.ultimoInstante.getTime() - SOBREPOSICAO_MS) : m.inicio;
    const lote = await fonte.buscarLeituras(m.idExterno, desde, agora);

    let novas = 0;
    for (let i = 0; i < lote.leituras.length; i += LOTE_INSERT) {
      const fatia = lote.leituras.slice(i, i + LOTE_INSERT);
      const inseridas = await this.db
        .insert(leitura)
        .values(fatia.map((l) => ({ medidorId: m.id, instante: l.instante, valorM3: l.valorM3.toFixed(3) })))
        .onConflictDoNothing()
        .returning({ instante: leitura.instante });
      novas += inseridas.length;
    }

    if (novas > 0) await this.recalcularConsumo(m.id, desde);

    const [ultima] = await this.db
      .select({ instante: leitura.instante })
      .from(leitura)
      .where(eq(leitura.medidorId, m.id))
      .orderBy(desc(leitura.instante))
      .limit(1);
    await this.db
      .update(medidor)
      .set({
        ultimoInstante: ultima?.instante ?? m.ultimoInstante,
        ultimaTransmissao: lote.transmitidoEm ?? m.ultimaTransmissao,
        bateriaV: lote.bateriaV != null ? lote.bateriaV.toFixed(2) : m.bateriaV,
      })
      .where(eq(medidor.id, m.id));
    return novas;
  }

  /** Rederiva o consumo horário a partir de `desde`, usando a leitura anterior como base. */
  private async recalcularConsumo(medidorId: string, desde: Date): Promise<void> {
    const [anterior] = await this.db
      .select()
      .from(leitura)
      .where(and(eq(leitura.medidorId, medidorId), lt(leitura.instante, desde)))
      .orderBy(desc(leitura.instante))
      .limit(1);
    const lidas = await this.db
      .select({ instante: leitura.instante, valorM3: leitura.valorM3 })
      .from(leitura)
      .where(and(eq(leitura.medidorId, medidorId), gte(leitura.instante, desde)))
      .orderBy(asc(leitura.instante));
    const { consumos, anomalas } = derivarConsumo(
      lidas.map((l) => ({ instante: l.instante, valorM3: num(l.valorM3) })),
      anterior ? { instante: anterior.instante, valorM3: num(anterior.valorM3) } : null,
    );
    for (let i = 0; i < consumos.length; i += LOTE_INSERT) {
      await this.db
        .insert(consumoHora)
        .values(consumos.slice(i, i + LOTE_INSERT).map((c) => ({ medidorId, hora: c.hora, m3: c.m3.toFixed(3) })))
        .onConflictDoUpdate({ target: [consumoHora.medidorId, consumoHora.hora], set: { m3: sql`excluded.m3` } });
    }
    if (anomalas.length) {
      await this.db
        .update(leitura)
        .set({ anomala: true })
        .where(and(eq(leitura.medidorId, medidorId), inArray(leitura.instante, anomalas)));
    }
  }
}
