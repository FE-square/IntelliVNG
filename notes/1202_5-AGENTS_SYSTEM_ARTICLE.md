# IntelliVNG Studio 多智能体视觉小说创作编排系统：设计与实现

> ## 摘要
> 本文详细介绍 IntelliVNG 的核心创新——多智能体小说剧本创作系统。该采用 **3 Agent + 1 Orchestrator** 架构，通过 Tree-of-Thoughts、ReAct、Few-Shot CoT 等先进的 AI Agent 设计模式与 工具调用，实现了从"单一 Prompt 调用"到"多智能体协作"的技术跃迁。

## 写在前面：我们到底在做什么？

如果你从来没有玩过视觉小说游戏，也不太了解我们在做的工具，这一小节就是专门写给你的。

### 什么是“视觉小说”？

简单说，视觉小说是一种**以文字和立绘为主的互动叙事游戏**：

- 屏幕上通常只有几个人物立绘 + 一段段对话/旁白  
- 玩家通过阅读对话，在关键节点做出选择  
- 不同选择会走向不同的剧情分支，最终到达不同的结局  

你可以把它想象成：**“可以玩的电子小说 / 漫画脚本”**。

### 我们的工具要做什么？

IntelliVNG Studio 想做的是一款 **“从 0 到 可玩的多结局视觉小说” 的一站式 AI 创作工具**：

- **创作入口很轻**：用户只需要在网页上填写表单，不用写一行代码，不用写一行 Prompt：  
  - 世界观（时代、地点、规则……）  
  - 角色（姓名、性格、关系……）  
  - 场景（教室、天台、异世界城堡……）  
  - 主题/基调（悬疑、治愈、黑暗……）  
- **中间过程很“聪明”**：AI 自动帮你：  
  - 设计一个带分支的故事骨架  
  - 为每个节点写出完整对话和旁白  
  - 给出多个风格不同的结局  
- **结果可以直接“玩”**：  
  - 在可视化 Flow Editor 中查看和微调节点  
  - 一键导出成可运行的游戏工程（接到玩家端）

换句话说：**普通人即使完全不会写剧本，也可以在 5–10 分钟内，从一个模糊的想法走到一部“能玩”的多结局视觉小说。**

### 设计这个工具，需要考虑哪些问题？

从“做个酷炫 Demo”到“做一个真的好用的创作工具”，中间有不少现实问题需要解决，例如：

- **从故事角度**：  
  - 如何保证剧情有起承转合，而不是一条平铺直叙的“流水账”？  
  - 如何让每个分支选择都真正影响故事，而不是“左边右边其实都走到同一个结局”？  
- **从工程角度**：  
  - 如何保证图上的每个节点都能从开头走到结尾，没有死胡同、没有孤立节点？  
  - 如何让自动生成输出的剧本直接喂给我们的编辑器和玩家引擎，而不是再人工“翻译”一遍？  
- **从产品体验角度**：  
  - 用户点下“生成”之后，不能一直黑屏，要看到“目前在做什么、进度到了哪一步”？  
  - 出现问题时，能不能只修一个局部节点，而不是整篇重来？  

这篇文章后面的内容，会从这些“非常实际的问题”出发，讲清楚我们是怎么一步步从“单次 LLM 调用”，走到现在这个 **多智能体 + 工作流 + 实时进度** 的系统设计的。

## 一、需求初衷：为什么需要多智能体方案 (Multi-Agent)？

### 1.1 原有方案的局限

在 IntelliVNG 早期版本中，我们使用单一的 LLM 调用来生成剧本：

```typescript
// 旧版：一个巨大的 Prompt，一次调用
const response = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: DIRECTOR_SYSTEM_PROMPT }, // 500+ 行的 prompt
    { role: 'user', content: userSetupPrompt },
  ],
  max_tokens: 10000, // 反复调试才得到一个不会截断的配置
});
```

这种方案存在几个关键问题：

| 问题 | 表现 | 影响 |
|------|------|------|
| **可控性差** | 无法干预生成过程 | 输出质量不稳定 |
| **可解释性弱** | 黑盒生成，无法追踪决策 | 难以调试和优化 |
| **扩展性受限** | 所有逻辑压缩在一个 Prompt | 难以添加新功能 |
| **缺乏自主性** | 完全依赖单次推理 | 无法迭代改进 |

### 1.2 我们理想中的“下一代 AI 剧本工具”

我们在设计 IntelliVNG 这套系统时，有一条很直觉的价值观：**“既然要做一个 AI 剧本工具，那它就应该代表我们心目中‘下一代创作工具’的样子。”**

从这个出发点回看前面的痛点，我们自然推演出了几条必须满足的能力要求：

