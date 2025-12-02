# 将 GameGenerator 智能体化的初步方案
> apps/intelli-services/src/services/game-generator.ts

## 总体目标与约束

- **目标**：基于你现有的 `StoryNode` / `GameProject` 数据结构，搭建一个**多智能体非线性故事工坊**，在有限复杂度下实现：
  - **逐节点写作**：每个节点单独生成与修订，便于控制与并行；
  - **有意义分叉**：每个选择不仅连通结构，还在情感、结局走向上有“味道”；
  - **适度检查**：结构 + 叙事质量 + 连续性做到“可用且可讲”，避免过度工程；
  - **与现有系统平滑对齐**：对外仍输出 `GameProject`，最大限度复用当前代码。

---

## 总体架构：3-Agent 的“非线性故事工坊”

- **核心理念**：用 3 个能力清晰、可讲性强的 Agent 角色，串起“规划 → 逐节点写作 → 审稿与修订”的闭环。
- **架构概览**（逻辑结构）：

  - **Shared Memory（共享内存层）**
    - `WorldBible`：世界观+场景设定（来自用户的 worldSetting / scenes / backgrounds）。
    - `CharacterSheets`：角色档案（来自用户 characters）。
    - `StyleGuide`：主题与风格（来自 themeSetting）。
    - `NarrativePlan`：结构骨架（Planner 输出）。
    - `NodeDrafts`：逐节点写作的中间稿。
    - `CriticReports`：审稿与连续性检查结果。

  - **Agents**
    - **Agent A：Story Planner（故事规划师）**
    - **Agent B：Node Writer（节点写作师）**
    - **Agent C：Story Reviewer（故事审稿人）**

  - **Orchestrator**
    - 由现在的 `GameGenerator` 演化：控制流程、调用各 Agent、运行 TS 级校验（`validateNodeConnections`），最终产出 `GameProject`。

---

## Agent A：Story Planner（故事规划师）

- **角色定位**
  - 综合你文档里的 `Narrative Director + Story Architect`，只负责**高层非线性结构**，不写具体台词。

- **输入**
  - **来自用户/前端的设定**：
    - 角色：`characters: Character[]`
    - 世界观/场景：`worldSetting` + `scenes` / `backgrounds`
    - 主题与风格：`themeSetting`
  - **系统约束**：
    - 目标结局数量（例如 2–3 个）
    - 目标节点数量（例如 10–15 个）
    - 复杂度：`"simple" | "medium"`（Hackathon MVP 推荐先支持到 medium）

- **输出：NarrativePlan（结构骨架）**（示意）

  ```typescript
  interface NarrativePlan {
      outline: {
          premise: string;
          centralConflict: string;
          thematicArc: string;
      };
      nodes: Array<{
          id: string;
          type: 'scene' | 'branch' | 'ending';
          isStart?: boolean;
          isEnding?: boolean;
          title: string;
          brief: string;           // 该节点的一句话摘要
          functionTag: string;     // 'setup' | 'conflict' | 'twist' | 'climax' | 'resolution'
          sceneName?: string;      // 绑定到用户的场景名（由 Planner 或后续补全）
          nextNodeId?: string;     // 线性跳转
          choicesMeta?: Array<{
              id: string;
              leadsTo: string;         // targetNodeId
              emotionalWeight: string; // "轻松" / "沉重" / "痛苦决定" ...
              consequenceHint: string; // 不剧透的后果暗示
              pathType: string;        // 走向哪类结局或路线类型
          }>;
      }>;
  }
  ```

- **关键点**
  - **只规划结构 +意义**，不生成 `dialogues`；
  - 明确每个 `branch` 的 `choicesMeta`，为后面“有意义分叉”提供结构依据；
  - 输出的 `nodes` 将被直接映射/扩展为 `GeneratedContent.storyNodes`，再过渡到 `StoryNode`。

- **内部策略**
  - Prompt 中采用 **CoT / Tree-of-Thoughts**：
    - 先写 premise / centralConflict → 再设计各幕结构 → 再分配分支与结局；
    - 最后整理为结构化 JSON。

---

## Agent B：Node Writer（节点写作师）

- **角色定位**
  - 汇总你文档里的 `Scene Composer + Character Writer + Branch Designer`，但**以“逐节点”为单位工作**。
  - 对每个 Plan 中的节点，负责写出：旁白、对话，及必要的分支文案。

