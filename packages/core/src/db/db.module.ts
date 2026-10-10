import { Global, Module } from "@nestjs/common";
import { createDb, type Database } from "@gas/db";

/** Token de injeção do client Drizzle. */
export const DATABASE = Symbol("DATABASE");

/** Client Drizzle global: API e worker montam este módulo (mesmo padrão do coda). */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database => {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error("DATABASE_URL não definida");
        return createDb(url);
      },
    },
  ],
  exports: [DATABASE],
})
export class DbModule {}
