### 1206 Docker 部署踩坑笔记（Nginx + pnpm + Node ESM）

---

## 一、背景

- 项目是一个 **pnpm monorepo**，包含：
  - `apps/web`：Next.js 前端
  - `apps/intelli-services`：Node + Hono 的后端服务
- 使用多阶段 **Docker 构建**：
  - `deps`：安装依赖
  - `builder`：`pnpm run build`
  - `runner`：跑 `intelli-services` + `next start` + Nginx 反向代理

最终目标：在容器里跑通前后端，并通过 Nginx 暴露统一入口。

---

## 二、问题 1：Nginx 指令“户口问题” & 主配置文件接管

### 1.1 现象 & 报错

- 一开始 Nginx 报错：
  - `"upstream" directive is not allowed here`
  - `"server" directive is not allowed here`
  - `"access_log" directive is not allowed here`
- 即使我们把配置拆成 `upstreams.conf` + `default.conf`，放到 `/etc/nginx/conf.d/`，还是不断收到“xxx 指令不允许出现在这里”的错误。

### 1.2 背景知识：Nginx 指令上下文

- **main 上下文**（文件最外层）：`worker_processes`、`events`、`error_log` 等。
- **http 上下文**：`http { ... }` 里面，可以放：
  - `server`、`upstream`、`log_format`、`include`、`client_max_body_size` 等。
- **server 上下文**：`server { ... }` 里面：
  - `listen`、`server_name`、`location`、`access_log` 等。
- **location 上下文**：
  - `proxy_pass`、`add_header` 等。
- 某些指令：
  - `access_log`：**不能**在 main，用在 `http` / `server` / `location`。
  - `upstream`：**只能**在 `http` 里。
  - `server`：**只能**在 `http` 里。

如果主配置把 `include /etc/nginx/conf.d/*.conf;` 放在 `server` 里面，那我们在 `conf.d` 里放 `upstream` / `server` / `http` 都会报“not allowed here”。

### 1.3 关键判断：默认 `nginx.conf` 行为“诡异”

结合一串报错可以推断出：

- 镜像自带的 `/etc/nginx/nginx.conf` 很可能是：
  - `http { server { ... include /etc/nginx/conf.d/*.conf; } }`
- 也就是说，**`conf.d` 其实被 include 在 server 里**，导致我们写在 `conf.d` 里的所有 `upstream` / `server` 指令都“黑户”。

### 1.4 解决方案：完全接管主配置文件

直接放弃默认配置，自己写一个完整的 `nginx.conf`，并覆盖 `/etc/nginx/nginx.conf`：

- 在 `docker/nginx.conf` 中，声明完整结构：

```nginx
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

# main：只放 error_log 等
error_log /dev/stderr warn;

events {
  worker_connections 1024;
}

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;

  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent" "$http_x_forwarded_for"';

  access_log /dev/stdout main;

  sendfile on;
  tcp_nopush on;
  keepalive_timeout 65;
  client_max_body_size 32m;

  # WebSocket 兼容
  map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
  }

  upstream next_app {
    server 127.0.0.1:3000;
  }

  upstream backend_app {
    server 127.0.0.1:4000;
  }

  server {
    listen 0.0.0.0:7860;
    server_name _;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    # 转发到 backend_app
    location /services/ {
      proxy_pass http://backend_app/;
      proxy_buffering off;
      proxy_cache off;
      proxy_set_header Connection '';
      proxy_read_timeout 600s;
      proxy_send_timeout 600s;
    }

    location = /services {
      return 307 /services/;
    }

    # Next 静态资源
    location /_next/static/ {
      proxy_pass http://next_app/_next/static/;
      add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /_next/image {
      proxy_pass http://next_app/_next/image;
    }

    location /api/ {
      proxy_pass http://next_app/api/;
    }

    # 其他全部给 next_app
    location / {
      proxy_pass http://next_app;
    }
  }
}
```

- 在 `Dockerfile` 的 `runner` 阶段改成：

```dockerfile
RUN apk add --no-cache bash nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf
```

**要点总结：**