- **技术层面要有真正的“新东西”**  
  不满足于“在服务端塞一个超长 Prompt”，而是希望它本身就是一套可以复用、可以演进的 AI 系统架构—— 有清晰的角色分工（不同 Agent）、有结构化的数据流（Schema + Workflow）、也有可观察的内部过程。

- **AI 的逻辑要能被“看见”和“复盘”**  
  当一个故事结构被拒绝、某个节点被判定为“有问题”时，我们希望能看到：它是根据哪些事实、通过怎样的推理链条得出这个结论的，而不是一个“60 分/80 分”的黑盒分数。

- **智能体之间要能真正“协作”，而不是堆几个模型名字**  
  一个负责规划结构、一个负责写具体文本、一个负责审阅和给出修改建议—— 这些 Agent 之间要有明确的输入输出、清晰的上下游关系，而不是简单地“串联大模型API调用”。

### 1.3 设计目标

基于以上分析，我们设定了多智能体系统的设计目标：

```
┌──────────────────────────────────────────────────────────────┐
│                        设计目标                               │
├──────────────────────────────────────────────────────────────┤
│  ✓ 可追踪性：每个决策都有推理过程，可观测、可解释            │
│  ✓ 可控性：支持阶段性干预，可以重试特定步骤                  │
│  ✓ 高质量：多轮迭代优化，自动检测和修复问题                  │
│  ✓ 可扩展性：模块化设计，易于添加新的 Agent 或工具           │
│  ✓ 演示性：清晰的阶段划分，便于 Hackathon 现场展示           │
└──────────────────────────────────────────────────────────────┘
```

## 二、设计哲学：分而治之 + 专业分工

### 2.1 核心理念

我们的设计哲学源自两个核心观察：

**观察 1：复杂任务需要分解**

创作一个视觉小说剧本涉及多个维度的决策：
- 故事结构设计（宏观）
- 对话撰写（微观）
- 质量把控（元层面）

这些任务性质不同，需要不同的思维模式。

**观察 2：专业分工提升质量**

在人类创作团队中，通常有：
- **编剧** 负责故事架构
- **写手** 负责具体文案
- **编辑** 负责审稿把关

我们的多智能体系统模拟了这种专业分工。

### 2.2 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR (编排者)                              │
│                        采用 Plan-and-Execute 状态机                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │   PLANNING  │───►│   WRITING   │───►│  REVIEWING  │──┐                   │
│  │    阶段     │    │    阶段     │    │    阶段     │  │                   │
│  └─────────────┘    └─────────────┘    └─────────────┘  │                   │
│         ▲                                    │          │                   │
│         └────────────────────────────────────┘          │                   │
│                    (需要重写时回退)                       │                   │
│                                                          ▼                   │
│                                              ┌─────────────┐                │
│                                              │   OUTPUT    │                │
│                                              │ GameProject │                │
│                                              └─────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHARED CONTEXT (共享上下文)                          │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  WorldBible  │  │ CharacterDB  │  │  StyleGuide  │  │  NodeDrafts  │    │
│  │  (世界观)     │  │  (角色档案)   │  │  (风格指南)   │  │  (节点草稿)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 三、Agent 设计：三位专家 + 一位指挥

### 3.1 Agent 角色映射

| Agent | 人类角色 | 核心职责 | 技术模式 |
|-------|---------|---------|---------|
| **Story Planner** | 总编剧 | 设计故事骨架 | Tree-of-Thoughts |
| **Node Writer** | 场景写手 | 撰写对话旁白 | Few-Shot CoT |
| **Story Reviewer** | 责任编辑 | 质量审核 | ReAct |
| **Orchestrator** | 项目经理 | 流程调度 | Plan-and-Execute |

### 3.2 为什么是这三个 Agent？

我们通过任务分析确定了三个 Agent 的必要性：

```
剧本创作任务分解
├── 结构设计（全局视角）
│   ├── 设计故事前提
│   ├── 规划分支结构
│   └── 确定结局走向
│   └── → Story Planner（需要探索多种可能性）
│
├── 内容生成（局部视角）
│   ├── 撰写对话
│   ├── 设置旁白
│   └── 编写选项文案
│   └── → Node Writer（需要并行高效处理）
│
└── 质量保障（审视视角）
    ├── 检查结构完整性
    ├── 验证角色一致性
    └── 评估分支意义
    └── → Story Reviewer（需要模型工具调用 辅助精确判断）
```

### 3.3 为什么不能合并？

**问题：能否用一个"超级 Agent"完成所有任务？**

答案是不行，原因如下：

