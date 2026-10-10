# Imagem única do backend (mesmo padrão do coda): migrate, api e worker escolhem o comando no compose.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile=false
# Só o backend; o front tem imagem própria. O turbo puxa os deps (^build).
RUN pnpm exec turbo run build --filter=@gas/api --filter=@gas/worker

# Dependências de produção, a partir de um estágio limpo: instalar por cima do node_modules do
# build não removeria o que só o front e as ferramentas de build usam.
FROM base AS deps-prod
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
RUN pnpm install --prod --frozen-lockfile=false \
      --filter=@gas/api... --filter=@gas/worker...

FROM base AS runtime
COPY --from=deps-prod /repo /repo
COPY --from=build /repo/apps/api/dist       apps/api/dist
COPY --from=build /repo/apps/worker/dist    apps/worker/dist
COPY --from=build /repo/packages/core/dist  packages/core/dist
COPY --from=build /repo/packages/db/dist    packages/db/dist
COPY --from=build /repo/packages/types/dist packages/types/dist
# Os .sql não passam pelo tsc; o migrate.js os procura em `__dirname/../migrations`.
COPY --from=build /repo/packages/db/migrations packages/db/migrations
CMD ["node", "apps/api/dist/main.js"]
