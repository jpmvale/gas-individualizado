import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Injeta o usuário autenticado (populado pela bearer strategy). */
export const UsuarioAtual = createParamDecorator((_d: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);
