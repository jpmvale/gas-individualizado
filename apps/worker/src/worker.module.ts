import { Module } from "@nestjs/common";
import { DbModule, MedicaoModule } from "@gas/core";

/** Contexto sem HTTP: só o que o worker precisa para importar leituras. */
@Module({ imports: [DbModule, MedicaoModule] })
export class WorkerModule {}