| 维度 | 单 Agent | 多 Agent |
|------|---------|---------|
| **上下文压力** | 需要同时关注全局和细节，容易顾此失彼 | 各司其职，专注自己的任务 |
| **推理深度** | 无法在单次调用中进行多层级推理 | 每个 Agent 在自己领域深入推理 |
| **可观测性** | 决策过程是黑盒 | 每个阶段的输入输出都可追踪 |
| **错误恢复** | 一旦出错只能重新开始 | 可以只重试特定 Agent |

## 四、技术模式详解

### 4.1 Story Planner：Tree-of-Thoughts (ToT)

#### 什么是 Tree-of-Thoughts？

Tree-of-Thoughts 是一种结构化推理方法，核心思想是：**不急于得出结论，而是先探索多种可能性，评估后再选择最优路径**。

这类似于国际象棋大师的思维方式——在走一步棋之前，先在脑中模拟多种可能的走法，评估每种走法的后果，然后选择最优解。

#### 为什么 Story Planner 需要 ToT？

故事结构设计是一个**开放性问题**，同样的角色设定可以发展出多种截然不同的故事：

```
角色: 小明（高中生）、小红（班长）
设定: 校园、现代

可能的故事方向：
├── 冲突型: 小明与小红因班级事务产生矛盾，最终和解
├── 成长型: 小明在小红的影响下逐渐成熟
├── 悬疑型: 学校发生神秘事件，两人联手调查
└── 浪漫型: 从误会到相知的校园恋爱故事
```

如果直接让 LLM 生成故事结构，它会"随机"选择一个方向，结果不可控。ToT 让我们**有意识地探索多种可能性，然后基于明确的评估标准选择最优方案**。

#### ToT 的三轮实现

```
Round 1: 生成候选方向 (Generate)
┌─────────────────────────────────────────────────────────────────┐
│  LLM 调用 1: "根据设定，生成 3 个不同的叙事方向"                    │
│                                                                 │
│  输出:                                                          │
│  ├── Path A: 冲突型 - "一个关于误解与和解的故事"                   │
│  ├── Path B: 成长型 - "一个关于自我发现的故事"                     │
│  └── Path C: 悬疑型 - "一个关于真相追寻的故事"                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Round 2: 评估每个方向 (Evaluate)
┌─────────────────────────────────────────────────────────────────┐
│  LLM 调用 2: "对每个方向打分并选择最佳"                            │
│                                                                 │
│  评分维度:                                                       │
│  ├── 戏剧性 (1-5): 冲突是否激烈                                   │
│  ├── 角色契合度 (1-5): 是否能发挥角色特点                         │
│  ├── 分支潜力 (1-5): 是否容易设计有意义的选择                     │
│  └── 主题深度 (1-5): 是否有思考价值                               │
│                                                                 │
│  结果:                                                          │
│  ├── Path A: 4+5+4+3 = 16 ← 最高分                              │
│  ├── Path B: 3+4+3+4 = 14                                       │
│  └── Path C: 5+3+4+3 = 15                                       │
│                                                                 │
│  选择: Path A (冲突型)                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Round 3: 展开节点骨架 (Expand)
┌─────────────────────────────────────────────────────────────────┐
│  LLM 调用 3: "基于选定方向，设计完整的节点结构"                     │
│                                                                 │
│  输出: NarrativePlan                                            │
│  ├── outline: { premise, centralConflict, thematicArc }        │
│  └── nodes: [                                                   │
│        { id: "start", type: "scene", title: "初遇", ... },     │
│        { id: "branch-1", type: "branch", title: "选择", ... }, │
│        { id: "ending-a", type: "ending", title: "和解", ... }, │
│        ...                                                      │
│      ]                                                          │
└─────────────────────────────────────────────────────────────────┘
```

#### 代码实现

```typescript
// apps/intelli-services/src/agents/storyPlanner.ts

export async function generateNarrativePlanWithToT(
  agent: typeof storyPlannerAgent,
  input: WorkflowInput
): Promise<NarrativePlan> {
  console.log("[ToT] 🌳 开始 Tree-of-Thoughts 规划...");

  // ============ Round 1: 生成候选叙事方向 ============
  console.log("[ToT] Round 1: 生成候选叙事方向...");
  
  const candidatesResponse = await agent.generate(generatePrompt, {
    structuredOutput: { schema: CandidatePathsSchema },
  });
  const candidates = candidatesResponse.object;
  
  // ============ Round 2: 评估每个候选方向 ============
  console.log("[ToT] Round 2: 评估候选方向...");
  
  const evaluationResponse = await agent.generate(evaluatePrompt, {
    structuredOutput: { schema: AllEvaluationsSchema },
  });
  const evaluation = evaluationResponse.object;
  const selectedPath = candidates.paths.find(
    p => p.id === evaluation.selectedPathId
  );
  
  // ============ Round 3: 展开为完整节点骨架 ============
  console.log("[ToT] Round 3: 展开节点骨架...");
  
  const planResponse = await agent.generate(expandPrompt, {
    structuredOutput: { schema: NarrativePlanSchema },
  });
  
  return planResponse.object;
}
```

