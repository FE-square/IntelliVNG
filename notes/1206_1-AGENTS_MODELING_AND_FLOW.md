# IntelliVNG 多智能体系统的数据建模与流转设计

> **核心观点**：即便是基于 LLM 的 AI Agent 系统，本质上仍然是数据驱动的——只不过"处理器"从确定性代码变成了概率性模型。理解数据模型的设计思路和数据在各 Agent 之间的流转，是理解整个系统的关键。

## 一、为什么 AI Agent 系统也需要严格的数据建模？

### 1.1 常见误解

很多人认为：**"用了 LLM，就不需要定义数据结构了，让模型自由发挥就好。"**

这是一个危险的误解。实际上，LLM Agent 系统比传统软件**更需要**严格的数据建模，原因有三：

| 维度 | 传统软件 | LLM Agent 系统 |
|------|---------|---------------|
| **输出确定性** | 确定的：同输入必得同输出 | 不确定的：同一输入可能产生不同格式的输出 |
| **错误类型** | 运行时异常、逻辑错误 | 格式不符、字段缺失、类型错误、幻觉 |
| **下游兼容** | 接口约定即可 | 必须用 Schema 强制约束，否则下游 Agent 无法解析 |

### 1.2 Schema 的三重作用

在 IntelliVNG 系统中，我们使用 **Zod Schema** 来定义所有数据结构，它同时承担三个关键角色：

```
┌─────────────────────────────────────────────────────────────────┐
│                    Zod Schema 的三重作用                         │
├─────────────────────────────────────────────────────────────────┤
│  1. 📋 文档化：Schema 本身就是 API 文档，字段含义一目了然        │
│  2. ✅ 验证：自动检验 LLM 输出是否符合预期格式                   │
│  3. 🔄 转换：自动标准化不同模型的输出差异（如 next vs nextNodeId）│
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、整体数据流概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IntelliVNG 数据流全景图                            │
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ 用户表单输入 │                                                            │
│  │ (前端)      │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      WorkflowInput                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │ WorldBible  │  │ CharacterDB │  │ StyleGuide  │  │Constraints│  │   │
│  │  │ (世界观)    │  │ (角色档案)  │  │ (风格指南)  │  │ (约束条件)│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Story Planner (ToT 三轮)                          │   │
│  │                                                                      │   │
│  │  Round 1              Round 2              Round 3                   │   │
│  │  ┌──────────┐        ┌──────────┐        ┌───────────────────┐      │   │
│  │  │Candidate │───────►│Evaluation│───────►│  NarrativePlan    │      │   │
│  │  │ Paths[]  │        │ + Select │        │  ├─ outline       │      │   │
│  │  └──────────┘        └──────────┘        │  └─ PlanNode[]    │      │   │
│  │                                          └───────────────────┘      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Node Writer (并行写作)                            │   │
│  │                                                                      │   │
│  │  PlanNode[]  ──────►  NodeDraft[]                                   │   │
│  │  (骨架)               (血肉：对话、旁白、选项文案)                    │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Story Reviewer (ReAct)                            │   │
│  │                                                                      │   │
│  │  NodeDraft[] + Tools ──────►  CriticReport                          │   │
│  │                               ├─ scores (6维评分)                    │   │
│  │                               ├─ issues[] (问题列表)                 │   │
│  │                               └─ shouldRegenerate (是否重写)         │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                    ┌────────────┴────────────┐                             │
│                    │                         │                             │
│              (通过)▼                   (不通过)▼                            │
│         ┌──────────────┐            ┌──────────────┐                       │
│         │ GameProject  │            │  Rewrite     │                       │
│         │ (最终输出)    │            │  (重写循环)   │──────► Node Writer   │
│         └──────────────┘            └──────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型详解

### 3.1 用户输入层：WorkflowInput

这是整个流程的起点，承载用户通过前端表单输入的所有创作设定。

```typescript
// apps/intelli-services/src/agents/schemas.ts

