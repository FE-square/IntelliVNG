## 镜像构建和Nginx看起来都成功了，但是报错依赖缺失：

```
[2025-12-06 12:30:52] apps/web start: sh: next: not found
[2025-12-06 12:30:52] /app/apps/web:
[2025-12-06 12:30:52]  ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  web@0.0.0 start: `next start`
[2025-12-06 12:30:52] spawn ENOENT
[2025-12-06 12:30:52] apps/intelli-services start: node:internal/modules/esm/resolve:873
[2025-12-06 12:30:52] apps/intelli-services start:   throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
[2025-12-06 12:30:52] apps/intelli-services start:         ^
[2025-12-06 12:30:52] apps/intelli-services start: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dotenv' imported from /app/apps/intelli-services/dist/index.js
[2025-12-06 12:30:52] apps/intelli-services start:     at packageResolve (node:internal/modules/esm/resolve:873:9)
[2025-12-06 12:30:52] apps/intelli-services start:     at moduleResolve (node:internal/modules/esm/resolve:946:18)
[2025-12-06 12:30:52] apps/intelli-services start:     at defaultResolve (node:internal/modules/esm/resolve:1188:11)
[2025-12-06 12:30:52] apps/intelli-services start:     at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)
[2025-12-06 12:30:52] apps/intelli-services start:     at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)
[2025-12-06 12:30:52] apps/intelli-services start:     at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)
[2025-12-06 12:30:52] apps/intelli-services start:     at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)
[2025-12-06 12:30:52] apps/intelli-services start:     at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {
[2025-12-06 12:30:52] apps/intelli-services start:   code: 'ERR_MODULE_NOT_FOUND'
[2025-12-06 12:30:52] apps/intelli-services start: }
[2025-12-06 12:30:52] apps/intelli-services start: Node.js v20.19.6
[2025-12-06 12:30:52] apps/intelli-services start: Failed
```

- 线索一：`sh: next: not found`
- 线索二：`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dotenv'`

- 案件聚焦：pnpm prune 和 Dockerfile 的一个致命细节
两个线索都指向了 node_modules 文件夹在运行时状态不正确。让我们回到 Dockerfile 中那个看似无害的 builder 阶段的瘦身命令：

```
# in builder stage
RUN CI=true pnpm prune --prod && rm -rf apps/web/.next/cache
```

`pnpm prune --prod` 的作用是移除所有 devDependencies。

为什么会这样？是不是恰巧只有这两个依赖被放错了位置？

- dotenv: 检查 apps/intelli-services/package.json 文件，dotenv 是不是被写在了 devDependencies 下面？如果是，这就是它被删除的原因。
- next: 检查 apps/web/package.json 文件。

然而并没有，我们的依赖声明都是非常自然符合预期的

## 可是，为什么它们会被删除呢？我看依赖声明位置没错呀

原因不在于 `next` / `dotenv` 写错了位置，而在于 **你在 workspace 根目录跑了 `pnpm prune --prod`**。

在 pnpm 的多包仓库里：

- **`pnpm prune --prod` 的保留逻辑是：从「当前 package.json 的 `dependencies`」作为根，沿着依赖图往下保留依赖，其余一律当作“仅开发用”删除。**
- 你的根 `package.json`（仓库根）只有 `devDependencies`（`turbo`、`prettier`、`typescript`），**没有任何 `dependencies`**：

```json
{
  "name": "intellivng",
  "private": true,
  "scripts": { ... },
  "devDependencies": { ... }
}
```

- `web` 和 `intelli-services` 这两个子包虽然各自的 `package.json` 里把 `next`、`dotenv` 正确写在了 `dependencies`，但在 pnpm 眼里：  
  它们只是“被根包脚本调用的 workspace 包”，**不是根包的生产依赖**，所以从根执行 `pnpm prune --prod` 时，这两个包及其依赖（包括 `next`、`dotenv`）都会被当成“非生产依赖”整体裁掉。

所以：

- **依赖声明本身是正确的。**
- **真正导致它们消失的是在根目录执行的 `pnpm prune --prod`，而根包没有任何生产依赖可保留。**

我们已经在 Dockerfile 里去掉了这一行，重新构建后 `next` / `dotenv` 就会保留下来。  
如果以后还想“瘦身”，应该用更精细的方式，比如：

- 只对某个 app 做：`pnpm prune --prod --filter web` / `--filter intelli-services`  
- 或使用 `pnpm deploy`（pnpm 官方推荐的部署命令），而不是在 workspace 根随手 `prune --prod`。