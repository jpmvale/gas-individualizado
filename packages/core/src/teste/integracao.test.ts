import "reflect-metadata";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { bloco, condominio, consumoHora, createDb, leitura, medidor, papelAdmin, tarifa, unidade, usuario, vinculo, type Database } from "@gas/db";
import { eq, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DbModule } from "../db/db.module";
import { ConsumoModule } from "../modules/consumo/consumo.module";
import { IdentidadeModule } from "../modules/identidade/identidade.module";
import { tokenDoCookie } from "../modules/identidade/sessao.cookie";
import { SenhaService } from "../modules/identidade/senha.service";
import { FONTES_LEITURAS } from "../modules/medicao/fonte-leituras.port";
import { FonteSimulada } from "../modules/medicao/fonte-simulada";
import { IngestaoService } from "../modules/medicao/ingestao.service";
import { MedicaoModule } from "../modules/medicao/medicao.module";

/*
 * Integração contra Postgres de verdade (mesma regra do coda: sem TEST_DATABASE_URL o arquivo se
 * pula sozinho, e um verde aqui sem banco não prova nada). Rode com `pnpm test:integration`.
 */
const DB_URL = process.env.TEST_DATABASE_URL;
const ANCORA = new Date("2026-10-10T03:00:00Z");
const INICIO = new Date(ANCORA.getTime() - 10 * 86_400_000);
const SENHA = "senhaDeTeste1";