const WorkflowInputSchema = z.object({
  worldBible: z.object({...}),     // 世界观设定
  characterDB: z.object({...}),    // 角色档案
  styleGuide: z.object({...}),     // 风格指南
  constraints: z.object({...}),    // 约束条件
  locale: z.enum([...]),           // 语言环境
});
```

#### 各字段设计意图

| 字段 | 类型 | 设计意图 | 对非线性创作的作用 |
|------|------|---------|------------------|
| `worldBible.scenes[]` | 场景列表 | 定义可用的场景池 | 分支路线可使用不同场景，增加差异化 |
| `worldBible.rules` | 世界规则 | 约束故事逻辑 | 确保分支剧情在世界观内合理 |
| `characterDB.characters[].personality.traits` | 性格特点 | 角色行为参考 | 分支选项需符合角色性格 |
| `characterDB.characters[].coreTraits.relationships` | 人物关系 | 关系网络 | "关系分支"的设计依据 |
| `styleGuide.themes` | 主题标签 | 叙事基调 | 影响分支的情感走向 |
| `styleGuide.tone` | 整体基调 | 氛围控制 | 影响选项措辞和后果暗示 |
| `constraints.targetNodeCount` | 目标节点数 | 规模控制 | 间接决定分支数量 |
| `constraints.targetEndingCount` | 目标结局数 | 结局多样性 | 直接决定最终分叉数 |

#### 关键设计决策

**为什么要把 `scenes` 放在 `worldBible` 里而不是独立出来？**

因为场景和世界观是强耦合的。一个"科幻太空站"的世界观不可能出现"古代中国茶馆"的场景。将 scenes 作为 worldBible 的子字段，暗示了这种约束关系，也便于 Planner 在规划时确保场景选择的合理性。

---

### 3.2 规划层：Story Planner 的数据模型

Story Planner 采用 **Tree-of-Thoughts (ToT)** 模式，分三轮调用，每轮产出不同的数据结构。

#### Round 1 输出：CandidatePath[]（候选叙事方向）

```typescript
// apps/intelli-services/src/agents/storyPlanner.ts

const CandidatePathSchema = z.object({
  id: z.string(),                          // 唯一标识
  name: z.string(),                        // 方向名称，如"冲突型"、"成长型"
  description: z.string(),                 // 一句话描述
  premise: z.string(),                     // 故事前提
  centralConflict: z.string(),             // 核心冲突
  potentialEndings: z.array(z.string()),   // 可能的结局类型
  earlyBranchingOpportunities: z.array(z.string()).optional(), // 🆕 早期分支机会
});
```

**字段设计意图：**

| 字段 | 设计意图 | 为什么重要 |
|------|---------|-----------|
| `name` | 方向的"标签"，便于人类理解 | 用于日志和调试 |
| `premise` | 一句话概括故事核心 | 作为 Round 3 展开的"种子" |
| `centralConflict` | 定义故事的核心矛盾 | 分支选择应围绕冲突展开 |
| `potentialEndings` | 预设结局类型 | 引导 Round 3 设计多结局 |
| `earlyBranchingOpportunities` 🆕 | 早期分支点描述 | **关键！** 确保非线性从故事早期开始 |

**为什么需要 `earlyBranchingOpportunities`？**

这是我们针对"伪非线性"问题新增的字段。如果在 Round 1 就要求 LLM 思考"故事前半段可以在哪里设置分支"，那么在 Round 3 展开时就更容易产出真正的非线性结构。

#### Round 2 输出：PathEvaluation + selectedPathId

```typescript
const PathEvaluationSchema = z.object({
  pathId: z.string(),
  scores: z.object({
    dramatic: z.number().min(1).max(5),       // 戏剧性
    characterFit: z.number().min(1).max(5),   // 角色契合度
    branchPotential: z.number().min(1).max(5),// 分支潜力
    thematicDepth: z.number().min(1).max(5),  // 主题深度
  }),
  totalScore: z.number(),
  reasoning: z.string(),  // 评分理由
});