- **输入：NodeWritingTask**

  ```typescript
  interface NodeWritingTask {
      planNode: NarrativePlan['nodes'][number]; // 对应骨架节点
      worldBible: WorldBible;                   // 世界观、场景、规则
      characterSheets: CharacterSheet[];        // 角色档案（含性格、目标、关系）
      styleGuide: StyleGuide;                  // 主题/语气/基调要求
      previousNodeDraft?: NodeDraft;           // 用于保持局部连贯性（可选）
  }
  ```

- **输出：NodeDraft（节点草稿）**

  ```typescript
  interface NodeDraft {
      id: string;                 // 与 planNode.id 对齐
      type: 'scene' | 'branch' | 'ending';
      title: string;
      sceneName?: string;         // 确保是用户定义场景之一
      narration?: string;
      dialogues: Array<{
          characterName: string;
          text: string;
          emotion?: string;
      }>;
      choices?: Array<{
          text: string;
          targetNodeId: string;
          condition?: string;     // 可用于编码 emotionalWeight/后果标签
          meta?: {
              emotionalWeight?: string;
              consequenceHint?: string;
              pathType?: string;
          };
      }>;
  }
  ```

- **工作方式**
  - **普通节点（scene / ending）**
    - 根据 `planNode.brief + functionTag + sceneName`，写 3–6 句对话 + 适量旁白；
    - 考虑 `characterSheets` 中的动机与关系，保证角色一致性。
  - **分支节点（branch）**
    - 参考 `planNode.choicesMeta`，同时：
      - 为每个 choice 写**玩家可见的选择文案**（`text`）；
      - 在 `meta` 中保留 `emotionalWeight` / `consequenceHint`，为 UI 或 QA 使用；
      - 在 `condition` 中可以嵌入简短的“标签式说明”（便于你现有结构兼容）。
  - 每个节点**单独调用**模型，可并行执行，提高性能与稳定性。

- **与现有结构的对齐**
  - NodeDraft 结构与 `GeneratedContent.storyNodes` / `StoryNode` 高度相似，后续只需：
    - 把 `characterName` 通过 `characterMap` 映射为 `characterId`；
    - 把 `sceneName` 映射为 `backgroundId`；
    - `choices.meta` 可选择：
      - 映射到 `StoryNode.notes` / `tags` 中；
      - 或压缩进 `condition` 字段（比如 `"情感:沉重;后果:走向坏结局"`）。

---

## Agent C：Story Reviewer（故事审稿人）

- **角色定位**
  - 合并你的 `Narrative Critic + Continuity Checker`，在一次调用中完成**质量评估 + 连续性检查 + 局部重写建议**。

- **输入：ReviewTask**

  ```typescript
  interface ReviewTask {
      nodes: NodeDraft[];                 // 全部节点草稿
      narrativePlan: NarrativePlan;       // 结构骨架
      worldBible: WorldBible;
      characterSheets: CharacterSheet[];
      structureReport: StructureReport;   // TS 工具生成：连通性/死路/路径信息
  }
  ```

- **输出：CriticReport**

  ```typescript
  interface CriticReport {
      scores: {
          plotCoherence: number;
          characterConsistency: number;
          dialogueQuality: number;
          emotionalImpact: number;
          pacing: number;
          branchMeaningfulness: number;
      };
      overallScore: number;
      issues: Array<{
          type: 'structure' | 'logic' | 'character' | 'dialogue' | 'branch';
          severity: 'minor' | 'major' | 'critical';
          nodeIds: string[];
          description: string;
          suggestion: string;   // 如何修改
      }>;
      shouldRegenerate: boolean;
      regenerateTarget: 'all' | 'specific_nodes' | 'dialogues';
      targetNodeIds?: string[]; // 推荐重写的节点
  }
  ```

- **工作方式**
  - 先阅读 `structureReport`（由 `validateNodeConnections` + 路径分析生成），确认：
    - 是否存在孤立节点、死胡同、非法连接；
    - 若有，直接标记为 `critical` 问题。
  - 结合 `worldBible` 和 `characterSheets`：
    - 检查前后设定/信息是否矛盾；
    - 检查角色是否 OOC；
    - 检查分支是否“有意义”（选择带来的情绪/结局走向是否足够差异）。
  - 给出**节点级的修改建议**，并指明是否需要触发局部重写。

