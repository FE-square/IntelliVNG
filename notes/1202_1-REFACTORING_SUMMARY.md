# IntelliVNG 重构优化总结报告

## 一、概述

本次重构旨在解决项目中存在的架构不一致、类型混乱、代码冗余等问题，并按照 monorepo 设计原则优化项目结构。主要改动包括类型统一、组件迁移、API 安全加固、存储机制重设计等。

---

## 二、核心改动

### 2.1 类型系统统一

**问题**：项目中同时存在 `ScriptNode` 和 `StoryNode` 两套节点类型定义，导致类型混乱和转换逻辑冗余。

**解决方案**：
- ✅ 删除 `packages/core/src/types/script.ts`（废弃的 `ScriptNode` 定义）
- ✅ 删除 `packages/core/src/utils/story-converter.ts`（转换工具）
- ✅ 统一使用 `StoryNode` 作为唯一的节点类型
- ✅ 更新 `GameProject.script` 类型为 `StoryNode[]`

**影响的文件**：
- `packages/core/src/types/game.ts` - 更新 script 类型
- `packages/core/src/index.ts` - 移除废弃导出
- `packages/player/src/engine/GameEngine.ts` - 使用 StoryNode
- `packages/editor/src/store/editorStore.ts` - 使用 StoryNode
- `apps/intelli-services/src/services/game-generator.ts` - 使用 StoryNode

### 2.2 组件迁移至 @vng/editor

**问题**：`FlowEditor` 等核心编辑器组件放置在 `apps/web` 中，违反 monorepo 设计原则。

**解决方案**：
- ✅ 迁移 `FlowEditor.tsx` 到 `packages/editor/src/components/`
- ✅ 迁移 `StoryNodeComponent.tsx` 到 `packages/editor/src/components/`
- ✅ 迁移 `NodeEditPanel.tsx` 到 `packages/editor/src/components/`
- ✅ 删除旧版本的 `ScriptCanvas.tsx`、`ChoiceNode.tsx`、`DialogueNode.tsx`
- ✅ 更新 `packages/editor/src/index.ts` 导出新组件

### 2.3 AI 图片生成 API 安全加固

**问题**：通义万相 API 直接在 Next.js 前端项目中调用，API Key 存在泄露风险。

**解决方案**：
- ✅ 创建 `apps/intelli-services/src/services/image-generator.ts`
- ✅ 在 `apps/intelli-services/src/routes/game.ts` 添加 `/api/game/generate-image` 路由
- ✅ 修改 `apps/web/src/app/api/generate-image/route.ts` 为代理路由
- ✅ API Key 现在仅在后端服务中使用

**API 调用流程变更**：
```
前端组件 → /api/generate-image (代理) → intelli-services → 通义万相 API
```

### 2.4 存储机制重设计

**问题**：项目数据直接存储在前端 localStorage，不符合前后端分离原则。

**解决方案**：
- ✅ 重构 `apps/web/src/lib/projectStorage.ts`：
  - `saveProject()` - 通过 API 保存到后端
  - `getProject()` - 从后端获取项目
  - `getAllProjects()` - 获取项目列表
  - `deleteProject()` - 删除项目
  - `saveDraft()` / `loadDraft()` - 本地草稿（仅保存表单状态）

**数据存储策略**：
| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| 完整项目数据 | 后端 API | 通过 `/api/projects/[id]` |
| 表单草稿 | localStorage | 仅保存用户输入状态 |
| UI 状态 | Zustand | 运行时状态管理 |

### 2.5 导出/导入功能

**新增功能**：
- ✅ 创建 `apps/web/src/lib/projectExport.ts`
  - `exportProjectAsJson()` - 导出项目为 JSON 文件
  - `importProjectFromJson()` - 从 JSON 文件导入项目
- ✅ 在编辑器页面添加导出按钮

### 2.6 Zustand Store 完善

