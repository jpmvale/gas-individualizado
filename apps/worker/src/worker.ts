import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IngestaoService } from "@gas/core";
import { Queue, Worker } from "bullmq";

import { WorkerModule } from "./worker.module";

const FILA = "leituras";

/**
 * Worker de sincronização (RN-402, UC-22/23). Um job repetível no BullMQ dispara a importação de
 * todos os condomínios ativos. O dispositivo transmite uma vez por dia em horários diferentes,
 * então consultar de hora em hora pega cada lote poucas horas depois de chegar à fonte.
 */
async function main() {
  const log = new Logger("Worker");
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: false });
  const ingestao = app.get(IngestaoService);
  const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
  const intervalo = Number(process.env.SYNC_INTERVAL_MS ?? 3_600_000);

  const fila = new Queue(FILA, { connection });
  await fila.upsertJobScheduler("sincronizar-todos", { every: intervalo }, { name: "sincronizar-todos" });

  const worker = new Worker(
    FILA,
    async () => {
      const r = await ingestao.sincronizarTodos();
      log.log(`sincronização: ${r.medidores} medidores, ${r.leiturasNovas} leituras novas, ${r.falhas.length} falhas`);
      return r;
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (_job, err) => log.error(`sincronização falhou: ${err.message}`));
  log.log(`worker pronto; sincroniza a cada ${Math.round(intervalo / 60_000)} min`);

  const sair = async () => {
    await worker.close();
    await fila.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", sair);
  process.on("SIGINT", sair);
}

void main();
