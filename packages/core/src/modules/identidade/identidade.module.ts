import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { BearerStrategy } from "./autenticado.guard";
import { ConviteService } from "./convite.service";
import { EmailService } from "./email.service";
import { EscopoService } from "./escopo.service";
import { SenhaService } from "./senha.service";
import { SessaoService } from "./sessao.service";

/** Login, sessão, convites e autorização por escopo (RN-001 a RN-012). */
@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [SessaoService, SenhaService, EscopoService, ConviteService, EmailService, BearerStrategy],
  exports: [EscopoService, ConviteService, SenhaService],
})
export class IdentidadeModule {}