#### ToT 的优势

| 优势 | 说明 |
|------|------|
| **决策透明** | 每个选择都有评分和理由，可追溯 |
| **质量可控** | 通过评分标准引导 LLM 的选择 |
| **多样性** | 即使最终只选一个方向，也探索了多种可能 |
| **可复现** | 给定相同输入，评分标准确保相对稳定的输出 |

### 4.2 Story Reviewer：ReAct (Reasoning + Acting)

#### 什么是 ReAct？

ReAct 是一种将**推理 (Reasoning)** 和**行动 (Acting)** 交织的 Agent 模式。Agent 不是一次性得出结论，而是：

1. **Thought**: 思考当前应该做什么
2. **Action**: 调用工具获取信息
3. **Observation**: 观察工具返回的结果
4. **Repeat**: 基于新信息继续思考，直到得出结论

#### 为什么 Story Reviewer 需要 ReAct？

故事审核需要**客观的数据支撑**，而不仅仅是主观判断：

```
审核问题                          需要的支撑
├── "故事结构是否完整？"     →    节点连通性分析（工具）
├── "是否有孤立节点？"       →    BFS 可达性检查（工具）
├── "分支是否有意义？"       →    路径多样性统计（工具）
└── "对话质量如何？"         →    对话数量分析（工具）
```

如果没有工具，LLM 只能"凭感觉"评分，结果不可靠。ReAct 让 Reviewer 先**收集证据**，再**基于证据推理**。

