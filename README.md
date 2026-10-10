# Gás Individualizado

Medição individualizada de gás (GLP) para condomínios: cada morador vê o próprio consumo, e o
síndico acompanha o prédio inteiro. As leituras vêm dos medidores da Aépio; enquanto a API deles
não está documentada, uma **fonte simulada** alimenta o sistema (DEC-007).

Especificação completa em [`docs/especificacao.md`](docs/especificacao.md); deploy em
[`docs-tec/deploy.md`](docs-tec/deploy.md). Estado da
implementação e próximos passos em [`docs-tec/HANDOFF.md`](docs-tec/HANDOFF.md).

## Stack

Monorepo pnpm + Turborepo (mesmo padrão do coda): API NestJS, worker BullMQ, Postgres 18 com
Drizzle, front Next.js (App Router) com Tailwind, Docker Compose e Caddy na VPS.

```
apps/api        API HTTP (REST, Swagger em /docs)
apps/worker     sincronização das leituras (BullMQ) e o seed da demo
apps/front      telas do morador e do admin
packages/core   regras: identidade, escopo, medição, consumo
packages/db     schema Drizzle e migrations
packages/types  tipos compartilhados
```

## Rodar local

```bash
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm demo:seed                      # Residencial Jacarandá, 25 medidores simulados
pnpm --filter @gas/api dev          # :3000
NEXT_PUBLIC_DEMO=true pnpm --filter @gas/front dev   # :3001
```

Contas da demo (senha `gas12345`, ou `DEMO_SENHA`):

| Conta | Papel |
| --- | --- |
| `ana@exemplo.com` | moradora do 302 A (tem um vazamento simulado em 02/10) |
| `sindico@exemplo.com` | admin do condomínio |
| `operador@exemplo.com` | operador da plataforma |

## Testes

```bash
pnpm test               # unitários; a integração se pula sem TEST_DATABASE_URL
pnpm test:integration   # recria o gas_test no Postgres do compose e roda tudo
```

Sempre `pnpm` direto (nunca `npm`, `yarn` ou `corepack pnpm`).
