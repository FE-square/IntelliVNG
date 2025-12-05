# syntax=docker/dockerfile:1.6

################################################################################
# 基础镜像：提供 Node.js + corepack（pnpm）
################################################################################
FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app
RUN corepack enable

################################################################################
# 依赖安装阶段：仅复制 package 元数据提升缓存命中率
################################################################################
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY apps/intelli-services/package.json apps/intelli-services/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/editor/package.json packages/editor/
COPY packages/player/package.json packages/player/
COPY packages/ui/package.json packages/ui/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

################################################################################
# 构建阶段：编译 Next.js 与 intelli-services
################################################################################
FROM deps AS builder

COPY . .

ARG PUBLIC_SERVICES_PATH=/services
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_INTELLI_SERVICES_URL=${PUBLIC_SERVICES_PATH}

RUN pnpm run build
RUN pnpm prune --prod && rm -rf apps/web/.next/cache

################################################################################
# 运行阶段：包含 Node.js、pnpm、Nginx 与构建产物
################################################################################
FROM base AS runner

ARG PUBLIC_SERVICES_PATH=/services

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUBLIC_PORT=7860
ENV NEXT_PORT=3000
ENV SERVICES_PORT=4000
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV INTELLI_SERVICES_URL=http://127.0.0.1:4000
ENV NEXT_PUBLIC_INTELLI_SERVICES_URL=${PUBLIC_SERVICES_PATH}

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f /etc/nginx/sites-enabled/default

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 7860

ENTRYPOINT ["/entrypoint.sh"]