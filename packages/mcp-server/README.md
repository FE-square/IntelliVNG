# @intellivng/mcp-server

> IntelliVNG 视觉小说游戏脚本分析 MCP Server

这是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的服务，提供视觉小说游戏脚本的分析工具。可被任何支持 MCP 的 AI 助手调用，用于验证和分析非线性叙事结构。

## 特性

- **结构校验**：检测孤立节点、死胡同、无效链接，保证剧情图没有硬错误。
- **路径分析**：枚举所有故事路径，评估非线性程度与多样性。
- **对话质量**：分析对话分布、角色出场与情绪丰富度，辅助节奏与风格优化。
- **分支分布**：检测“伪非线性”问题，确保关键分支不只集中在结局前。
- **约束合规**：对照创作者设定的目标节点数、结局数、路径深度、分支度，输出合规评分与违规清单。
- **非线性综合评分**：将多个分析维度融合为 0–100 的单一评分，便于前端展示与作品排序。
- **统一输出协议**：所有工具返回 `{ ok: boolean, data | error }`，宿主只需一次 JSON 解析即可复用全部能力。

---

## 工具列表

### 1. `validate_story_structure` —— 故事结构校验

**用途：**

- 保证从起始节点可以到达所有重要节点，避免“孤岛内容”。
- 检查非结局节点是否出现“死胡同”，避免玩家被卡死。
- 确保 `nextNodeId` 与分支指向的节点 ID 全部有效。

**典型场景：**

- Story Planner/Node Writer 生成一版剧情图后，Reviewer Agent 首先调用该工具，做静态结构检查，发现硬错误后再进入更高层的叙事审阅流程。

**输出示例：**

```json
{
  "ok": true,
  "data": {
    "valid": true,
    "orphans": [],
    "deadEnds": [],
    "invalidLinks": [],
    "reachableCount": 12,
    "totalCount": 12
  }
}
```

---

### 2. `analyze_story_paths` —— 路径与多样性分析

**用途：**

- 统计从起点到所有结局的完整路径数量。
- 计算平均路径长度、长度方差，衡量体验丰富度。
- 统计分支点数量与结局数量，作为“非线性程度”的基础指标。

**输出示例：**

```json
{
  "ok": true,
  "data": {
    "totalPaths": 5,
    "diversityScore": 0.75,
    "avgPathLength": 8.2,
    "lengthVariance": 4.5,
    "endingCount": 3,
    "branchPointCount": 4,
    "nonLinearityScore": 72
  }
}
```

---

### 3. `analyze_dialogue_quality` —— 对话质量与节奏分析

**用途：**

- 统计每个节点的对话条数与是否有旁白。
- 找出对话严重不足（< 2）或过多（> 8）的节点，辅助节奏控制。
- 分析角色发言分布和情绪分布，为风格统一和角色塑造提供量化参考。

**适用场景：**

- 与角色档案（CharacterDB）、风格指南（StyleGuide）结合使用，由上层智能体判断“谁说的话太少/太多”，“某个角色是否存在感不足”。

---

### 4. `analyze_branch_distribution` —— 分支分布与“伪非线性”检测

**用途：**

- 对 `functionTag`（setup/rising/conflict/climax/resolution） 维度统计各阶段分支数量。
- 对 `branchType`（route/relationship/information/ending）分类统计分支性质。
- 检测分支是否严重集中在高潮/结局阶段，从而判断是否存在“伪非线性”。

**输出示例：**

```json
{
  "ok": true,
  "data": {
    "isPseudoNonLinear": false,
    "distributionScore": 85,
    "branchByPhase": {
      "setup": 1,
      "rising": 2,
      "conflict": 1,
      "climax": 1,
      "resolution": 0
    },
    "branchTypeStats": {
      "route": 3,
      "relationship": 1,
      "information": 1,
      "ending": 0
    },
    "earlyBranchRatio": 0.6,
    "suggestions": [
      "分支分布良好！故事具有较好的非线性叙事结构。"
    ]
  }
}
```

---

### 5. `check_constraints_compliance` —— 约束合规检查

**用途：**

- 将创作者/前端表单里的“目标规格”（如：期望 12 个节点、3 个结局、最大深度 10、单节点最多 4 个分支）落为硬约束。
- 自动统计实际生成的剧情图，并输出违规列表与合规评分。

**这一步直接体现“AI 逻辑跟随能力”：**

- 上层 Agent 可以在 Prompt 中明确写入这些约束，然后由本工具做“事实判决”，如果不合格就触发重写或补写流程。

**输出示例：**

```json
{
  "ok": true,
  "data": {
    "nodeCount": 12,
    "endingCount": 3,
    "branchPointCount": 4,
    "maxDepthFound": 9,
    "maxBranchingFound": 3,
    "hasStart": true,
    "violations": [],
    "complianceScore": 100
  }
}
```

---

### 6. `score_nonlinearity` —— 非线性综合评分

**用途：**

- 将路径分析、分支分布分析等多个结果综合为单一的 0–100 分非线性评分。
- 方便前端直接展示“非线性得分雷达图/进度条”，或者在作品列表中排序。

**输出示例：**

```json
{
  "ok": true,
  "data": {
    "overallScore": 82,
    "components": {
      "pathNonLinearity": 78,
      "distributionScore": 86,
      "diversityScore": 70
    },
    "endingCount": 3,
    "branchPointCount": 4,
    "earlyBranchRatio": 0.55,
    "notes": [
      "非线性结构良好，可直接呈现。"
    ]
  }
}
```