- **与 Node Writer 的协作**
  - Orchestrator 根据 `CriticReport.targetNodeIds`，对这些节点重新构造 `NodeWritingTask`：
    - 携带原始 `NodeDraft` + `issues.suggestion`；
    - Node Writer 做“修订版”生成，而不是从零开始。

---

## 与现有 `StoryNode` / `GameProject` 的对齐方式

- **中间层 → 现有层的映射**

  1. **NarrativePlan.nodes → NodeDraft**
     - Planner 只给骨架与 `choicesMeta`；
     - Node Writer 基于此写出 `NodeDraft`（带对话/旁白/choices）。

  2. **NodeDraft[] → GeneratedContent.storyNodes**
     - 结构几乎一一对应，只需注意：
       - 把 `choices.meta` 根据需要塞入 `condition` 或 `notes/tags`（可在 `StoryNode` 扩展轻量 meta 字段）。

  3. **GeneratedContent.storyNodes → StoryNode[] / GameProject**
     - 完全复用你当前的 `transformToGameProjectWithSetup`：
       - 角色名 → 角色 ID 映射；
       - sceneName → backgroundId 映射；
       - `validateNodeConnections` 作为**最后一道硬校验**。

- **结构检查与 Reviewer 的关系**
  - TS 工具（`validateNodeConnections` 等）负责：
    - 严格的图结构合法性（无孤立、无死路、指向存在的节点）；
  - Reviewer 负责：
    - 高层叙事质量与连续性；
  - Orchestrator 先跑 TS 校验，再把结构报告送给 Reviewer 做“工具增强的 ReAct”。

---

## 工作流程（Demo 友好的“讲故事”版本）

### 1. 设定收集与内存构建

- **输入**：用户在 Setup 流程中配置的 `characters`、`worldSetting` / `backgrounds`、`scenes`、`themeSetting`。
- **Orchestrator**：
  - 整理为 `WorldBible` / `CharacterSheets` / `StyleGuide`；
  - 调用 **Story Planner** 生成 `NarrativePlan`。

### 2. 结构规划与快速自检

- 使用 TS 工具对 `NarrativePlan` 做初步结构检查（节点数量、分支数量、结局数量是否满足约束）。
- 若结构明显不合要求，可直接让 Planner 重试一次（不进入后续昂贵阶段）。

### 3. 逐节点写作（Node Writer 并行生成）

- Orchestrator 遍历 `NarrativePlan.nodes`：
  - 构造 `NodeWritingTask`；
  - 调用 **Node Writer** 生成对应 `NodeDraft`；
  - 可对同一“深度层”的节点做并行调用。

### 4. 全局检查与审稿（Story Reviewer）

- Orchestrator：
  - 基于 `NodeDraft[]` 暂时构建 `GeneratedContent`；
  - 运行 `validateNodeConnections` → 得到 `StructureReport`；
  - 构造 `ReviewTask` 调用 **Story Reviewer**；
  - 若 `shouldRegenerate && regenerateTarget === 'specific_nodes'`：
    - 针对 `targetNodeIds` 重走 Node Writer（带上修改建议）。

### 5. 最终映射与输出

- 当 Reviewer 评分达标或达到最大迭代次数：
  - 把最终 `NodeDraft[]` 组装为 `GeneratedContent.storyNodes`；
  - 调用现有的 `transformToGameProjectWithSetup` → 得到最终 `GameProject`；
  - 返回给前端，进入你已有的可视化编辑 / 游玩流程。

---

## 小结：复杂度适中 & 可讲性

- **复杂度控制在 3 个核心 Agent + 1 个 Orchestrator + 1 组 TS 校验工具**，实现成本可控；
- 对外可以用非常好讲的故事：
  - “Planner 先画出非线性结构骨架 → Writer 按节点逐个写完场景与分支 → Reviewer 像编辑一样挑刺和要求重写 → 最后映射成我们自己的 `StoryNode` 游戏脚本格式。”
- 如果你愿意，下一步我可以基于这份设计，帮你写一版：
  - `types/agents.ts` 的 TS 接口；
  - 以及 `StoryOrchestrator` 的伪代码/流程骨架，方便你在 `intelli-services` 中直接落地。

---

# 基于 Mastra 的 Agent 和 Workflow 两种模式进行实现

[2 tools called]

根据 Mastra 的设计理念，答案是 **分而治之**！让我给你一个清晰的对应关系：

---