describe.skipIf(!DB_URL)("integração", () => {
  let app: INestApplication;
  let db: Database;
  let ingestao: IngestaoService;
  const ids = { cond: "", ana: "", vizinho: "" };

  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL;
    db = createDb(DB_URL!);
    await db.execute(sql`TRUNCATE condominio, usuario CASCADE`);

    const hash = await new SenhaService().hash(SENHA);
    const [c] = await db.insert(condominio).values({ nome: "Teste", fonte: "simulada" }).returning();
    ids.cond = c.id;
    await db.insert(tarifa).values({ condominioId: c.id, precoKg: "11.40", vigenteDesde: "2025-01-01" });
    const [b] = await db.insert(bloco).values({ condominioId: c.id, nome: "A" }).returning();
    const [ana, vizinho, sindico] = await db
      .insert(usuario)
      .values([
        { email: "ana@teste.com", nome: "Ana", senhaHash: hash },
        { email: "vizinho@teste.com", nome: "Vizinho", senhaHash: hash },
        { email: "sindico@teste.com", nome: "Síndico", senhaHash: hash },
      ])
      .returning();
    await db.insert(papelAdmin).values({ usuarioId: sindico.id, condominioId: c.id });
    for (let i = 1; i <= 6; i++) {
      const [u] = await db.insert(unidade).values({ blocoId: b.id, identificacao: `10${i}` }).returning();
      await db.insert(medidor).values({ unidadeId: u.id, condominioId: c.id, idExterno: `T-${i}`, inicio: INICIO });
      if (i === 1) { ids.ana = u.id; await db.insert(vinculo).values({ usuarioId: ana.id, unidadeId: u.id, inicio: INICIO }); }
      if (i === 2) { ids.vizinho = u.id; await db.insert(vinculo).values({ usuarioId: vizinho.id, unidadeId: u.id, inicio: INICIO }); }
    }

    const mod = await Test.createTestingModule({ imports: [DbModule, IdentidadeModule, ConsumoModule, MedicaoModule] })
      .overrideProvider(FONTES_LEITURAS)
      .useValue(new Map([["simulada", new FonteSimulada({ ancora: ANCORA, mudos: [], vazamento: [], consumoAlto: [], bateriaBaixa: [] })]]))
      .compile();
    app = mod.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const t = tokenDoCookie(req.headers.cookie);
      if (t && !req.headers.authorization) req.headers.authorization = `Bearer ${t}`;
      next();
    });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    ingestao = app.get(IngestaoService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const entrar = async (email: string) => {
    const agente = request.agent(app.getHttpServer());
    await agente.post("/api/auth/login").send({ email, senha: SENHA }).expect(200);
    return agente;
  };

  describe("ingestão (RN-100/101/402)", () => {
    it("importa as leituras e deriva o consumo horário", async () => {
      const r = await ingestao.sincronizarCondominio(ids.cond, ANCORA);
      expect(r.falhas).toEqual([]);
      expect(r.leiturasNovas).toBeGreaterThan(6 * 200);
    });

    it("é idempotente: sincronizar de novo não traz nada novo", async () => {
      const r = await ingestao.sincronizarCondominio(ids.cond, ANCORA);
      expect(r.leiturasNovas).toBe(0);
    });

    it("o consumo somado bate com a diferença entre a primeira e a última leitura", async () => {
      const [m] = await db.select().from(medidor).where(eq(medidor.idExterno, "T-1"));
      const [ext] = await db.execute(sql`SELECT min(valor_m3) AS a, max(valor_m3) AS b FROM leitura WHERE medidor_id = ${m.id}`) as unknown as { a: string; b: string }[];
      const [soma] = await db.execute(sql`SELECT sum(m3) AS s FROM consumo_hora WHERE medidor_id = ${m.id}`) as unknown as { s: string }[];
      expect(Number(soma.s)).toBeCloseTo(Number(ext.b) - Number(ext.a), 3);
      expect(m.ultimaTransmissao).not.toBeNull();
    });

    it("uma leitura menor que a anterior é marcada como anômala e não gera consumo negativo", async () => {
      const [m] = await db.select().from(medidor).where(eq(medidor.idExterno, "T-6"));
      const instante = new Date(m.ultimoInstante!.getTime() + 3_600_000);
      await db.insert(leitura).values({ medidorId: m.id, instante, valorM3: "0.001" });
      // Força o recálculo a partir da leitura injetada, como faria uma nova sincronização.
      await db.update(medidor).set({ ultimoInstante: instante }).where(eq(medidor.id, m.id));
      await (ingestao as unknown as { recalcularConsumo(id: string, d: Date): Promise<void> }).recalcularConsumo(m.id, new Date(instante.getTime() - 3_600_000));
      const [l] = await db.select().from(leitura).where(sql`${leitura.medidorId} = ${m.id} AND ${leitura.instante} = ${instante.toISOString()}::timestamptz`);
      expect(l.anomala).toBe(true);
      const [neg] = await db.execute(sql`SELECT count(*) AS n FROM consumo_hora WHERE m3 < 0`) as unknown as { n: string }[];
      expect(Number(neg.n)).toBe(0);
      void consumoHora;
    });
  });

  describe("login e escopo (RN-001/002/004/012)", () => {
    it("recusa senha errada sem dizer se o e-mail existe", async () => {
      const r = await request(app.getHttpServer()).post("/api/auth/login").send({ email: "ana@teste.com", senha: "errada123" });
      expect(r.status).toBe(401);
      expect(r.body.message).toBe("E-mail ou senha não conferem.");
    });

    it("a moradora vê a própria unidade e não a do vizinho", async () => {
      const ana = await entrar("ana@teste.com");
      const me = await ana.get("/api/auth/me").expect(200);
      expect(me.body.unidades.map((u: { unidadeId: string }) => u.unidadeId)).toEqual([ids.ana]);
      const resumo = await ana.get(`/api/unidades/${ids.ana}/resumo`).expect(200);
      expect(resumo.body.medidor.leituraAtualM3).toBeGreaterThan(0);
      await ana.get(`/api/unidades/${ids.vizinho}/resumo`).expect(404);
      await ana.get(`/api/condominios/${ids.cond}/painel`).expect(403);
    });

    it("a série por dia traz a média do condomínio (5+ unidades)", async () => {
      const ana = await entrar("ana@teste.com");
      const r = await ana.get(`/api/unidades/${ids.ana}/consumo?granularidade=dia&de=2026-10-02&ate=2026-10-05`).expect(200);
      expect(r.body.serie).toHaveLength(3);
      expect(r.body.serie[0].mediaCondominio).not.toBeNull();
    });

    it("o admin vê o painel e as unidades do condomínio", async () => {
      const sindico = await entrar("sindico@teste.com");
      const p = await sindico.get(`/api/condominios/${ids.cond}/painel`).expect(200);
      expect(p.body.medidores.total).toBe(6);
      const u = await sindico.get(`/api/condominios/${ids.cond}/unidades`).expect(200);
      expect(u.body).toHaveLength(6);
      await sindico.get(`/api/unidades/${ids.ana}/resumo`).expect(200);
    });

    it("convite: o admin convida, o morador cria a senha e só vê consumo a partir de agora", async () => {
      const sindico = await entrar("sindico@teste.com");
      const unidades = (await sindico.get(`/api/condominios/${ids.cond}/unidades`)).body as { id: string; identificacao: string }[];
      const alvo = unidades.find((x) => x.identificacao === "103")!;
      const c = await sindico.post(`/api/condominios/${ids.cond}/convites`).send({ tipo: "morador", email: "Novo@Teste.com", nome: "Novo", unidadeId: alvo.id }).expect(201);
      const token = new URL(c.body.link).searchParams.get("token")!;

      const info = await request(app.getHttpServer()).get(`/api/convites/${token}`).expect(200);
      expect(info.body).toMatchObject({ email: "novo@teste.com", tipo: "morador", contaExistente: false });

      const novo = request.agent(app.getHttpServer());
      const aceito = await novo.post("/api/convites/aceitar").send({ token, senha: "outraSenha9" }).expect(200);
      expect(aceito.body.unidades[0].unidadeId).toBe(alvo.id);
      const serie = await novo.get(`/api/unidades/${alvo.id}/consumo?granularidade=dia&de=2026-10-01&ate=2026-10-09`).expect(200);
      expect(serie.body.serie).toEqual([]);

      // Uso único.
      await request(app.getHttpServer()).post("/api/convites/aceitar").send({ token, senha: "outraSenha9" }).expect(404);
    });

    it("morador não convida ninguém", async () => {
      const ana = await entrar("ana@teste.com");
      await ana.post(`/api/condominios/${ids.cond}/convites`).send({ tipo: "morador", email: "x@teste.com", nome: "Xavier", unidadeId: ids.ana }).expect(403);
    });
  });
});