#### ReAct 的运行流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      ReAct 循环                                  │
│                                                                 │
│  Thought: "我需要先检查故事的结构是否完整..."                      │
│      │                                                          │
│      ▼                                                          │
│  Action: validate-structure(nodes)                              │
│      │                                                          │
│      ▼                                                          │
│  Observation: {                                                 │
│    valid: false,                                                │
│    orphans: [],                                                 │
│    deadEnds: ["scene-3"],  // ← 发现问题                        │
│    reachableCount: 11,                                          │
│    totalCount: 12                                               │
│  }                                                              │
│      │                                                          │
│      ▼                                                          │
│  Thought: "发现 scene-3 是死胡同，这是结构性问题。                 │
│            让我再看看路径多样性..."                               │
│      │                                                          │
│      ▼                                                          │
│  Action: analyze-paths(nodes)                                   │
│      │                                                          │
│      ▼                                                          │
│  Observation: {                                                 │
│    totalPaths: 3,                                               │
│    diversityScore: 0.72,                                        │
│    avgPathLength: 5.3                                           │
│  }                                                              │
│      │                                                          │
│      ▼                                                          │
│  Thought: "路径多样性还可以。再检查对话质量..."                    │
│      │                                                          │
│      ▼                                                          │
│  Action: analyze-dialogue-quality(nodes)                        │
│      │                                                          │
│      ▼                                                          │
│  Observation: {                                                 │
│    avgDialoguesPerNode: 4.2,                                    │
│    shortNodes: ["scene-5"],                                     │
│    longNodes: []                                                │
│  }                                                              │
│      │                                                          │
│      ▼                                                          │
│  Final Answer: {                                                │
│    scores: { plotCoherence: 65, ... },                         │
│    issues: [                                                    │
│      { type: "structure", severity: "critical", ... },          │
│      { type: "dialogue", severity: "minor", ... }               │
│    ],                                                           │
│    shouldRegenerate: true,                                      │
│    targetNodeIds: ["scene-3", "scene-5"]                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### 工具设计

我们为 Story Reviewer 的检查分析动作设计了三个模型工具：

**工具 1: validate-structure（结构校验）**

```typescript
export const validateStructureTool = createTool({
  id: "validate-structure",
  description: "检查节点连通性，找出孤立节点和死胡同",
  inputSchema: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      isStart: z.boolean().optional(),
      isEnding: z.boolean().optional(),
      nextNodeId: z.string().optional(),
      choices: z.array(z.object({ targetNodeId: z.string() })).optional(),
    })),
  }),
  execute: async ({ context }) => {
    // BFS 检查可达性
    // 返回: { valid, orphans, deadEnds, invalidLinks }
  },
});
```

**工具 2: analyze-paths（路径分析）**

```typescript
export const analyzePathsTool = createTool({
  id: "analyze-paths",
  description: "分析所有可能的故事路径，评估分支的多样性",
  execute: async ({ context }) => {
    // DFS 枚举所有路径
    // 返回: { totalPaths, diversityScore, pathDescriptions }
  },
});
```

**工具 3: analyze-dialogue-quality（对话质量）**

```typescript
export const analyzeDialogueQualityTool = createTool({
  id: "analyze-dialogue-quality",
  description: "分析每个节点的对话数量和质量",
  execute: async ({ context }) => {
    // 统计对话数量
    // 返回: { avgDialoguesPerNode, shortNodes, longNodes }
  },
});
```

#### 两阶段实现

如果直接使用 `structuredOutput`，LLM 可能会跳过工具调用，直接输出结果 JSON。因此我们需要在模型循环后再进行格式化输出：

```typescript
// 阶段 1: ReAct 循环（允许工具调用）
const reactResponse = await agent.generate(reactPrompt, {
  maxSteps: 6,  // 允许多轮工具调用
  // 注意：不使用 structuredOutput！
});

// 阶段 2: 格式化输出
const formatResponse = await agent.generate(formatPrompt, {
  structuredOutput: { schema: CriticReportSchema },
});
```

#### ReAct 的优势

| 优势 | 说明 |
|------|------|
| **证据驱动** | 评分基于工具返回的数据，不是主观臆断 |
| **可解释性** | 每个判断都有对应的 Thought 和 Observation |
| **灵活性** | Agent 可以根据情况决定调用哪些工具 |
| **可扩展** | 添加新工具即可扩展审核维度 |

### 4.3 Node Writer：Few-Shot CoT (Chain-of-Thought)

#### 什么是 Few-Shot CoT？

Chain-of-Thought 是一种让 LLM **逐步推理**的方法，而 Few-Shot 是通过**示例**来教 LLM 如何完成任务。两者结合：

- **Few-Shot**: 提供具体的输入-输出示例
- **CoT**: 示例中展示推理过程

#### 为什么 Node Writer 使用这种模式？

节点写作是一个**相对结构化的任务**：

```
输入: PlanNode (故事骨架中的一个节点)
输出: NodeDraft (包含对话、旁白、选项的完整节点)
```

这种任务的特点是：
1. 输入输出格式固定
2. 需要遵循特定的写作风格
3. 可以通过示例快速学习

CoT 确保 LLM 在写作时考虑上下文（前序节点摘要、角色性格等），而 Few-Shot 确保输出格式正确。

#### Prompt 设计

```typescript
// apps/intelli-services/src/agents/nodeWriter.ts

export const nodeWriterAgent = new Agent({
  name: "node-writer",
  instructions: `你是一位专业的视觉小说编剧...

## 你的思考方式：Few-Shot CoT

在写作时，你需要：
1. 理解当前节点在故事中的位置和功能
2. 参考前序节点的摘要，保证连贯性
3. 根据角色档案，用符合角色性格的语气写对话

## Few-Shot 示例

### 示例输入
节点: { id: "branch-1", type: "branch", title: "命运的十字路口" }
前序摘要: "主角在学校花园与女主角相遇，两人因误会发生争执。"

### 示例输出
{
  "narration": "夕阳将走廊染成橘红色，空气中弥漫着紧张的气息。",
  "dialogues": [
    { "characterName": "小明", "text": "等等！我...我不是故意的...", "emotion": "anxious" },
    { "characterName": "小红", "text": "你每次都这样说！", "emotion": "angry" }
  ],
  "choices": [
    { "text": "追上去道歉", "targetNodeId": "scene-2a", "meta": { ... } },
    { "text": "保持沉默", "targetNodeId": "scene-2b", "meta": { ... } }
  ],
  "summary": "主角在误会升级后面临选择：追上去道歉，还是选择沉默。"
}`,
});
```

#### 并行写作策略

Node Writer 的一个重要优化是**并行写作**。由于不同节点之间可能存在依赖关系（后续节点需要前序节点的摘要），我们采用**拓扑排序分层**的策略：

```
        ┌───────────────┐
        │    START      │  ← Layer 0 (先生成)
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │   Scene 1     │  ← Layer 1
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │   Branch 1    │  ← Layer 2
        └───┬───────┬───┘
            │       │
    ┌───────▼───┐ ┌─▼───────┐
    │  Scene 2A │ │ Scene 2B│  ← Layer 3 (可并行！)
    └───────┬───┘ └─┬───────┘
            │       │
    ┌───────▼───┐ ┌─▼───────┐
    │ Ending A  │ │ Ending B│  ← Layer 4 (可并行！)
    └───────────┘ └─────────┘
```

**实现代码**：

```typescript
// 拓扑排序获取分层
const layers = topologicalSort(plan.nodes);

for (const layer of layers) {
  // 同一层的节点可以并行调用
  const results = await Promise.all(
    layer.map(async (node) => {
      const previousSummary = getPreviousSummary(node, drafts);
      return writeNodeContent(agent, { planNode: node, previousSummary });
    })
  );
  
  // 保存结果供下一层使用
  results.forEach(r => drafts[r.id] = r);
}
```

### 4.4 Orchestrator：Plan-and-Execute 状态机

#### Orchestrator 的职责

Orchestrator 不是一个完全自主的 LLM Agent，而是一个**工作流程控制器** (Workflow)，负责：

1. 管理执行状态
2. 协调 Agent 之间的数据传递
3. 处理错误和重试
4. 发送进度更新

#### 状态机设计

```
          ┌─────────────────────────────────────────┐
          │                                          │
          ▼                                          │
┌──────┐     ┌──────────┐     ┌────────────────┐    │
│ INIT │────►│ PLANNING │────►│ PLAN_VALIDATION│────┤
└──────┘     └──────────┘     └────────────────┘    │
                   ▲                   │            │
                   │                   │ valid      │ invalid
                   │                   ▼            │ (retry)
                   │            ┌──────────┐        │
                   │            │ WRITING  │        │
                   │            └────┬─────┘        │
                   │                 │              │
                   │                 ▼              │
                   │            ┌──────────┐        │
                   │            │ REVIEWING│        │
                   │            └────┬─────┘        │
                   │                 │              │
                   │    ┌────────────┼────────────┐ │
                   │    │            │            │ │
                   │ critical    score>=70    score<70
                   │    │            │            │
                   │    ▼            ▼            ▼
                   │ ┌──────┐  ┌───────────┐ ┌───────────┐
                   └─┤FAILED│  │ FINALIZING│ │ REWRITING │
                     └──────┘  └─────┬─────┘ └─────┬─────┘
                                     │             │
                                     ▼             │
                                 ┌──────┐          │
                                 │ DONE │◄─────────┘
                                 └──────┘
```

#### 进度反馈

Orchestrator 通过 **Server-Sent Events (SSE)** 向前端发送实时进度：

```typescript
// 阶段开始
progressEmitter.stageStart("planning", 
  "Story Planner 规划故事结构", 
  "Tree-of-Thoughts 正在探索多条叙事路径...");

// 阶段进度
progressEmitter.stageProgress("writing", 
  "并行写作中", 
  `正在撰写第 ${i + 1}/${layers.length} 层节点`, 
  { layer: i + 1, nodesInLayer: layer.length });

// 阶段完成
progressEmitter.stageComplete("reviewing", 
  "审阅完成", 
  `综合评分: ${report.overallScore}`, 
  { score: report.overallScore });
```

## 五、数据流与协作

### 5.1 完整执行流程

```
用户输入                    Story Planner              Node Writer              Story Reviewer
    │                           │                          │                          │
    │  characters[]             │                          │                          │
    │  worldSetting             │                          │                          │
    │  scenes[]                 │                          │                          │
    │  themeSetting             │                          │                          │
    │                           │                          │                          │
    ▼                           ▼                          │                          │
┌───────────┐           ┌──────────────┐                   │                          │
│  Shared   │──────────►│  ToT Round 1 │                   │                          │
│  Context  │           │  生成候选方向  │                   │                          │
└───────────┘           └──────┬───────┘                   │                          │
                               │                           │                          │
                               ▼                           │                          │
                        ┌──────────────┐                   │                          │
                        │  ToT Round 2 │                   │                          │
                        │  评估并选择   │                   │                          │
                        └──────┬───────┘                   │                          │
                               │                           │                          │
                               ▼                           │                          │
                        ┌──────────────┐                   │                          │
                        │  ToT Round 3 │                   │                          │
                        │  展开骨架    │                   │                          │
                        └──────┬───────┘                   │                          │
                               │                           │                          │
                               │  NarrativePlan            │                          │
                               ▼                           ▼                          │
                        ┌──────────────────────────────────────┐                      │
                        │         Layer-by-Layer Writing        │                      │
                        │  Layer 0: [start]                    │                      │
                        │  Layer 1: [scene-1]                  │                      │
                        │  Layer 2: [branch-1]                 │                      │
                        │  Layer 3: [scene-2a, scene-2b] ←并行  │                      │
                        │  Layer 4: [ending-a, ending-b] ←并行  │                      │
                        └──────────────────┬───────────────────┘                      │
                                           │                                          │
                                           │  NodeDrafts                              │
                                           ▼                                          ▼
                                    ┌─────────────────────────────────────────────────────┐
                                    │                  ReAct Review                        │
                                    │  ┌─────────────────────────────────────────────┐   │
                                    │  │ Thought → Action → Observation → ...         │   │
                                    │  │                                              │   │
                                    │  │ Tools:                                       │   │
                                    │  │ • validate-structure                         │   │
                                    │  │ • analyze-paths                              │   │
                                    │  │ • analyze-dialogue-quality                   │   │
                                    │  └─────────────────────────────────────────────┘   │
                                    │                        │                            │
                                    │                        ▼                            │
                                    │                 CriticReport                        │
                                    │  { scores, issues, shouldRegenerate }              │
                                    └─────────────────────────┬───────────────────────────┘
                                                              │
                                                              ▼
                                                     ┌────────────────┐
                                                     │  score >= 70?  │
                                                     └───────┬────────┘
                                                             │
                                          ┌─────────────────┴─────────────────┐
                                          │ Yes                                │ No
                                          ▼                                    ▼
                                   ┌──────────────┐                    ┌──────────────┐
                                   │   Transform  │                    │   Rewrite    │
                                   │  to Project  │                    │ Target Nodes │
                                   └──────┬───────┘                    └──────┬───────┘
                                          │                                    │
                                          ▼                                    │
                                   ┌──────────────┐                            │
                                   │  GameProject │◄───────────────────────────┘
                                   │    Output    │
                                   └──────────────┘
```

### 5.2 Schema 驱动的协作

所有 Agent 之间的数据交换都通过 **Zod Schema** 定义，确保类型安全：

```typescript
// 1. Story Planner 输出
const NarrativePlanSchema = z.object({
  outline: z.object({
    premise: z.string(),
    centralConflict: z.string(),
    thematicArc: z.string(),
  }),
  nodes: z.array(PlanNodeSchema),
});

// 2. Node Writer 输出
const NodeDraftSchema = z.object({
  id: z.string(),
  type: z.enum(["scene", "branch", "ending"]),
  narration: z.string().optional(),
  dialogues: z.array(DialogueDraftSchema),
  choices: z.array(ChoiceDraftSchema).optional(),
  summary: z.string(),  // ← 供后续节点使用
});

// 3. Story Reviewer 输出
const CriticReportSchema = z.object({
  scores: z.object({ ... }),
  issues: z.array(IssueSchema),
  shouldRegenerate: z.boolean(),
  targetNodeIds: z.array(z.string()).optional(),
});
```

这种设计的优势：

- **类型安全**：编译时检查数据结构
- **文档化**：Schema 本身就是 API 文档
- **验证**：自动验证 LLM 输出是否符合预期

## 六、案例串联

### 6.1 案例：校园恋爱故事

**输入**：
```json
{
  "characters": [
    { "name": "小明", "identity": "高中生", "personality": ["内向", "善良"] },
    { "name": "小红", "identity": "班长", "personality": ["开朗", "责任心强"] }
  ],
  "worldSetting": { "era": "现代", "location": "高中校园" },
  "scenes": [
    { "name": "教室", "atmosphere": "日常学习" },
    { "name": "天台", "atmosphere": "私密谈话" },
    { "name": "校门口", "atmosphere": "离别送行" }
  ]
}
```

**阶段 1：ToT 规划**

```
[ToT] 🌳 开始 Tree-of-Thoughts 规划...
[ToT] Round 1: 生成候选叙事方向...
  1. 误会型: 小明被误认为抄袭，小红调查真相
  2. 暗恋型: 小明暗恋小红，通过帮助她逐渐靠近
  3. 竞争型: 两人因竞选学生会而产生冲突
[ToT] Round 2: 评估候选方向...
  - 误会型: 戏剧性=4, 契合=5, 分支=4, 深度=3, 总分=16 ← 最高
  - 暗恋型: 戏剧性=3, 契合=4, 分支=3, 深度=4, 总分=14
  - 竞争型: 戏剧性=5, 契合=3, 分支=4, 深度=3, 总分=15
[ToT] 选择: 误会型
[ToT] Round 3: 展开节点骨架...
[ToT] ✅ 生成了 12 个节点: 1 START, 2 BRANCH, 3 ENDING
```

**阶段 2：并行写作**

```
[Writer] 📝 开始分层并行写作...
[Writer] Layer 0: 写作 start (初遇)
[Writer] Layer 1: 写作 scene-1 (发现抄袭)
[Writer] Layer 2: 写作 branch-1 (是否揭发)
[Writer] Layer 3: 并行写作 [scene-2a, scene-2b] (2 nodes)
[Writer] Layer 4: 并行写作 [scene-3a, scene-3b] (2 nodes)
[Writer] Layer 5: 并行写作 [ending-a, ending-b, ending-c] (3 nodes)
[Writer] ✅ 写作完成: 12 个节点
```

**阶段 3：ReAct 审阅**

```
[ReAct] 🔄 开始 ReAct 审阅循环...
[ReAct] Thought: 让我先检查结构完整性...
[ReAct] Action: validate-structure(nodes)
[ReAct] Observation: { valid: true, orphans: [], deadEnds: [] }
[ReAct] Thought: 结构完整。检查路径多样性...
[ReAct] Action: analyze-paths(nodes)
[ReAct] Observation: { totalPaths: 3, diversityScore: 0.78 }
[ReAct] Thought: 3 条路径，多样性不错。检查对话质量...
[ReAct] Action: analyze-dialogue-quality(nodes)
[ReAct] Observation: { avgDialoguesPerNode: 4.5, shortNodes: [] }
[ReAct] ✅ 审阅完成
[ReAct] 综合评分: 82
[ReAct] shouldRegenerate: false
```

**最终输出**：包含 12 个节点、3 个结局的完整剧本

### 6.2 案例：审阅发现问题

**场景**：某次生成的剧本存在结构问题

```
[ReAct] Action: validate-structure(nodes)
[ReAct] Observation: {
  valid: false,
  orphans: [],
  deadEnds: ["scene-3"],  // ← 发现死胡同
  reachableCount: 11,
  totalCount: 12
}
[ReAct] Thought: scene-3 是死胡同，没有 nextNodeId 也没有 choices。
                这是 critical 级别的结构问题。
```

**Reviewer 输出**：

```json
{
  "scores": {
    "plotCoherence": 55,
    "characterConsistency": 80,
    "dialogueQuality": 75,
    "branchMeaningfulness": 70,
    "pacing": 65
  },
  "overallScore": 69,
  "issues": [
    {
      "type": "structure",
      "severity": "critical",
      "nodeIds": ["scene-3"],
      "description": "scene-3 是死胡同，既不是结局节点，也没有指向下一个节点",
      "suggestion": "添加 nextNodeId 指向后续节点，或将其改为 ending 类型"
    }
  ],
  "shouldRegenerate": true,
  "regenerateTarget": "specific_nodes",
  "targetNodeIds": ["scene-3"]
}
```

**Orchestrator 响应**：

```
[Orchestrator] 审阅结果: overallScore=69, issues=1
[Orchestrator] 发现 critical 问题，需要重写
[Orchestrator] 进入 REWRITING 阶段，目标节点: ["scene-3"]
```

## 七、设计亮点总结

### 7.1 技术创新点

| 创新点 | 说明 | 优势 |
|--------|------|------|
| **多分支 ToT** | 3 轮 LLM 调用实现探索-评估-展开 | 决策可追溯，质量可控 |
| **两阶段 ReAct** | 分离工具调用和结构化输出 | 既能推理又能格式化 |
| **拓扑并行写作** | 按依赖分层并行调用 | 效率提升 2-3 倍 |
| **Schema 驱动** | Zod 定义所有数据结构 | 类型安全，自文档化 |
| **实时进度流** | SSE 推送各阶段状态 | 用户体验优化 |

### 7.2 与"伪 Agent"的区别

很多所谓的"Agent"实现只是：

```typescript
// 伪 Agent：单次调用 + 提示词描述
const response = await llm.generate(`
  请按照如下要求思考...
`);
// LLM 只是在"想象"这些步骤，并没有真正执行
```

我们的实现是**真正的多轮调用**：

```typescript
// 真 Agent：多次调用 + 真实工具执行
// Round 1
const thought1 = await llm.generate("...");
const action1 = parseTool(thought1);
const observation1 = await executeTool(action1);  // 真正执行！

// Round 2
const thought2 = await llm.generate(thought1 + observation1 + "...");
// ...
```

### 7.3 可扩展性

系统设计支持多种扩展方向：

```
当前架构
├── 添加新 Agent
│   └── 例如: Character Depth Agent（深化角色背景）
│
├── 添加新工具
│   └── 例如: emotion-arc-analyzer（情感弧线分析）
│
├── 添加新审核维度
│   └── 例如: 敏感内容检测、年龄分级
│
└── 支持人工干预 (Human in the loop, HITL)
    └── 例如: 在 PLANNING 后暂停，等待用户确认方向
```

## 八、结语

IntelliVNG 多智能体视觉小说创作编排系统展示了如何将**学术界的 Agent 设计模式**（ToT、ReAct、CoT）**落地到实际产品**中。通过专业分工、Schema 驱动、可观测设计，我们实现了：

- **从黑盒到白盒**：每个决策都有推理过程
- **从单次到迭代**：支持自动重试和局部修正
- **从串行到并行**：拓扑分层提升效率

## 参考资料

- [Tree of Thoughts: Deliberate Problem Solving with Large Language Models](https://arxiv.org/abs/2305.10601)
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903)
- [Mastra Framework Documentation](https://mastra.ai/docs)