## 📊 模式选择策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           你的设计                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Story Planner ─────┐                                                      │
│   (ToT + JSON)       │                                                      │
│                      │                                                      │
│   Node Writer   ─────┼──► 这些是 "做什么" ──► 用 Agent 模式                 │
│   (Few-Shot CoT)     │                                                      │
│                      │                                                      │
│   Story Reviewer ────┘                                                      │
│   (ReAct + Tools)                                                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Orchestrator ──────────► 这是 "怎么串" ──► 用 Workflow 模式              │
│   (状态机 + 重试)                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 对应关系

| 你的设计 | Mastra 模式 | 原因 |
|---------|------------|------|
| **Story Planner** | `Agent` | 有独立指令、结构化输出、自主决策 |
| **Node Writer** | `Agent` | 有独立指令、可被并行调用 |
| **Story Reviewer** | `Agent` + `Tools` | 需要调用工具（ReAct 模式） |
| **Orchestrator** | `Workflow` | 编排顺序、条件分支、重试逻辑 |

---

## 📐 架构示意

```typescript
// ============ 1. Agent 层：定义"能力" ============

// agents/storyPlanner.ts
export const storyPlannerAgent = new Agent({
  name: 'Story Planner',
  instructions: '...',  // ToT prompt
  structuredOutput: { schema: NarrativePlanSchema },
});

// agents/nodeWriter.ts  
export const nodeWriterAgent = new Agent({
  name: 'Node Writer',
  instructions: '...',  // Few-Shot CoT prompt
  structuredOutput: { schema: NodeDraftSchema },
});

// agents/storyReviewer.ts
export const storyReviewerAgent = new Agent({
  name: 'Story Reviewer',
  instructions: '...',  // ReAct prompt
  tools: { validateStructure, analyzePaths },  // 工具注入
  structuredOutput: { schema: CriticReportSchema },
});

// ============ 2. Workflow 层：定义"流程" ============

// workflows/storyGeneration.ts
export const storyGenerationWorkflow = new Workflow({ name: 'story-generation' })
  
  // Step 1: 调用 Planner Agent
  .step(new Step({
    id: 'plan',
    execute: async ({ context }) => {
      return await storyPlannerAgent.generate(context.triggerData);
    },
  }))
  
  // Step 2: 并行调用多个 Writer Agent
  .then(new Step({
    id: 'write',
    execute: async ({ context }) => {
      const plan = context.stepResults.plan;
      // 并行写作所有节点
      return await Promise.all(
        plan.nodes.map(node => nodeWriterAgent.generate({ node, ...context }))
      );
    },
  }))
  
  // Step 3: 调用 Reviewer Agent
  .then(new Step({
    id: 'review',
    execute: async ({ context }) => {
      return await storyReviewerAgent.generate(context.stepResults);
    },
  }))
  
  // Step 4: 条件分支 (Orchestrator 状态机逻辑)
  .branch([
    {
      condition: ({ context }) => context.stepResults.review.shouldRegenerate,
      workflow: rewriteWorkflow,  // 重写分支
    },
    {
      condition: ({ context }) => !context.stepResults.review.shouldRegenerate,
      workflow: finalizeWorkflow, // 完成分支
    },
  ])
  .commit();
```

---

## 🔑 关键点

### 为什么 Agent 不能单独完成？

Agent 是**无状态**的单次调用，它不知道：
- 自己被调用的顺序
- 前一个 Agent 的输出
- 是否需要重试

这些都需要 **Workflow** 来管理。

### 为什么 Workflow 不能单独完成？

Workflow 只是**流程控制**，它不负责：
- 定义 prompt 和指令
- 管理工具调用（ReAct）
- 结构化输出校验

这些是 **Agent** 的职责。

---

## ✅ 最终答案

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   Agent 模式  →  定义每个智能体的"能力边界"                  │
│                  (指令、工具、输出格式)                      │
│                                                            │
│   Workflow 模式 →  编排智能体的"协作流程"                   │
│                   (顺序、并行、分支、重试)                   │
│                                                            │
│   两者结合 = 你设计的 Multi-Agent 系统                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

要我现在开始实现吗？建议从 **Agent 定义** 开始（因为 Workflow 依赖 Agent）：

1. 先定义 `storyPlannerAgent` + Zod Schema
2. 再定义 `nodeWriterAgent`
3. 再定义 `storyReviewerAgent` + Tools
4. 最后用 `Workflow` 把它们串起来