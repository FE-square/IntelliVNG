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

## 在 IntelliVNG 服务端（intelli-services）中接入

IntelliVNG 已在服务端实现了一个 **“MCP 工具版 Story Reviewer”**，用于让 Mastra Agent 在运行时通过 stdio 拉起并调用本 MCP server。

### 启用方式（推荐）

在 `apps/intelli-services/.env` 增加：

```env
REVIEWER_USE_MCP=true
```

启用后：

- `apps/intelli-services/src/mastra/index.ts` 会将 `"story-reviewer"` 注册为 MCP 版 agent；
- `apps/intelli-services/src/workflows/storyGeneration.ts` 会切换到 `workflow.review.mcp` 提示词，引导模型调用更多 MCP 工具；
- MCP server 默认会以 stdio 方式自动启动：
  - 优先使用 `packages/mcp-server/dist/index.js`
  - 若 dist 不存在，则 fallback 到 `npx tsx packages/mcp-server/src/index.ts`

### 覆盖 MCP server 启动方式（可选）

```env
INTELLIVNG_MCP_COMMAND=node
INTELLIVNG_MCP_ARGS=/abs/path/to/IntelliVNG/packages/mcp-server/dist/index.js
```

### 关键文件

- MCP client：`apps/intelli-services/src/services/intellivng-mcp-client.ts`
- MCP 版 Reviewer：`apps/intelli-services/src/agents/storyReviewer.mcp.ts`

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

### 方式一：通过 npx 直接运行（推荐）✨

已发布到 npm，可直接通过 npx 运行，无需克隆仓库：

```bash
npx @intellivng/mcp-server
```

在 Claude Desktop / Cursor 等 MCP 客户端中配置：

```json
{
  "mcpServers": {
    "intellivng": {
      "command": "npx",
      "args": ["-y", "@intellivng/mcp-server"]
    }
  }
}
```

> 📦 npm 包地址：https://www.npmjs.com/package/@intellivng/mcp-server

### 方式二：作为 MCP Server 本地运行

```bash
# 开发模式（便于调试）
pnpm dev

# 或构建后运行
pnpm build
pnpm start
```

### 方式三：在 Claude Desktop / Cursor 中指定本地路径

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

### 方式四：在 Cursor 中直接跑源码（开发调试）

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

### 1. “左脑 + 右脑”

借用 *Neuro-Symbolic Architecture* 理论的说法，本 MCP 服务不仅仅是工具箱，而是 IntelliVNG 的‘左脑’（理性层），与 LLM 的‘右脑’（生成层）。通过确定性的图论算法，修正概率性模型的逻辑缺陷。

我们做的事情可以简单理解为：

- **右脑：让大模型专心“写故事”**  
  Story Planner / Node Writer 负责根据设定去发挥想象力，写出对话、旁白和分支。

- **左脑：让一个小型“代码模块”专门挑错**  
  本 MCP Server 只是把几件很具体的事做扎实：  
  - 用图算法检查有没有走不出去的死胡同、孤立节点；  
  - 按用户的目标节点数 / 结局数 / 最大深度做约束校验；  
  - 把这些检查结果用统一的 JSON 结构返回给上层 Agent。

整个流程更像是“AI 写初稿 → 工程校验器挑错 → 再写一版”的协作：

**创意由 LLM 负责，严谨由确定性工具负责，两者各司其职。**

### 2. 认知无障碍 (Cognitive Accessibility)

在 `score_nonlinearity` 工具中，我们引入了 **“认知友好度 (Cognitive Friendly)”** 指标。

- 检测单节点分支数是否超过玩家的短时记忆负荷（>5 或 >7）。
- 我们对主应用和工具设计都深层思考如何提升 **无障碍设计** 和 **用户体验**，不仅仅关注技术实现，更关注最终玩家的认知负担。

### 3. 国际化架构 (Internationalization)

所有工具底层均内置 `i18n` 支持多语言国际化，通过输入参数自动切换。
让 AI Agent 在不同语言环境下都能获得准确的母语反馈。

### 4. 自修正闭环 (Self-Correction Loop)

为了实现 AI 逻辑跟随能力，我们设计了如下的自修正工作流：

```typescript
// 伪代码演示：自修正闭环
async function generatePerfectStory() {
  let story = await writerAgent.generate();
  let attempts = 0;

  while (attempts < 3) {
    // 调用 MCP 工具进行"左脑"检查
    const compliance = await mcp.check_constraints_compliance({
      nodes: story.nodes,
      constraints: { maxBranching: 4, targetEndingCount: 3 }
    });

    // 如果合规分 100，直接通过
    if (compliance.data.complianceScore === 100) break;

    // 否则，将违规项喂回给 Agent 进行针对性重写
    // 这就是"逻辑跟随"的具体体现
    const feedback = `检测到违规：${compliance.data.violations.join(", ")}。请修正这些问题。`;
    story = await writerAgent.regenerate(story, feedback);
    attempts++;
  }
  return story;
}
```

## 未来规划：

为了进一步践行 **“工具链复用”** 的设计理念，我们规划了后续的 MCP 服务扩展方向，旨在将 IntelliVNG 的生成能力与格式转换能力进一步解耦，成为通用的创作基础设施。

### 1. `asset-generator` MCP —— 通用资产生成服务

目前的资产生成（Character Sprites, Backgrounds, BGM）紧耦合在业务服务中。未来我们将把它们封装为独立的 MCP 工具，供任何 Agent 调用。

**规划工具：**
- `generate_character_sprite(prompt, style, pose)`: 生成带透明通道的角色立绘。
- `generate_background_image(prompt, style, mood)`: 生成符合场景氛围的背景图。
- `generate_bgm(mood, genre, duration)`: 生成背景音乐。

**价值：**
- **模块化**：其他游戏项目或 Agent 可直接复用此服务生成素材，无需关心底层是对接 SD 还是 Midjourney。
- **即时反馈**：Node Writer 写完一段剧情后，可直接调用此工具为该节点配图，实现“图文并茂”的创作流。

### 2. `format-converter` MCP —— 游戏引擎桥接器

为了打破创作工具的孤岛效应，我们将提供格式转换服务，支持将通用 JSON 剧本转译为各种游戏引擎的源码。

**规划工具：**
- `convert_to_renpy_script(node_json)`: 将剧本节点转换为 Ren'Py `.rpy` 脚本代码。
- `convert_to_unity_csharp(node_json)`: 生成适配 Unity 对话系统的 C# 数据类或 ScriptableObject。
- `export_full_project(target_engine)`: 打包所有资产与脚本，生成引擎工程文件。

**价值：**
- **工具链闭环**：补全了从“AI 生成”到“引擎运行”的最后一公里。
- **生态扩展**：不仅服务于 IntelliVNG 自身的 Web 播放器，更能赋能专业游戏开发者使用传统引擎进行后续开发。

---
