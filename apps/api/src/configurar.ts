import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { tokenDoCookie } from "@gas/core";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

/** Configuração HTTP compartilhada entre o main.ts e os testes de API. */
export function configurarApp(app: INestApplication): void {
  app.use(helmet({ contentSecurityPolicy: false }));
  // Ponte cookie→bearer (mesma do coda): a bearer strategy resolve a sessão venha ela do cookie
  // httpOnly do front ou do header Authorization de ferramentas e testes.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      const token = tokenDoCookie(req.headers.cookie);
      if (token) req.headers.authorization = `Bearer ${token}`;
    }
    next();
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