**更新 `apps/web/src/stores/setupStore.ts`**：
- ✅ 添加 `backgrounds` 状态
- ✅ 添加 `addBackground()`, `updateBackground()`, `deleteBackground()` 方法

**更新 `apps/web/src/lib/projectStorage.ts`**：
- ✅ 更新 `ProjectMetadata` 接口，添加 `autoSaved` 和 `saveNote` 字段

---

## 三、Bug 修复

### 3.1 React 18 类型兼容性

**问题**：`@types/react` 18.3.x 与 18.2.x 版本冲突，导致 Button 组件 children 类型错误。

**解决**：
- ✅ 在根 `package.json` 添加 pnpm overrides 强制统一版本
- ✅ 更新 Button 组件使用 `React.PropsWithChildren`

### 3.2 Next.js 14 Suspense 边界

**问题**：`useSearchParams()` 在 Next.js 14 中需要 Suspense 边界。

**解决**：
- ✅ 重构 `apps/web/src/app/editor/page.tsx`，用 Suspense 包裹主内容

### 3.3 异步函数处理

**问题**：多处函数调用缺少 `await`。

**修复文件**：
- `apps/web/src/app/dashboard/page.tsx` - `loadProjects()`, `handleDelete()`
- `apps/web/src/app/setup/summary/page.tsx` - `saveProject()` 调用

### 3.4 类型导出修正

**问题**：`StoryDialogue` 未正确导出。

**解决**：
- ✅ 从 `@vng/core` 导出为 `Dialogue`
- ✅ 更新 `packages/player/src/components/GamePlayer.tsx` 导入

---

## 四、代码清理

### 4.1 删除废弃文件

- `packages/core/src/types/script.ts`
- `packages/core/src/utils/story-converter.ts`
- `packages/editor/src/components/ScriptCanvas.tsx`
- `packages/editor/src/components/nodes/ChoiceNode.tsx`
- `packages/editor/src/components/nodes/DialogueNode.tsx`

### 4.2 更新组件适配新类型

- `apps/web/src/components/SceneCardEditor.tsx` - 适配 StoryNode 数据结构
- `apps/web/src/app/editor/page.tsx` - 更新演示数据格式

---

## 五、配置更新

### 5.1 依赖版本锁定

```json
// package.json
{
  "pnpm": {
    "overrides": {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0"
    }
  }
}
```

### 5.2 环境变量

确保以下环境变量已配置：

```bash
# apps/intelli-services/.env
TONGYI_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1

# apps/web/.env
NEXT_PUBLIC_INTELLI_SERVICES_URL=http://localhost:4000
```

---

## 六、构建验证

✅ 所有构建任务通过：

```
 Tasks:    2 successful, 2 total
 Cached:    1 cached, 2 total
 Time:    15.677s
```

**构建产物**：
- `intelli-services:build` - TypeScript 编译通过
- `web:build` - Next.js 构建成功，16 个页面生成

---

## 七、重构过程中的难题与经验教训

本节记录重构过程中遇到的关键问题、排查思路和最终解决方案，为后续迭代提供参考。

### 7.1 🔴 难题一：React 18 类型系统的"幽灵冲突"

**现象描述**：
构建时报错 `Type 'Element' is not assignable to type 'ReactNode'. Property 'children' is missing in type 'Element' but required in type 'ReactPortal'`，指向 Button 组件内部使用 lucide-react 图标的地方。

**排查过程**：
1. 最初以为是 Button 组件的 `children` 类型定义问题，尝试了多种修复方案（显式声明 children、使用 PropsWithChildren、用 span 包裹内容）均无效
2. 检查发现项目中存在两个版本的 `@types/react`：
   ```
   @types/react@18.2.0  (package.json 声明)
   @types/react@18.3.27 (某个依赖间接引入)
   ```
3. React 18.3 的类型定义对 `ReactNode` 和 `ReactElement` 的兼容性做了破坏性变更

**解决方案**：
```json
// 在根 package.json 添加 pnpm overrides 强制统一版本
{
  "pnpm": {
    "overrides": {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0"
    }
  }
}
```
然后执行 `rm -rf node_modules pnpm-lock.yaml && pnpm install`

