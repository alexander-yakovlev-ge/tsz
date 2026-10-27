# syntax=docker/dockerfile:1.7
# Единый Dockerfile монорепозитория. Цели:
#   dev  — все исходники и зависимости (тесты, линтер, разработка)
#   api  — runtime бэкенда и воркера (NestJS + Prisma)
#   web  — runtime фронтенда (Next.js standalone)

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY tools/fixtures/package.json tools/fixtures/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
RUN pnpm --filter @tsz/shared build \
 && pnpm --filter @tsz/api exec prisma generate \
 && pnpm -r build

FROM dev AS api-build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @tsz/api deploy --legacy --prod /out/api \
 && cp -r apps/api/dist /out/api/dist \
 && cd /out/api && ./node_modules/.bin/prisma generate

FROM base AS api
ENV NODE_ENV=production
COPY --from=api-build --chown=node:node /out/api /app
COPY --chown=node:node infra/api/entrypoint.sh /app/entrypoint.sh
USER node
EXPOSE 3001
CMD ["sh", "/app/entrypoint.sh"]

FROM base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=dev --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=dev --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=dev --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