---

## 与 IntelliVNG 多智能体工作流的衔接

在整体系统中，本 MCP 服务器主要与以下 Agent 协同工作：

- **Story Planner Agent**：生成 `NarrativePlan` 和 `PlanNode` 骨架。
- **Node Writer Agent**：为每个 PlanNode 填充对话、旁白、选项文案，产出 `NodeDraft`。
- **Story Reviewer Agent（ReAct 模式）**：
  - 在 ReAct 推理过程中，通过 MCP 调用本服务的多个工具：
    - 先用 `validate_story_structure` 和 `analyze_story_paths` 确认结构无误且足够非线性；
    - 再用 `analyze_dialogue_quality` 检查节奏与角色分布；
    - 用 `analyze_branch_distribution` 检测是否存在“伪非线性”；
    - 最后用 `check_constraints_compliance` 和 `score_nonlinearity` 给出机器可读的决策依据。
  - Reviewer 根据工具返回的结构化结果，决定是否对某些节点触发重写（回到 Node Writer），形成自动闭环。

这种设计展示了：

- **AI 逻辑跟随能力**：
  - 模型不是“凭感觉打分”，而是依赖工具返回的客观指标（节点数、路径深度、早期分支比例、约束合规度）来做决策。
- **模块化与可复用性**：
  - 即使更换 Story Planner/Node Writer 的实现，本 MCP 模块依然可以原样复用。

---

## 安装

```bash
# 在 IntelliVNG monorepo 根目录
pnpm install

# 或单独安装本包
cd packages/mcp-server
pnpm install
# 首次安装后会通过 prepare 自动编译 dist
```

---

## 使用方式

### 方式一：作为 MCP Server 运行

```bash
# 开发模式（便于调试）
pnpm dev

# 或构建后运行
pnpm build
pnpm start
```

### 方式二：在 Claude Desktop / Cursor 等宿主客户端中配置

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "intellivng": {
      "command": "node",
      "args": ["/path/to/intellivng/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 方式三：在 Cursor 中直接跑源码

在 `.cursor/mcp.json` 中配置：

```json
{
  "mcpServers": {
    "intellivng": {
      "command": "npx",
      "args": ["tsx", "/path/to/intellivng/packages/mcp-server/src/index.ts"]
    }
  }
}
```

> 所有工具返回的文本内容均为 JSON 字符串，请在宿主侧做一次 JSON.parse，然后读取 `ok`、`data` 或 `error` 字段。

---

## 节点数据格式约定

工具接受的最小节点格式示例（字段越全，分析越准确）：

```typescript
interface StoryNode {
  id: string;                          // 节点唯一标识
  type?: "scene" | "branch" | "ending"; // 节点类型
  isStart?: boolean;                   // 是否为起始节点
  isEnding?: boolean;                  // 是否为结局节点
  functionTag?:
    | "setup"
    | "rising"
    | "conflict"
    | "twist"
    | "climax"
    | "falling"
    | "resolution";                   // 叙事阶段标签（用于分支分布分析）
  nextNodeId?: string;                 // 线性推进下一个节点
  choices?: {                          // 分支选项（用于非线性和分支分析）
    targetNodeId: string;
    branchType?: "route" | "relationship" | "information" | "ending";
  }[];
  dialogues?: {                        // 对话列表（用于对话质量分析）
    characterName?: string;
    text: string;
    emotion?: string;
  }[];
  narration?: string;                  // 旁白
}
```

---

## 架构说明

```text
packages/mcp-server/
├── src/
│   ├── index.ts                    # MCP Server 入口，注册所有 MCP 工具
│   └── tools/
│       ├── validate-structure.ts   # 结构校验工具
│       ├── analyze-paths.ts        # 路径分析工具
│       ├── analyze-dialogue.ts     # 对话质量工具
│       ├── analyze-branch-distribution.ts  # 分支分布工具
│       ├── check-constraints.ts    # 约束合规工具
│       ├── score-nonlinearity.ts   # 非线性综合评分工具
│       └── index.ts                # 工具导出统一入口
├── package.json
├── tsconfig.json
└── README.md
```

## 设计理念

### 为什么需要这些工具？

在 AI 生成的非线性叙事中，常见问题包括：

1. **结构缺陷** - 孤立节点导致部分内容永远无法到达
2. **伪非线性** - 分支只在结局前出现，前期实际是线性的
3. **对话失衡** - 部分节点对话过少，玩家体验割裂

这些工具让 AI Agent 能够**客观分析**生成的故事结构，而不仅仅依赖主观判断。


- **Schema 驱动的原子能力**：
  - 所有工具均基于 Zod Schema 定义输入输出，便于与现有 `schemas.ts` 中的 `PlanNode` / `NodeDraft` / `CriticReport` 等类型对齐。
- **模型无关与可迁移性**：
  - 工具只依赖结构化数据，不依赖具体模型或 Prompt，可以迁移到任何 LLM 或规则系统上。
- **与评分标准强绑定的指标设计**：
  - 每一个返回字段都可以直接对照“技术创新性 / 工具链完成度 / AI 逻辑跟随 / 工具链复用”四个维度进行展示与汇报。
- **工程可维护性**：
  - MCP Server 作为独立 npm 包存在，可以单独测试、单独演进，不污染核心业务代码；同时又通过 MCP 与主系统紧密协同，体现“松耦合、高内聚”的架构思想。