const AllEvaluationsSchema = z.object({
  evaluations: z.array(PathEvaluationSchema),
  selectedPathId: z.string(),        // 选中的方向ID
  selectionReasoning: z.string(),    // 选择理由
});
```

**评分维度设计意图：**

| 评分维度 | 设计意图 | 对非线性创作的影响 |
|---------|---------|------------------|
| `dramatic` | 戏剧冲突强度 | 冲突越强，分支选择越有"重量" |
| `characterFit` | 角色特点发挥 | 高契合度意味着更多角色驱动的分支 |
| `branchPotential` | 分支设计潜力 | **直接评估非线性叙事可能性** |
| `thematicDepth` | 主题深度 | 深度主题提供更多探讨角度→更多分支方向 |

#### Round 3 输出：NarrativePlan（故事骨架）

这是整个规划阶段最重要的输出，定义了故事的"骨架"。

```typescript
const NarrativePlanSchema = z.object({
  outline: z.object({
    premise: z.string(),           // 故事前提
    centralConflict: z.string(),   // 核心冲突
    thematicArc: z.string(),       // 主题弧线
  }),
  nodes: z.array(PlanNodeSchema),  // 节点骨架列表
});
```

##### PlanNode：节点骨架的核心数据结构

```typescript
const PlanNodeSchema = z.object({
  // ======== 身份标识 ========
  id: z.string(),                              // 唯一标识
  type: z.enum(["scene", "branch", "ending"]), // 节点类型
  isStart: z.boolean().optional(),             // 是否为起始节点
  isEnding: z.boolean().optional(),            // 是否为结局节点
  
  // ======== 内容元信息 ========
  title: z.string().optional(),                // 节点标题
  brief: z.string().optional(),                // 一句话摘要
  functionTag: z.enum([                        // 叙事功能标签
    "setup",      // 开端：建立世界观
    "rising",     // 上升：冲突积累
    "conflict",   // 冲突：矛盾爆发
    "twist",      // 转折：意外发生
    "climax",     // 高潮：最激烈时刻
    "falling",    // 下降：冲突缓解
    "resolution"  // 结局：故事收束
  ]).optional(),
  sceneName: z.string().optional(),            // 绑定的场景名称
  
  // ======== 连接关系 ========
  nextNodeId: z.string().optional(),           // 下一个节点（scene 类型）
  choicesMeta: z.array(z.object({              // 分支选项元信息（branch 类型）
    id: z.string().optional(),
    leadsTo: z.string(),                       // 目标节点ID
    emotionalWeight: z.string().optional(),    // 情感重量
    consequenceHint: z.string().optional(),    // 后果暗示
    branchType: z.enum([                       // 🆕 分支类型
      "route",         // 路线分支：导向不同故事线
      "relationship",  // 关系分支：影响角色关系
      "information",   // 信息分支：决定获得什么信息
      "ending"         // 结局分支：直接决定结局
    ]).optional(),
    impactDescription: z.string().optional(),  // 🆕 影响描述
  })).optional(),
  
  // ======== 布局信息 ========
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
```

**字段设计意图详解：**

| 字段分类 | 字段名 | 设计意图 | 非线性叙事中的作用 |
|---------|--------|---------|------------------|
| **身份** | `type` | 区分节点功能 | `branch` 类型节点是非线性的核心 |
| **身份** | `isStart/isEnding` | 标记特殊节点 | 确保图的入口和出口明确 |
| **内容** | `functionTag` | 叙事功能定位 | 确保分支分布在各阶段（setup/rising/conflict/climax） |
| **内容** | `brief` | 节点摘要 | 供 Node Writer 理解上下文 |
| **连接** | `nextNodeId` | 线性连接 | scene 节点的推进方式 |
| **连接** | `choicesMeta` | 分支连接 | **非线性的核心实现** |
| **分支** | `branchType` 🆕 | 分支类型分类 | 区分不同性质的选择 |
| **分支** | `impactDescription` 🆕 | 影响说明 | 供 Node Writer 设计选项文案 |

**branchType 的设计思考：**

```
┌────────────────────────────────────────────────────────────────────┐
│                     四种分支类型的区别                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  route（路线分支）                                                  │
│  └─ 选择后进入完全不同的故事线，后续场景和遭遇都不同                │
│  └─ 例如：选择"独自调查"vs"寻求帮助"→ 两条完全不同的冒险              │
│                                                                    │
│  relationship（关系分支）                                           │
│  └─ 选择影响与特定角色的关系发展，但主线可能相似                    │
│  └─ 例如：选择"安慰她"vs"给她空间"→ 后续关系亲密度不同               │
│                                                                    │
│  information（信息分支）                                            │
│  └─ 选择决定玩家获得什么信息或视角                                  │
│  └─ 例如：选择"调查书房"vs"调查花园"→ 获得不同线索                   │
│                                                                    │
│  ending（结局分支）                                                 │
│  └─ 选择直接决定走向哪个结局                                        │
│  └─ 例如：最终对决时选择"牺牲自己"vs"牺牲他人"                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**为什么需要区分分支类型？**

1. **指导 Node Writer**：不同类型的分支需要不同的文案风格
2. **评估非线性程度**：`route` 分支越多，故事越"真正非线性"
3. **平衡体验设计**：避免所有分支都是 `ending` 类型（伪非线性）

---

### 3.3 写作层：Node Writer 的数据模型

Node Writer 接收 PlanNode（骨架），输出 NodeDraft（血肉）。

#### 输入：PlanNode + 上下文

```typescript
// Node Writer 的输入组成
{
  planNode: PlanNode,              // 当前要写的节点骨架
  previousNodeSummary: string,     // 前序节点摘要（保证连贯性）
  characters: Character[],         // 角色档案
  styleGuide: StyleGuide,          // 风格指南
}
```

**`previousNodeSummary` 的关键作用：**

由于 Node Writer 按拓扑层级并行写作，同一层的节点互不知道彼此内容。`previousNodeSummary` 是保证故事连贯性的关键——它告诉当前节点"之前发生了什么"。

#### 输出：NodeDraft（节点草稿）

```typescript
const NodeDraftSchema = z.object({
  // ======== 与 PlanNode 对齐 ========
  id: z.string(),                              // 与 PlanNode.id 一致
  type: z.enum(["scene", "branch", "ending"]),
  title: z.string(),
  sceneName: z.string(),
  
  // ======== 实际内容（PlanNode 没有的） ========
  narration: z.string().optional(),            // 旁白/场景描述
  dialogues: z.array(DialogueDraftSchema),     // 对话列表
  choices: z.array(ChoiceDraftSchema).optional(), // 分支选项（仅 branch 类型）
  
  // ======== 连接关系（继承自 PlanNode） ========
  nextNodeId: z.string().optional(),           // 下一个节点
  
  // ======== 供下游使用 ========
  summary: z.string(),                         // 摘要，供后续节点参考
});
```

##### 对话数据结构

```typescript
const DialogueDraftSchema = z.object({
  characterName: z.string(),    // 说话角色
  text: z.string(),             // 对话内容
  emotion: z.string().optional(),// 角色情绪
});
```

##### 选项数据结构

```typescript
const ChoiceDraftSchema = z.object({
  id: z.string(),
  text: z.string(),                // 玩家看到的选项文案
  targetNodeId: z.string(),        // 目标节点ID
  meta: z.object({
    emotionalWeight: z.string(),   // 情感重量："轻松"/"沉重"/"痛苦抉择"
    consequenceHint: z.string(),   // 后果暗示（不剧透但有引导）
  }),
});
```

**数据转换：PlanNode → NodeDraft**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PlanNode → NodeDraft 转换                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PlanNode (骨架)              NodeDraft (血肉)                       │
│  ┌─────────────────┐          ┌─────────────────┐                  │
│  │ id: "branch-1"  │ ──────► │ id: "branch-1"  │                  │
│  │ type: "branch"  │          │ type: "branch"  │                  │
│  │ title: "抉择"   │          │ title: "抉择"   │                  │
│  │ brief: "主角... │ ──────► │ narration: "夕阳│◄── LLM 生成       │
│  │        面临选择"│          │   将走廊染成..." │                  │
│  │                 │          │ dialogues: [    │◄── LLM 生成       │
│  │ choicesMeta: [  │          │   {小明: "..."},│                  │
│  │   {leadsTo:...},│ ──────► │ choices: [      │                  │
│  │   {leadsTo:...} │          │   {text: "追上去│◄── LLM 填充文案   │
│  │ ]               │          │     道歉", ...},│                  │
│  │                 │          │   {text: "保持  │                  │
│  │                 │          │     沉默", ...} │                  │
│  │                 │          │ ]               │                  │
│  │                 │          │ summary: "主角..│◄── LLM 生成       │
│  └─────────────────┘          └─────────────────┘                  │
│                                                                     │
│  继承部分：id, type, title, 连接关系                                 │
│  生成部分：narration, dialogues, choices.text, summary              │
└─────────────────────────────────────────────────────────────────────┘
```

**`summary` 字段的重要性：**

```
节点 A (scene) ──写作完成──► summary: "主角发现了隐藏的日记本"
                              │
                              ▼ 作为 previousNodeSummary 传递
节点 B (branch) ◄────────────┘
                 Node Writer 知道"之前发现了日记本"，
                 可以写出"你决定如何处理这个发现？"的选择
```

---

### 3.4 审阅层：Story Reviewer 的数据模型

Story Reviewer 采用 **ReAct** 模式，通过工具调用收集"证据"，然后基于证据给出评估。

#### 输入

```typescript
// Story Reviewer 的输入
{
  plan: NarrativePlan,                 // 故事骨架
  drafts: Record<string, NodeDraft>,   // 节点草稿集合
  worldBible: WorldBible,              // 世界观（用于场景检查）
  characterDB: CharacterDB,            // 角色档案（用于一致性检查）
}
```

#### 工具返回的中间数据

**工具 1：validate-structure（结构校验）**

```typescript
// 返回值类型
{
  valid: boolean,
  orphans: string[],        // 孤立节点（从 START 无法到达）
  deadEnds: string[],       // 死胡同（非 ending 但没有出路）
  invalidLinks: string[],   // 无效链接（指向不存在的节点）
  reachableCount: number,   // 可达节点数
  totalCount: number,       // 总节点数
}
```

**工具 2：analyze-paths（路径分析）**

```typescript
// 返回值类型
{
  totalPaths: number,           // 总路径数
  diversityScore: number,       // 多样性评分 (0-1)
  pathDescriptions: string[],   // 路径描述（最多5条）
  avgPathLength: number,        // 平均路径长度
  lengthVariance: number,       // 长度方差（体验丰富度指标）
}
```

**工具 3：analyze-dialogue-quality（对话质量）**

```typescript
// 返回值类型
{
  avgDialoguesPerNode: number,  // 每节点平均对话数
  shortNodes: string[],         // 对话过少的节点
  longNodes: string[],          // 对话过多的节点
  noNarrationNodes: string[],   // 缺少旁白的节点
}
```

#### 输出：CriticReport（评审报告）

```typescript
const CriticReportSchema = z.object({
  // ======== 多维度评分 ========
  scores: z.object({
    plotCoherence: z.number(),        // 情节连贯性
    characterConsistency: z.number(), // 角色一致性
    dialogueQuality: z.number(),      // 对话质量
    branchMeaningfulness: z.number(), // 分支有意义程度
    branchDistribution: z.number(),   // 🆕 分支分布合理性
    pacing: z.number(),               // 节奏
  }),
  overallScore: z.number(),           // 综合评分
  
  // ======== 问题列表 ========
  issues: z.array(IssueSchema),
  
  // ======== 重写决策 ========
  shouldRegenerate: z.boolean(),
  regenerateTarget: z.enum(["none", "specific_nodes", "all"]),
  targetNodeIds: z.array(z.string()),  // 需要重写的节点ID
});
```

##### Issue 数据结构

```typescript
const IssueSchema = z.object({
  type: z.enum([
    "structure",           // 结构问题（孤立节点、死胡同）
    "logic",               // 逻辑问题（剧情矛盾）
    "character",           // 角色问题（性格不一致）
    "dialogue",            // 对话问题（过长/过短）
    "branch",              // 分支问题（选择无意义）
    "branch-distribution"  // 🆕 分支分布问题（伪非线性）
  ]),
  severity: z.enum(["minor", "major", "critical"]),
  nodeIds: z.array(z.string()),    // 涉及的节点
  description: z.string(),          // 问题描述
  suggestion: z.string(),           // 修改建议
});
```

**评分维度设计意图：**

| 评分维度 | 权重 | 设计意图 | 来源依据 |
|---------|------|---------|---------|
| `plotCoherence` | 20% | 情节逻辑自洽 | LLM 主观判断 |
| `characterConsistency` | 15% | 对话符合角色性格 | 角色档案对比 |
| `dialogueQuality` | 15% | 对话自然度 | 工具统计 + LLM 判断 |
| `branchMeaningfulness` | 20% | 选择是否有实质区别 | 路径分析工具 |
| `branchDistribution` 🆕 | 15% | 分支是否均匀分布 | 节点分析 |
| `pacing` | 15% | 节奏松弛有度 | LLM 主观判断 |

**`branchDistribution` 评分的计算逻辑：**

```
branchDistribution 评分规则：

100 分：分支均匀分布在 setup/rising/conflict/climax 各阶段
        有 route 类型分支，不只是 ending 分支

70-99 分：有早期/中期分支，但分布略有不均

40-69 分：大部分分支集中在 climax 阶段（伪非线性警告！）

0-39 分：只有一个分支点，且在结局前
```

---

## 四、数据流转详解

### 4.1 完整流转时序图

```
时间 ──────────────────────────────────────────────────────────────────────►

用户                Orchestrator           Story Planner        Node Writer        Story Reviewer
 │                      │                      │                    │                    │
 │ WorkflowInput        │                      │                    │                    │
 │ ────────────────────►│                      │                    │                    │
 │                      │                      │                    │                    │
 │                      │ WorkflowInput        │                    │                    │
 │                      │ ────────────────────►│                    │                    │
 │                      │                      │                    │                    │
 │                      │                      │ [ToT Round 1]      │                    │
 │                      │                      │ 生成 CandidatePaths│                    │
 │                      │                      │                    │                    │
 │                      │                      │ [ToT Round 2]      │                    │
 │                      │                      │ 评估并选择最佳方向  │                    │
 │                      │                      │                    │                    │
 │                      │                      │ [ToT Round 3]      │                    │
 │                      │   NarrativePlan      │ 展开为节点骨架     │                    │
 │                      │ ◄────────────────────│                    │                    │
 │                      │                      │                    │                    │
 │                      │                      │                    │                    │
 │                      │ PlanNode[] + Context │                    │                    │
 │                      │ ──────────────────────────────────────────►                    │
 │                      │                      │                    │                    │
 │                      │                      │                    │ [并行写作]         │
 │                      │                      │                    │ Layer 0: start     │
 │                      │                      │                    │ Layer 1: scene-1   │
 │                      │                      │                    │ Layer 2: branch-1  │
 │                      │                      │                    │ Layer 3: [并行]    │
 │                      │                      │                    │                    │
 │                      │                NodeDraft[]                │                    │
 │                      │ ◄──────────────────────────────────────────                    │
 │                      │                      │                    │                    │
 │                      │                      │                    │                    │
 │                      │        NodeDraft[] + NarrativePlan        │                    │
 │                      │ ────────────────────────────────────────────────────────────────►
 │                      │                      │                    │                    │
 │                      │                      │                    │                    │ [ReAct 循环]
 │                      │                      │                    │                    │ 工具调用
 │                      │                      │                    │                    │ 综合评估
 │                      │                      │                    │                    │
 │                      │                             CriticReport                       │
 │                      │ ◄────────────────────────────────────────────────────────────────
 │                      │                      │                    │                    │
 │                      │ [决策]               │                    │                    │
 │                      │ score >= 70?         │                    │                    │
 │                      │ ─┬─ Yes ──► 输出      │                    │                    │
 │                      │  └─ No ──► 重写循环   │                    │                    │
 │                      │                      │                    │                    │
 │    GameProject       │                      │                    │                    │
 │ ◄────────────────────│                      │                    │                    │
 │                      │                      │                    │                    │
```

### 4.2 关键数据转换节点

#### 转换 1：WorkflowInput → ToT Prompt

```typescript
// Story Planner 如何使用 WorkflowInput

// Round 1: 生成候选方向
const generatePrompt = promptManager.build('story-planner.generate-candidates', {
  worldBible: JSON.stringify(input.worldBible, null, 2),    // 世界观影响方向
  characterDB: JSON.stringify(input.characterDB, null, 2),  // 角色影响冲突类型
  styleGuide: JSON.stringify(input.styleGuide || {}, null, 2), // 风格影响基调
});

// Round 3: 展开骨架
const expandPrompt = promptManager.build('story-planner.expand', {
  targetNodeCount: String(input.constraints?.targetNodeCount || 12),  // 控制规模
  targetEndingCount: String(input.constraints?.targetEndingCount || 3), // 控制结局数
  // ... 还有选中的方向信息
});
```

#### 转换 2：NarrativePlan → NodeDraft[]

```typescript
// Node Writer 的拓扑排序写作

// 1. 构建依赖图
const layers = topologicalSort(plan.nodes);
// layers[0] = [start]
// layers[1] = [scene-1]
// layers[2] = [branch-1]
// layers[3] = [scene-2a, scene-2b]  // 可并行！

// 2. 逐层写作
for (const layer of layers) {
  const drafts = await Promise.all(
    layer.map(async (node) => {
      // 获取前序节点的摘要
      const previousSummary = getPreviousSummary(node, allDrafts);
      
      // 调用 Node Writer
      return nodeWriter.write({
        planNode: node,
        previousNodeSummary: previousSummary,  // 关键！保证连贯性
        characters,
        styleGuide,
      });
    })
  );
  
  // 保存本层结果，供下一层使用
  drafts.forEach(d => allDrafts[d.id] = d);
}
```

#### 转换 3：NodeDraft[] → 工具输入

```typescript
// Story Reviewer 如何准备工具输入

const nodesForValidation = Object.values(drafts).map((d) => ({
  id: d.id,
  type: d.type,
  isStart: plan.nodes.find(n => n.id === d.id)?.isStart,   // 从 plan 获取
  isEnding: plan.nodes.find(n => n.id === d.id)?.isEnding, // 从 plan 获取
  nextNodeId: d.nextNodeId,
  choices: d.choices?.map(c => ({ targetNodeId: c.targetNodeId })),
  dialogues: d.dialogues,
  narration: d.narration,
}));

// 传给 validate-structure 工具
// 工具只关心连接关系，不关心对话内容

// 传给 analyze-dialogue-quality 工具
// 工具只关心对话数量和旁白有无
```

---

## 五、Schema 设计的工程智慧

### 5.1 宽松输入 + 严格输出

由于不同 LLM 模型（GPT、Claude、Qwen 等）的输出格式可能有差异，我们采用了**宽松输入 + transform 标准化**的策略：

```typescript
// 宽松接收
const PlanNodeSchema = z.object({
  title: z.string().optional(),
  name: z.string().optional(),      // 某些模型可能用 name
  brief: z.string().optional(),     // 某些模型可能用 brief
  // ...
}).passthrough()  // 允许额外字段
  .transform((data) => ({
    // 严格输出：统一字段名
    title: data.title || data.name || data.brief || '未命名节点',
    // ...
  }));
```

**这种设计的好处：**

1. **模型无关性**：切换 LLM 不需要修改 Schema
2. **向后兼容**：老版本输出仍可解析
3. **失败优雅**：字段缺失时有默认值

### 5.2 字段冗余设计

你可能注意到 Schema 中有很多"冗余"字段：

```typescript
nextNodeId: z.string().optional(),
next: z.string().optional(),  // 冗余！但是有些模型会用这个

choices: z.array(...).optional(),
choicesMeta: z.array(...).optional(),  // 冗余！
```

**这是故意的**。不同模型对字段命名有不同偏好：

- GPT 倾向于 `nextNodeId`
- Claude 可能用 `next`
- Qwen 可能用 `nextNode`

通过接受多种命名，再 transform 到统一格式，我们实现了**模型输出的归一化**。

### 5.3 分层数据：骨架与血肉分离

我们将数据分为两层：

| 层次 | 数据结构 | 内容 | 生成者 |
|------|---------|------|--------|
| 骨架层 | `PlanNode` | 结构、连接、元信息 | Story Planner |
| 血肉层 | `NodeDraft` | 对话、旁白、文案 | Node Writer |

**分层的好处：**

1. **关注点分离**：Planner 专注结构，Writer 专注内容
2. **并行优化**：骨架确定后，血肉可并行生成
3. **局部重写**：Reviewer 发现对话问题，只需重写 NodeDraft，不影响 PlanNode

---

## 六、总结

### 6.1 核心设计原则

| 原则 | 实践 |
|------|------|
| **Schema 即文档** | 所有字段都有 `.describe()` 说明 |
| **宽进严出** | 接受多种格式，输出统一格式 |
| **数据分层** | 骨架（结构）与血肉（内容）分离 |
| **连贯性传递** | `summary` 字段在节点间传递上下文 |
| **可追溯性** | 每个数据结构都对应明确的 Agent 输出 |

### 6.2 非线性叙事的数据支撑

| 数据字段 | 支撑的非线性特性 |
|---------|----------------|
| `PlanNode.choicesMeta` | 分支选择的元信息 |
| `PlanNode.branchType` | 分支类型分类（route/relationship/information/ending） |
| `PlanNode.functionTag` | 确保分支分布在各叙事阶段 |
| `CandidatePath.earlyBranchingOpportunities` | 引导早期分支设计 |
| `CriticReport.branchDistribution` | 检测伪非线性 |
| `Issue.type: "branch-distribution"` | 标记分支分布问题 |

### 6.3 启示

**即便是基于 LLM 的 Agent 系统，数据建模依然是核心。**

LLM 是"概率性处理器"，其输出不确定性远高于传统代码。正因如此，我们更需要：

- 明确的 Schema 定义约束输出格式
- Transform 函数标准化不同模型的差异
- 工具返回结构化数据支撑客观判断
- 清晰的数据流转保证 Agent 间协作

**"让 LLM 自由发挥"不是好的工程实践；"给 LLM 明确的输出框架"才是。**

---

## 附录：数据结构速查表

| 数据结构 | 所属 Agent | 用途 |
|---------|-----------|------|
| `WorkflowInput` | Orchestrator | 用户输入的统一入口 |
| `CandidatePath` | Story Planner (Round 1) | 候选叙事方向 |
| `PathEvaluation` | Story Planner (Round 2) | 方向评估结果 |
| `NarrativePlan` | Story Planner (Round 3) | 故事骨架 |
| `PlanNode` | Story Planner (Round 3) | 节点骨架 |
| `NodeDraft` | Node Writer | 节点血肉 |
| `DialogueDraft` | Node Writer | 对话数据 |
| `ChoiceDraft` | Node Writer | 选项数据 |
| `CriticReport` | Story Reviewer | 评审报告 |
| `Issue` | Story Reviewer | 问题记录 |
