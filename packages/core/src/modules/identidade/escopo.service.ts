import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { bloco, condominio, papelAdmin, unidade, vinculo, type Database } from "@gas/db";

import { DATABASE } from "../../db/db.module";

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
  operador: boolean;
}

/** O que o usuário pode ver de uma unidade. `desde` aplica a RN-012 ao morador. */
export interface AcessoUnidade {
  unidadeId: string;
  condominioId: string;
  desde: Date | null;
}

/**
 * Autorização da spec §7.6 (RN-003/004/012). Toda consulta passa por aqui: o morador vê só as
 * unidades com vínculo vigente, a partir do início do vínculo; o admin vê o condomínio inteiro;
 * o operador vê tudo. Para não revelar a existência de unidades alheias, a recusa é 404.
 */
@Injectable()
export class EscopoService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private vigente() {
    return or(isNull(vinculo.fim), gt(vinculo.fim, new Date()));
  }

  async unidadesDoMorador(usuarioId: string) {
    return this.db
      .select({
        unidadeId: unidade.id,
        identificacao: unidade.identificacao,
        bloco: bloco.nome,
        condominioId: condominio.id,
        condominio: condominio.nome,
        desde: vinculo.inicio,
      })
      .from(vinculo)
      .innerJoin(unidade, eq(unidade.id, vinculo.unidadeId))
      .innerJoin(bloco, eq(bloco.id, unidade.blocoId))
      .innerJoin(condominio, eq(condominio.id, bloco.condominioId))
      .where(and(eq(vinculo.usuarioId, usuarioId), this.vigente()))
      .orderBy(bloco.nome, unidade.identificacao);
  }

  async condominiosAdmin(u: UsuarioAutenticado) {
    const q = this.db.select({ id: condominio.id, nome: condominio.nome }).from(condominio);
    if (u.operador) return q.orderBy(condominio.nome);
    return q
      .innerJoin(papelAdmin, eq(papelAdmin.condominioId, condominio.id))
      .where(eq(papelAdmin.usuarioId, u.id))
      .orderBy(condominio.nome);
  }

  async ehAdmin(u: UsuarioAutenticado, condominioId: string): Promise<boolean> {
    if (u.operador) return true;
    const [row] = await this.db
      .select({ c: papelAdmin.condominioId })
      .from(papelAdmin)
      .where(and(eq(papelAdmin.usuarioId, u.id), eq(papelAdmin.condominioId, condominioId)))
      .limit(1);
    return !!row;
  }

  async exigirAdmin(u: UsuarioAutenticado, condominioId: string): Promise<void> {
    if (!(await this.ehAdmin(u, condominioId))) throw new ForbiddenException("Acesso restrito à administração do condomínio.");
  }

  async acessoUnidade(u: UsuarioAutenticado, unidadeId: string): Promise<AcessoUnidade> {
    const [un] = await this.db
      .select({ condominioId: bloco.condominioId })
      .from(unidade)
      .innerJoin(bloco, eq(bloco.id, unidade.blocoId))
      .where(eq(unidade.id, unidadeId))
      .limit(1);
    if (!un) throw new NotFoundException("Unidade não encontrada.");
    if (await this.ehAdmin(u, un.condominioId)) return { unidadeId, condominioId: un.condominioId, desde: null };
    const [v] = await this.db
      .select({ inicio: vinculo.inicio })
      .from(vinculo)
      .where(and(eq(vinculo.usuarioId, u.id), eq(vinculo.unidadeId, unidadeId), this.vigente()))
      .limit(1);
    if (!v) throw new NotFoundException("Unidade não encontrada.");
    return { unidadeId, condominioId: un.condominioId, desde: v.inicio };
  }
}
