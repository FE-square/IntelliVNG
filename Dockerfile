################################################################################
# 基础镜像：提供 Node.js + corepack（pnpm）
# 使用最小化的 Alpine 镜像
# 
# 如果遇到 Docker Hub 速率限制（429 Too Many Requests），
# 可以通过构建参数指定镜像源，例如：
# docker build --build-arg BASE_IMAGE=registry.cn-hangzhou.aliyuncs.com/library/node:20-alpine .
# 
# 或者在构建环境配置 Docker 镜像加速器（推荐）：
# 编辑 /etc/docker/daemon.json，添加：
# {
#   "registry-mirrors": [
#     "https://your-id.mirror.aliyuncs.com",
#     "https://mirror.ccs.tencentyun.com"
#   ]
# }
################################################################################
ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app
# 启用 corepack 并准备指定版本的 pnpm
RUN corepack enable && \
    corepack prepare pnpm@10.24.0 --activate

################################################################################
# 依赖安装阶段：仅复制 package 元数据提升缓存命中率
################################################################################
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
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

RUN pnpm turbo run build --filter=!@intellivng/mcp-server
RUN rm -rf apps/web/.next/cache

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

# We install nginx, but we will ignore ALL its default configurations.
RUN apk add --no-cache bash nginx

# We copy our OWN, COMPLETE nginx.conf file, overwriting the default main configuration file.
COPY docker/nginx.conf /etc/nginx/nginx.conf
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