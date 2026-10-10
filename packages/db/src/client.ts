import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

/** Client Drizzle. API e worker criam um cada, apontando para o mesmo Postgres. */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { onnotice: () => {} });
  return drizzle(client, { schema, casing: "snake_case" });
}
