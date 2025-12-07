#!/usr/bin/env bash
set -euo pipefail

cd /app

NEXT_PORT="${NEXT_PORT:-3000}"
SERVICES_PORT="${SERVICES_PORT:-4000}"
PUBLIC_PORT="${PUBLIC_PORT:-7860}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

cleanup() {
  log "接收到停止信号，正在关闭进程..."
  kill -TERM "${SERVICES_PID:-0}" "${WEB_PID:-0}" "${NGINX_PID:-0}" 2>/dev/null || true
}

trap cleanup SIGINT SIGTERM

log "启动 intelli-services (port=${SERVICES_PORT})"
PORT="${SERVICES_PORT}" pnpm --filter intelli-services --workspace-root start &
SERVICES_PID=$!

log "启动 Next.js Web (port=${NEXT_PORT})"
HOST_BIND="${HOST:-0.0.0.0}"
HOSTNAME_BIND="${HOSTNAME:-0.0.0.0}"
HOST="${HOST_BIND}" HOSTNAME="${HOSTNAME_BIND}" PORT="${NEXT_PORT}" pnpm --filter web --workspace-root start &
WEB_PID=$!

log "启动 Nginx 反向代理 (port=${PUBLIC_PORT})"
nginx -g "daemon off;" &
NGINX_PID=$!

wait -n "${SERVICES_PID}" "${WEB_PID}" "${NGINX_PID}"
EXIT_CODE=$?
cleanup
wait || true
exit "${EXIT_CODE}"

