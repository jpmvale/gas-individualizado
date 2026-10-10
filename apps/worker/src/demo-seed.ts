import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DATABASE, IngestaoService, SenhaService } from "@gas/core";
import { bloco, condominio, medidor, papelAdmin, tarifa, unidade, usuario, vinculo, type Database } from "@gas/db";
import { eq } from "drizzle-orm";

import { WorkerModule } from "./worker.module";

/**
 * Carga de DEMONSTRAÇÃO: um condomínio com 24 apartamentos e o salão de festas, medidores
 * atendidos pela fonte simulada e contas de exemplo. Idempotente: rodar de novo só sincroniza.
 * Nunca rode em produção com dados reais.
 */
const NOME = "Residencial Jacarandá";
const SENHA = process.env.DEMO_SENHA ?? "gas12345";
const INICIO = new Date("2025-09-01T03:00:00Z"); // meia-noite local de 01/09/2025
const NOMES = ["Bruno Carvalho", "Camila Souza", "Diego Martins", "Elisa Prado", "Fábio Nunes", "Ana Ribeiro", "Gabriela Lima", "Henrique Alves", "Isabela Rocha", "João Teixeira", "Karina Duarte", "Lucas Moreira", "Mariana Costa", "Nicolas Barros", "Olívia Ramos", "Paulo Freitas", "Renata Gomes", "Sérgio Pinto", "Tatiana Melo", "Vinícius Cunha", "Yara Monteiro", "André Lopes", "Beatriz Farias", "César Batista"];
const emailDe = (nome: string) => nome.split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + "@exemplo.com";

async function main() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ["error", "warn", "log"] });
  const db = app.get<Database>(DATABASE);
  const senhas = new SenhaService();
  const hash = await senhas.hash(SENHA);

  let [cond] = await db.select().from(condominio).where(eq(condominio.nome, NOME));
  if (!cond) {
    [cond] = await db.insert(condominio).values({ nome: NOME, cidade: "Porto Alegre", fonte: "simulada" }).returning();
    await db.insert(tarifa).values([
      { condominioId: cond.id, precoKg: "10.90", vigenteDesde: "2025-01-01" },
      { condominioId: cond.id, precoKg: "11.40", vigenteDesde: "2026-04-01" },
    ]);
    const usuarios = await db
      .insert(usuario)
      .values([
        { email: "operador@exemplo.com", nome: "Operador da plataforma", senhaHash: hash, operador: true },
        { email: "sindico@exemplo.com", nome: "Carlos Mendes", senhaHash: hash },
        ...NOMES.map((nome) => ({ email: emailDe(nome), nome, senhaHash: hash })),
      ])
      .returning();
    const porEmail = new Map(usuarios.map((u) => [u.email, u.id]));
    await db.insert(papelAdmin).values({ usuarioId: porEmail.get("sindico@exemplo.com")!, condominioId: cond.id });

    let n = 0;
    for (const nomeBloco of ["A", "B"]) {
      const [b] = await db.insert(bloco).values({ condominioId: cond.id, nome: nomeBloco }).returning();
      for (let andar = 1; andar <= 6; andar++) {
        for (const final of [1, 2]) {
          const [u] = await db.insert(unidade).values({ blocoId: b.id, identificacao: `${andar}0${final}` }).returning();
          await db.insert(medidor).values({ unidadeId: u.id, condominioId: cond.id, idExterno: `SIM-${String(n + 1).padStart(4, "0")}`, modelo: "G1.6 + DLA NB", inicio: INICIO });
          await db.insert(vinculo).values({ usuarioId: porEmail.get(emailDe(NOMES[n]))!, unidadeId: u.id, inicio: INICIO });
          n++;
        }
      }
      if (nomeBloco === "A") {
        const [salao] = await db.insert(unidade).values({ blocoId: b.id, identificacao: "Salão de festas", tipo: "area_comum" }).returning();
        await db.insert(medidor).values({ unidadeId: salao.id, condominioId: cond.id, idExterno: "SIM-SALAO", modelo: "G2.5 + DLA NB", inicio: INICIO });
      }
    }
    console.log(`condomínio de demonstração criado (${n} apartamentos + salão)`);
  }

  console.log("importando leituras da fonte simulada (a primeira vez leva alguns segundos)…");
  const r = await app.get(IngestaoService).sincronizarCondominio(cond.id);
  console.log(`pronto: ${r.medidores} medidores, ${r.leiturasNovas} leituras novas, ${r.falhas.length} falhas`);
  // A senha não sai no log: em produção ela é gerada na VPS e a saída do seed fica no terminal de quem rodou.
  console.log("contas: ana@exemplo.com (moradora 302 A), sindico@exemplo.com (admin), operador@exemplo.com · senha de DEMO_SENHA");
  await app.close();
  // O pool do postgres.js não fecha com o contexto do Nest; o script termina aqui.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
