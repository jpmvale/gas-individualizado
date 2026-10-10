import { Module } from "@nestjs/common";

import { IdentidadeModule } from "../identidade/identidade.module";
import { CondominioController, UnidadeController } from "./consumo.controller";
import { ConsumoService } from "./consumo.service";

@Module({
  imports: [IdentidadeModule],
  controllers: [UnidadeController, CondominioController],
  providers: [ConsumoService],
  exports: [ConsumoService],
})
export class ConsumoModule {}
