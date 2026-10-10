# Handoff

Última atualização: 2026-10-10.

## O que existe

Fases 0 e 1 da especificação, sem a observabilidade e sem a Aépio real:

- **Identidade:** login por e-mail e senha, sessão em cookie, convite por e-mail (morador ou admin),
  aceite do convite com criação de senha. Papéis morador, admin por condomínio e operador global.
- **Medição:** ingestão idempotente pela porta `FonteLeituras`, consumo horário derivado das
  leituras acumuladas, cursor por medidor, bateria e última transmissão. Worker sincroniza de hora
  em hora (BullMQ).
- **Consumo:** resumo da unidade (mês, projeção em R$, hoje, comparação com a média do prédio),
  série por hora, dia ou mês, painel do admin, lista de unidades com situação e lista de moradores.
- **Front:** login, consumo, histórico, admin (painel, unidades, moradores e convites).
- **Infra:** Dockerfile do backend, compose de dev, overlay de produção com Caddy, CI com Postgres
  18, deploy para a VPS desligado (ADR-G06).

## Como verificar

`pnpm test:integration` cobre ingestão, idempotência, soma igual à diferença das leituras,
anomalia, login, escopo (404 e 403), média do prédio, telas do admin e o fluxo de convite.
`pnpm demo:seed` monta o Residencial Jacarandá com cenários fixos: vazamento no 302 A em 02/10,
consumo alto no 501 A, dois medidores mudos e um com bateria baixa.

## Pendente

- **Aépio real (QA-01):** adaptador HTTP com OAuth2 client_credentials e o mapper para `LoteLeituras`.
- **Fase 2:** tarifas editáveis pela tela, fechamento mensal, exportação CSV/PDF, alertas por e-mail.
- **Recuperação de senha** (hoje só há o convite).
- **Observabilidade:** OTel, Alloy e Sentry, como no coda.
- **Deploy:** decidir o proxy na VPS (QA-09), criar os secrets e ligar `DEPLOY_ENABLED`.
- As imagens Docker ainda não foram construídas (não havia Docker no ambiente da primeira sessão);
  o primeiro deploy é quem as valida.
