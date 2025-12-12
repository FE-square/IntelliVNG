## 背景

当前 `apps/intelli-services/src/agents/` 内的服务端 Agent 基于 Mastra 实现，其中 **Story Reviewer** 具备工具调用（ReAct）能力。仓库内 `packages/mcp-server/` 已提供一套确定性分析工具（结构校验、路径分析、分支分布、约束合规、非线性评分等）。

## MCP Server 工具盘点（packages/mcp-server）

### 工具清单（tool name）
- `validate_story_structure`：结构校验（孤立节点、死胡同、无效链接等）
- `analyze_story_paths`：路径枚举与多样性/非线性指标
- `analyze_dialogue_quality`：对话质量统计（平均对话数、角色/情绪分布、质量分）
- `analyze_branch_distribution`：分支分布与“伪非线性”检测（早期分支占比、建议）
- `check_constraints_compliance`：对照 constraints 的规模/深度/分支约束合规
- `score_nonlinearity`：综合非线性评分（路径、分布、多样性、认知友好度）

### 统一返回协议
`mcp-server` 所有工具返回的 `content[0].text` 为 JSON 字符串：
- 成功：`{ "ok": true, "data": <toolResult> }`
- 失败：`{ "ok": false, "error": "message" }`

intelli-services 侧只需要做一次 `JSON.parse` 即可读取。

---

## 合理性检查与修复

为了避免接入后 Reviewer 得到错误判决，本次对 `mcp-server` 做了 3 个小修复：

1. **analyze-dialogue**：当 `nodes=[]` 时避免 `avgDialoguesPerNode` 产生 `NaN`，改为返回全 0 的统计结构。
2. **check-constraints**：原实现 `findStart()` 会回退到 `nodes[0]`，导致 “缺少 start” 违规永远无法触发；改为区分 `hasStart`（是否存在显式 `isStart`）与 `startNode`（用于计算深度的起点）。
3. **analyze-branch-distribution**：`allEnding` 检测原逻辑将 “ending 分支选项数” 与 “分支点节点数” 混用；改为用 `totalBranchChoices`（所有分支选项总数）做一致比较。

---

## Intelli-services 侧接入设计

### 总体策略：双轨并存
- 保留现有本地工具版：`apps/intelli-services/src/agents/storyReviewer.ts`
- 新增 MCP 版：`apps/intelli-services/src/agents/storyReviewer.mcp.ts`
- 通过 env 控制切换：默认仍走原版；开启后走 MCP 版

### MCP Client 设计（stdio）
实现文件：`apps/intelli-services/src/services/intellivng-mcp-client.ts`

特性：
- 复用 MCP 连接（单例 `clientPromise`）
- 统一解析 MCP 返回 JSON envelope，异常统一抛出
- 启动命令可通过 env 覆盖：
  - `INTELLIVNG_MCP_COMMAND`
  - `INTELLIVNG_MCP_ARGS`
- 默认启动本仓库内：
  - 优先 `packages/mcp-server/dist/index.js`
  - 若 dist 不存在，fallback：`npx tsx packages/mcp-server/src/index.ts`

---

## Story Reviewer 的 MCP 版本（接入点）

实现文件：`apps/intelli-services/src/agents/storyReviewer.mcp.ts`

关键点：
- 工具 id 保持与原版一致（便于复用提示词风格）：
  - `validate-structure` → MCP `validate_story_structure`
  - `analyze-paths` → MCP `analyze_story_paths`
  - `analyze-dialogue-quality` → MCP `analyze_dialogue_quality`
  - 额外提供：
    - `analyze-branch-distribution` → MCP `analyze_branch_distribution`
    - `check-constraints-compliance` → MCP `check_constraints_compliance`
    - `score-nonlinearity` → MCP `score_nonlinearity`

### Prompt 增量
- 新增 `story-reviewer.instructions.mcp` / `story-reviewer.react.mcp`
- 新增 `workflow.review.mcp`（工作流中可选启用）

---

## 工作流切换方式

### 1) Mastra Agent 层切换（推荐）
文件：`apps/intelli-services/src/mastra/index.ts`

通过 env：
- `REVIEWER_USE_MCP=true`：将 `"story-reviewer"` 注册为 MCP 版 agent
- 默认：仍为原版 agent

### 2) Prompt 层切换（可选）
文件：`apps/intelli-services/src/workflows/storyGeneration.ts`

当 `REVIEWER_USE_MCP=true` 时，`review` step 使用 `workflow.review.mcp`，引导模型调用更多 MCP 工具。

---

## 运行与验证建议

1) 安装依赖
- `apps/intelli-services` 需要依赖 `@modelcontextprotocol/sdk`（已加入 dependencies）

2) 本地启用 MCP Reviewer
- 设置 env：`REVIEWER_USE_MCP=true`
- 启动 `intelli-services`，review 阶段会通过 stdio 自动拉起 `mcp-server`

3) 自定义启动 MCP server
- 若你想连接到外部 MCP server 或不同启动方式，使用：
  - `INTELLIVNG_MCP_COMMAND`
  - `INTELLIVNG_MCP_ARGS`

