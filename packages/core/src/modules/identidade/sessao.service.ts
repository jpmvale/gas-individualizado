import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { sessao, usuario, type Database } from "@gas/db";

import { DATABASE } from "../../db/db.module";
import { parseDuration } from "../../util/duration";

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Sessão opaca e revogável: só o hash do token fica no banco. */
@Injectable()
export class SessaoService {
  private readonly ttlMs = parseDuration(process.env.SESSION_TTL ?? "30d", 30 * 86_400_000);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async criar(usuarioId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(sessao).values({
      usuarioId,
      tokenHash: hashToken(token),
      expiraEm: new Date(Date.now() + this.ttlMs),
    });
    return token;
  }

  async resolver(token: string) {
    const [row] = await this.db
      .select({ u: usuario })
      .from(sessao)
      .innerJoin(usuario, eq(usuario.id, sessao.usuarioId))
      .where(and(eq(sessao.tokenHash, hashToken(token)), gt(sessao.expiraEm, new Date())))
      .limit(1);
    return row?.u ?? null;
  }

  async revogar(token: string): Promise<void> {
    await this.db.delete(sessao).where(eq(sessao.tokenHash, hashToken(token)));
  }
}
