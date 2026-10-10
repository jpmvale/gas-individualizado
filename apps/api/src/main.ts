import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { configurarApp } from "./configurar";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: process.env.BODY_LIMIT ?? "100kb" });
  // Atrás do Caddy: "true" (ou o nº de saltos) faz o throttler ver o IP real do cliente.
  const proxy = process.env.TRUST_PROXY;
  if (proxy && proxy !== "false") app.set("trust proxy", Number(proxy) || 1);
  configurarApp(app);

  const config = new DocumentBuilder()
    .setTitle("Gás Individualizado API")
    .setDescription("Consumo individualizado de GLP por unidade")
    .setVersion("0.0.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  new Logger("Bootstrap").log(`API em http://localhost:${port}/api (docs em /docs)`);
}

void bootstrap();
