import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { bloco, condominio, convite, papelAdmin, unidade, usuario, vinculo, type Database } from "@gas/db";

import { DATABASE } from "../../db/db.module";
import { EmailService } from "./email.service";
import type { CriarConviteDto } from "./dto";
import { SenhaService } from "./senha.service";
import { hashToken } from "./sessao.service";

const VALIDADE_MS = 7 * 86_400_000; // RN-002

/**
 * RN-002: ninguém se cadastra sozinho. O admin convida morador para uma unidade; o operador (ou
 * um admin) convida admin para o condomínio. O link é de uso único e vale 7 dias.
 */
@Injectable()
export class ConviteService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly senhas: SenhaService,
    private readonly email: EmailService,
  ) {}

  async criar(condominioId: string, dto: CriarConviteDto, criadoPor: string) {
    const email = dto.email.trim().toLowerCase();
    if (dto.tipo === "morador") {
      if (!dto.unidadeId) throw new BadRequestException("Informe a unidade do morador.");
      const [un] = await this.db
        .select({ id: unidade.id, tipo: unidade.tipo })
        .from(unidade)
        .innerJoin(bloco, eq(bloco.id, unidade.blocoId))
        .where(and(eq(unidade.id, dto.unidadeId), eq(bloco.condominioId, condominioId)))
        .limit(1);
      if (!un) throw new NotFoundException("Unidade não encontrada neste condomínio.");
      if (un.tipo === "area_comum") throw new BadRequestException("Área comum não tem morador.");
    }
    const token = randomBytes(32).toString("base64url");
    const [c] = await this.db
      .insert(convite)
      .values({
        tipo: dto.tipo,
        email,
        nome: dto.nome.trim(),
        condominioId,
        unidadeId: dto.tipo === "morador" ? dto.unidadeId : null,
        tokenHash: hashToken(token),
        expiraEm: new Date(Date.now() + VALIDADE_MS),
        criadoPor,
      })
      .returning({ id: convite.id, expiraEm: convite.expiraEm });
    const link = `${process.env.APP_URL ?? "http://localhost:3001"}/convite?token=${token}`;
    const contexto = dto.tipo === "admin" ? "administrar o condomínio" : "acompanhar o consumo de gás da sua unidade";
    await this.email.enviarConvite(email, dto.nome, link, contexto);
    // O link volta na resposta para o admin poder repassá-lo enquanto não há e-mail configurado.
    return { id: c.id, expiraEm: c.expiraEm, link };
  }

  private async buscarValido(token: string) {
    const [c] = await this.db
      .select({
        id: convite.id,
        tipo: convite.tipo,
        email: convite.email,
        nome: convite.nome,
        condominioId: convite.condominioId,
        condominio: condominio.nome,
        unidadeId: convite.unidadeId,
      })
      .from(convite)
      .innerJoin(condominio, eq(condominio.id, convite.condominioId))
      .where(and(eq(convite.tokenHash, hashToken(token)), isNull(convite.usadoEm), gt(convite.expiraEm, new Date())))
      .limit(1);
    if (!c) throw new NotFoundException("Convite inválido, usado ou expirado. Peça um novo à administração.");
    return c;
  }

  async consultar(token: string) {
    const c = await this.buscarValido(token);
    let unidadeNome: string | null = null;
    if (c.unidadeId) {
      const [u] = await this.db
        .select({ identificacao: unidade.identificacao, bloco: bloco.nome })
        .from(unidade)
        .innerJoin(bloco, eq(bloco.id, unidade.blocoId))
        .where(eq(unidade.id, c.unidadeId));
      unidadeNome = u ? `${u.identificacao} · Bloco ${u.bloco}` : null;
    }
    const [existente] = await this.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, c.email)).limit(1);
    return { tipo: c.tipo, email: c.email, nome: c.nome, condominio: c.condominio, unidade: unidadeNome, contaExistente: !!existente };
  }

  /**
   * Aceita o convite. Conta nova: cria com a senha informada. Conta existente (ex.: dono de dois
   * apartamentos): exige a senha atual e só acrescenta o vínculo ou o papel.
   */
  async aceitar(token: string, senha: string): Promise<string> {
    const c = await this.buscarValido(token);
    return this.db.transaction(async (tx) => {
      const [existente] = await tx.select().from(usuario).where(eq(usuario.email, c.email)).limit(1);
      let usuarioId: string;
      if (existente) {
        if (!(await this.senhas.conferir(existente.senhaHash, senha))) {
          throw new ConflictException("Este e-mail já tem conta. Use a senha atual para aceitar o convite.");
        }
        usuarioId = existente.id;
      } else {
        this.senhas.validar(senha);
        const [novo] = await tx
          .insert(usuario)
          .values({ email: c.email, nome: c.nome, senhaHash: await this.senhas.hash(senha) })
          .returning({ id: usuario.id });
        usuarioId = novo.id;
      }
      if (c.tipo === "morador" && c.unidadeId) {
        await tx.insert(vinculo).values({ usuarioId, unidadeId: c.unidadeId });
      } else {
        await tx.insert(papelAdmin).values({ usuarioId, condominioId: c.condominioId }).onConflictDoNothing();
      }
      await tx.update(convite).set({ usadoEm: new Date() }).where(eq(convite.id, c.id));
      return usuarioId;
    });
  }
}
