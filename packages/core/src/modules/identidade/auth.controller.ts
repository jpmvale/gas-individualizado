import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { eq } from "drizzle-orm";
import { Inject } from "@nestjs/common";
import { usuario, type Database } from "@gas/db";
import type { Request, Response } from "express";

import { DATABASE } from "../../db/db.module";
import { AutenticadoGuard } from "./autenticado.guard";
import { ConviteService } from "./convite.service";
import { AceitarConviteDto, LoginDto } from "./dto";
import { EscopoService, type UsuarioAutenticado } from "./escopo.service";
import { opcoesCookieSessao, opcoesLimparCookieSessao, COOKIE_SESSAO } from "./sessao.cookie";
import { SenhaService } from "./senha.service";
import { SessaoService } from "./sessao.service";
import { UsuarioAtual } from "./usuario-atual.decorator";

@ApiTags("auth")
@Controller()
export class AuthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly senhas: SenhaService,
    private readonly sessoes: SessaoService,
    private readonly escopo: EscopoService,
    private readonly convites: ConviteService,
  ) {}

  private async entrar(usuarioId: string, res: Response) {
    const token = await this.sessoes.criar(usuarioId);
    res.cookie(COOKIE_SESSAO, token, opcoesCookieSessao());
    return { token };
  }

  @Post("auth/login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const [u] = await this.db.select().from(usuario).where(eq(usuario.email, dto.email.trim().toLowerCase())).limit(1);
    // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
    if (!u || !(await this.senhas.conferir(u.senhaHash, dto.senha))) {
      throw new UnauthorizedException("E-mail ou senha não conferem.");
    }
    await this.entrar(u.id, res);
    return this.perfil({ id: u.id, email: u.email, nome: u.nome, operador: u.operador });
  }

  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token) await this.sessoes.revogar(token);
    res.clearCookie(COOKIE_SESSAO, opcoesLimparCookieSessao());
  }

  @Get("auth/me")
  @UseGuards(AutenticadoGuard)
  @ApiBearerAuth()
  me(@UsuarioAtual() u: UsuarioAutenticado) {
    return this.perfil(u);
  }

  @Get("convites/:token")
  consultarConvite(@Param("token") token: string) {
    return this.convites.consultar(token);
  }

  @Post("convites/aceitar")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async aceitar(@Body() dto: AceitarConviteDto, @Res({ passthrough: true }) res: Response) {
    const usuarioId = await this.convites.aceitar(dto.token, dto.senha);
    await this.entrar(usuarioId, res);
    const [u] = await this.db.select().from(usuario).where(eq(usuario.id, usuarioId));
    return this.perfil({ id: u.id, email: u.email, nome: u.nome, operador: u.operador });
  }

  private async perfil(u: UsuarioAutenticado) {
    const [unidades, condominiosAdmin] = await Promise.all([this.escopo.unidadesDoMorador(u.id), this.escopo.condominiosAdmin(u)]);
    return { id: u.id, email: u.email, nome: u.nome, operador: u.operador, unidades, condominiosAdmin };
  }
}
