# Imagem do front: Next em modo standalone, atrás do Caddy no Compose (mesmo padrão do coda).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG API_URL=http://api:3000
ENV API_URL=$API_URL
# Botões de "entrar como" no login (demo com a fonte simulada). Lido no build.
ARG NEXT_PUBLIC_DEMO=false
ENV NEXT_PUBLIC_DEMO=$NEXT_PUBLIC_DEMO
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @gas/front build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
WORKDIR /repo
COPY --from=build /repo/apps/front/.next/standalone ./
COPY --from=build /repo/apps/front/.next/static ./apps/front/.next/static
EXPOSE 3001
CMD ["node", "apps/front/server.js"]