**经验教训**：
- ⚠️ Monorepo 中的类型包版本必须严格统一
- ⚠️ 遇到类型错误时，先检查 `node_modules` 中的实际版本
- ⚠️ pnpm 的 `overrides` 是解决依赖版本冲突的利器
- ⚠️ 升级依赖前先在 CHANGELOG 中查看是否有 Breaking Changes

---

### 7.2 🔴 难题二：Next.js 14 的 Suspense 边界要求

**现象描述**：
构建成功但生成静态页面时报错：`useSearchParams() should be wrapped in a suspense boundary at page "/editor"`

**背景分析**：
Next.js 14 对 App Router 中的客户端 hooks 做了更严格的限制。`useSearchParams()` 在服务端渲染时会触发 bailout，必须用 `<Suspense>` 包裹以提供 fallback UI。

**解决方案**：
```tsx
// 将原组件改名为 Content 组件
function EditorPageContent() {
    const searchParams = useSearchParams();
    // ... 原有逻辑
}

// 新的默认导出用 Suspense 包裹
export default function EditorPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <EditorPageContent />
        </Suspense>
    );
}
```

**经验教训**：
- ⚠️ Next.js 14+ 中使用 `useSearchParams`、`usePathname` 等 hooks 必须考虑 Suspense
- ⚠️ 升级 Next.js 版本后要仔细阅读 Migration Guide
- ⚠️ 建议创建一个通用的 `withSuspense` HOC 或 wrapper 组件

---

### 7.3 🟡 难题三：类型定义散落导致的"定义漂移"

**现象描述**：
项目中存在多处重复的类型定义：
- `@vng/core` 中有 `StoryNode` 和 `ScriptNode`
- `intelli-services` 中有内联的 `GameProject`、`ScriptNode` 定义
- 各处的字段定义略有差异

**问题根源**：
早期开发中为了快速迭代，在不同模块中直接定义了所需类型，没有统一从 `@vng/core` 导入。

**解决方案**：
1. 确定 `@vng/core` 为唯一的类型来源（Single Source of Truth）
2. 删除其他地方的重复定义
3. 使用 `import type { ... } from '@vng/core'` 导入类型
4. 在 `@vng/core/src/index.ts` 中显式导出所有公共类型

**经验教训**：
- ⚠️ 在项目初期就建立"类型集中管理"的规范
- ⚠️ 使用 `import type` 语法明确类型导入
- ⚠️ 定期运行 `grep` 检查是否有重复的 `interface` 定义
- ⚠️ 建议添加 ESLint 规则禁止在非 `@vng/core` 中定义共享类型

---

### 7.4 🟡 难题四：异步函数的"静默失败"

**现象描述**：
多处将 `Promise<T>` 赋值给同步变量使用，TypeScript 在 strict 模式下报错：
```
This condition will always return true since this 'Promise<boolean>' is always defined.
```

**问题代码示例**：
```typescript
// ❌ 错误：saveProject 返回 Promise<boolean>
const saved = saveProject(result.data);
if (saved) { ... }  // 永远为 true，因为 Promise 对象本身是 truthy
```

**正确写法**：
```typescript
// ✅ 正确：等待 Promise 解析
const saved = await saveProject(result.data);
if (saved) { ... }
```

**受影响的文件**：
- `dashboard/page.tsx` - `loadProjects()`, `handleDelete()`
- `summary/page.tsx` - `saveProject()` 调用

**经验教训**：
- ⚠️ 将 API 从同步改为异步时，必须全局搜索调用点
- ⚠️ 启用 `@typescript-eslint/no-floating-promises` 规则
- ⚠️ 建议在异步函数名中加入 `async` 后缀或使用 `*Async` 命名约定

---

### 7.5 🟡 难题五：组件迁移后的导入路径问题

