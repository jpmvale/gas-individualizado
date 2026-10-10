import { Module } from "@nestjs/common";

import { FONTES_LEITURAS, type RegistroFontes } from "./fonte-leituras.port";
import { FonteSimulada } from "./fonte-simulada";
import { IngestaoService } from "./ingestao.service";

/**
 * Leituras e consumo derivado. O registro de fontes é o único ponto que muda quando a API da
 * Aépio chegar: basta registrar o adaptador "aepio" ao lado do "simulada".
 */
@Module({
  providers: [
    { provide: FONTES_LEITURAS, useFactory: (): RegistroFontes => new Map([["simulada", new FonteSimulada()]]) },
    IngestaoService,
  ],
  exports: [IngestaoService, FONTES_LEITURAS],
})
export class MedicaoModule {}