- 所有“xxx directive is not allowed here”本质上都是 **上下文不对**。
- 通过完全接管 `/etc/nginx/nginx.conf`，我们自己控制 `http` / `server` / `upstream` / `access_log` 的位置，彻底绕开镜像里诡异的默认配置。

---

## 三、问题 2：`pnpm prune --prod` 导致依赖丢失

### 2.1 现象

- 启动时出现：
  - `sh: next: not found`
  - `Cannot find package 'dotenv' imported from /app/apps/intelli-services/dist/index.js`
- 明明：
  - `apps/web/package.json` 中 `next` 在 `dependencies`
  - `apps/intelli-services/package.json` 中 `dotenv` 也在 `dependencies`

### 2.2 背景知识：`pnpm prune --prod` 在 workspace 的行为

在 pnpm 的 monorepo 中：

- 你在 **workspace 根目录** 执行：

```bash
pnpm prune --prod
```

pnpm 的逻辑是：

- 把“当前 package.json 的 `dependencies`”当作生产根，然后从这些根开始往下保留依赖；
- 对于 **只被 devDependencies 引用** 或“根本没被当前包声明为依赖”的包，会认为是“非生产依赖”，从 `node_modules` 裁掉。

而我们根目录的 `package.json` 长这样：

```json
{
  "name": "intellivng",
  "private": true,
  "scripts": { ... },
  "devDependencies": {
    "turbo": "...",
    "prettier": "...",
    "typescript": "..."
  }
}
```

- 根本 **没有 `dependencies` 字段**。
- 对 pnpm 来说：根包没有任何“生产依赖”，于是 `prune --prod` 会把 workspace 下很多东西当作“开发用的”，大量删除。

因此：

- `web` 这个 workspace 包里的 `next` 虽然在 **它自己的** `dependencies` 里，但**根包并没有把 `web` 当作一个生产依赖**；
- 同理，`intelli-services` 里的 `dotenv` 也一样；
- 结果就是：`pnpm prune --prod` 把不少依赖清掉，镜像里就没有 `next` 和 `dotenv` 了。

### 2.3 解决方案

- 在 `Dockerfile` 的 builder 阶段，**移除这一行**：

```dockerfile
RUN CI=true pnpm prune --prod && rm -rf apps/web/.next/cache
```

改成只清理 Next 的缓存：

```dockerfile
RUN rm -rf apps/web/.next/cache
```

**后续如果想做“瘦身”，更推荐：**

- 使用 **`pnpm deploy`** 到独立目录，或者
- 使用更精细的命令，例如（视实际结构设计）：
  - `pnpm deploy --filter web ./deploy/web`
  - `pnpm deploy --filter intelli-services ./deploy/intelli-services`

总之，不要在 workspace 根随手跑 `pnpm prune --prod`，尤其是在根包没有 `dependencies` 的情况下。

---

## 四、问题 3：Node ESM 下的 `ERR_MODULE_NOT_FOUND`（dist/routes/game）

### 4.1 现象

