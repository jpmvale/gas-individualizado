import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConsumoModule, DbModule, IdentidadeModule } from "@gas/core";

import { HealthController } from "./health.controller";

/** Monólito modular: a API monta os módulos de domínio do @gas/core. */
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000), limit: Number(process.env.THROTTLE_LIMIT ?? 120) }]),
    DbModule,
    IdentidadeModule,
    ConsumoModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