**现象描述**：
将 `FlowEditor` 等组件从 `apps/web/src/components` 迁移到 `packages/editor/src/components` 后，需要更新所有导入路径。

**迁移步骤**：
1. 复制组件到目标位置
2. 更新 `packages/editor/src/index.ts` 导出
3. 修改 `apps/web/src/app/editor/page.tsx` 的导入
4. 删除原文件
5. 运行构建验证

**遇到的问题**：
- 组件内部可能依赖 `apps/web` 的相对路径（如 `@/stores/setupStore`）
- 需要检查组件的所有 import 语句并调整

**经验教训**：
- ⚠️ 迁移前先分析组件的依赖关系图
- ⚠️ 使用 IDE 的 "Move" 功能可以自动更新部分导入
- ⚠️ 建议为每个 package 配置 TypeScript 的 `paths` 映射
- ⚠️ 迁移后立即运行 `pnpm build` 验证

---

### 7.6 🟢 经验总结：Turbo 缓存的"陷阱"

**现象描述**：
修改代码后构建，但输出仍是旧的错误信息。

**原因**：
Turborepo 会缓存构建结果，如果 hash 没变化就复用缓存。但有时候 `.ts` 文件的修改没有被正确检测到。

**解决方案**：
```bash
# 清理所有缓存后重新构建
rm -rf .turbo node_modules/.cache apps/web/.next
pnpm build
```

**经验教训**：
- ⚠️ 遇到"幽灵问题"时先清缓存
- ⚠️ 在 CI 中考虑是否需要 `--force` 选项
- ⚠️ 确保 `turbo.json` 中的 `inputs` 配置覆盖所有源文件

---

### 7.7 📋 重构检查清单（供未来参考）

基于本次经验，建议在进行类似重构时检查以下事项：

| 检查项 | 说明 |
|--------|------|
| ☐ 类型版本一致性 | 检查 `@types/*` 包是否有版本冲突 |
| ☐ 异步调用完整性 | 搜索所有 `Promise` 返回值是否正确 `await` |
| ☐ 导入路径正确性 | 验证组件迁移后的所有导入路径 |
| ☐ 导出声明完整性 | 确保 index.ts 导出所有公共 API |
| ☐ Next.js 兼容性 | 检查 Suspense 边界、Server/Client 组件 |
| ☐ 缓存清理 | 构建前清理 `.turbo`、`.next`、`node_modules/.cache` |
| ☐ 环境变量迁移 | 确保敏感信息不暴露在前端 |
| ☐ 数据结构兼容 | 验证新旧数据结构的映射关系 |

---

## 八、后续建议

### 8.1 高优先级

1. **添加单元测试** - 为核心类型转换和存储逻辑添加测试
2. **完善 API 错误处理** - 统一前后端错误响应格式
3. **数据库集成** - 将文件系统存储迁移到数据库

### 8.2 中优先级

4. **添加日志系统** - 使用 pino 或 winston 进行结构化日志
5. **性能优化** - React.memo 和 useMemo 优化编辑器渲染
6. **完善类型定义** - 为所有 API 响应添加类型

### 8.3 低优先级

7. **CI/CD 配置** - 添加 GitHub Actions 自动化测试和部署
8. **文档完善** - 添加 API 文档和组件使用说明
9. **国际化支持** - 准备多语言架构

---

## 九、总结

本次重构解决了项目中的主要架构问题：

| 问题领域 | 改进前 | 改进后 |
|---------|--------|--------|
| 类型系统 | ScriptNode/StoryNode 混用 | 统一使用 StoryNode |
| 组件位置 | 编辑器组件在 apps/web | 迁移到 @vng/editor |
| API 安全 | 前端直接调用第三方 API | 后端代理，密钥隔离 |
| 数据存储 | 全部存 localStorage | 前端表单/后端数据分离 |
| 代码质量 | 存在废弃代码 | 清理冗余，类型完整 |

项目现在具有更清晰的架构、更安全的 API 调用方式和更规范的数据流转机制。

---

*报告生成日期：2025-12-01*