- 容器启动后，`intelli-services` 一直循环报错：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/apps/intelli-services/dist/routes/game' imported from /app/apps/intelli-services/dist/index.js
```

- 但是我们检查构建结果：
  - `apps/intelli-services/dist/routes/game.js` 是存在的。

### 4.2 背景知识：TypeScript + Node ESM 的导入规则差异

- `apps/intelli-services/package.json` 中：

```json
"type": "module"
```

- `tsconfig.json` 中：

```json
"module": "ESNext",
"moduleResolution": "bundler"
```

这意味着：

- **TypeScript 编译阶段** 按“bundler 风格”解析导入：
  - `import { gameRoutes } from './routes/game';`
  - TS 觉得 OK，不需要写 `.js`。
- 但 **Node.js 运行时**（ESM 模式）默认的解析规则是：
  - 相对导入必须写扩展名：`./routes/game.js`
  - 不写扩展名时，不会像 CommonJS 那样自动补 `.js`。
- 于是：
  - 源码里写的是 `./routes/game`
  - 构建后生成 `dist/routes/game.js`
  - Node 按字面去找 `/dist/routes/game`，找不到 => 抛 `ERR_MODULE_NOT_FOUND`。

### 4.3 临时修复：让 Node“更宽容”一点

为了不大改代码和 TS 配置，我们在 Docker 里给 Node 加了一个兼容开关：

- 修改 `docker/entrypoint.sh` 中启动 `intelli-services` 的命令：

```bash
log "启动 intelli-services (port=${SERVICES_PORT})"
# 为 Node 启用类似 CommonJS 的扩展解析，解决 ESM 下不写 .js 扩展导致的 ERR_MODULE_NOT_FOUND
PORT="${SERVICES_PORT}" NODE_OPTIONS="--experimental-specifier-resolution=node" pnpm --filter intelli-services --workspace-root start &
```

作用：

- 只影响 `intelli-services` 的 Node 进程；
- 在 ESM 模式下，`import './routes/game'` 这类导入，可以自动尝试补 `.js` 扩展，从而找到 `dist/routes/game.js`。

### 4.4 长期更“干净”的做法（可选）

以后如果想彻底“规范化”：

- **方案 A（推荐标准）**
  - 在所有 TS 源码里，把相对导入都写成带扩展名的形式（指向编译后产物）：
    - `import { gameRoutes } from './routes/game.js';`
    - `import { GameGenerator } from '../services/game-generator.js';` 等等。
  - tsconfig 中使用与 Node ESM 更匹配的 `moduleResolution: "node16"` 或 `"nodenext"`。
- **方案 B**
  - 保持目前 `bundler` 解析 + 不带扩展；
  - 但在所有生产环境（包括本地 node 启动脚本）统一加上：
    - `NODE_OPTIONS="--experimental-specifier-resolution=node"`。

目前我们在 Docker 里采用的是 **B 方案的落地版本**，优点是改动小、见效快。

---

## 五、整体排查思路小结

- **Nginx 报“指令不允许出现在这里”**：
  - 先查该指令理论上应该处于哪个上下文（main/http/server/location）；
  - 若语法没问题但依然报错，大概率是默认 `include` 的位置“阴间”，直接接管主配置是最干净的解法。

- **pnpm + monorepo 下依赖丢失**：
  - 一看到 `next: not found` / `dotenv` 找不到，又是在构建镜像后出现，就要想到：
    - 是否有 `pnpm prune --prod` / `npm prune --production` 这类操作；
    - 根包的 `dependencies` 是否为空，从而导致“全家桶”被当成 dev 依赖删掉。

- **Node ESM 的 ERR_MODULE_NOT_FOUND，但编译产物在那儿**：
  - 重点检查：
    - `package.json` 里是否 `"type": "module"`；
    - 是否缺少 `.js` 扩展名；
    - TS 的 `moduleResolution` 和 Node 的真实解析规则是否对齐。
  - 临时解法可以用 `--experimental-specifier-resolution=node` 快速救火。

---

## 六、这次踩坑带来的 checklist（以后可以复用）

- **Nginx 配置**
  - [ ] 确认 `upstream`、`server`、`access_log` 等是否在合法上下文中。
  - [ ] 尽量自己写 `/etc/nginx/nginx.conf`，避免和镜像默认配置“拼盘”。
  - [ ] 使用 `map` 对 WebSocket 的 `Upgrade/Connection` 做处理时，记得变量先定义再用。

- **pnpm + Docker**
  - [ ] 避免在 workspace 根贸然使用 `pnpm prune --prod`。
  - [ ] 优先考虑 `pnpm deploy` 或针对性 `--filter` 的方式做瘦身。
  - [ ] 构建阶段和运行阶段对 `node_modules` 的拷贝路径要清晰、唯一。

- **Node ESM / TS**
  - [ ] 如果 `"type": "module"`，尽量统一使用带后缀的导入：`'./xxx.js'`。
  - [ ] 保证 TS 的 `moduleResolution` 与运行环境（Node / bundler）一致。
  - [ ] 遇到 ESM 下 `ERR_MODULE_NOT_FOUND`，要对照“扩展名 + 相对路径”这一对。