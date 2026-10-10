import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";

import { SessaoService } from "./sessao.service";

/** Resolve a sessão opaca a partir do token (cookie copiado para o header no main.ts). */
@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy, "bearer") {
  constructor(private readonly sessoes: SessaoService) {
    super();
  }

  async validate(token: string) {
    const u = await this.sessoes.resolver(token);
    if (!u) throw new UnauthorizedException();
    return { id: u.id, email: u.email, nome: u.nome, operador: u.operador };
  }
}

/** Tudo exige login, exceto login e aceite de convite. */
@Injectable()
export class AutenticadoGuard extends AuthGuard("bearer") {}
