# 使用 Mastra 实现剧本工坊智能体系统

> 基于 [Mastra](https://github.com/mastra-ai/mastra) (18.6k ⭐) - TypeScript AI Agent 框架
> 
> **文档更新日期**: 2024-12-01 | 基于 [Mastra 官方文档](https://mastra.ai/docs)

---

## 一、Mastra 核心概念

### 1.1 Agent vs Workflow：何时使用哪个？

| 场景 | 使用 Agent | 使用 Workflow |
|------|-----------|--------------|
| **任务类型** | 开放性、需要推理 | 固定流程、多步骤 |
| **执行方式** | 自主决策，迭代直到完成 | 按预定义顺序执行 |
| **适用情况** | 单个智能体的复杂任务 | 多个步骤/智能体的协调 |

**我们的方案**：
- **Agent 定义能力**：每个智能体（Planner/Writer/Reviewer）用 Agent 定义
- **Workflow 编排流程**：用 Workflow 串联它们的执行顺序

### 1.2 核心 API 概览

```typescript
// Agent 核心 API
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";

// Workflow 核心 API  
import { createWorkflow, createStep } from "@mastra/core/workflows";

// Mastra 实例
import { Mastra } from "@mastra/core/mastra";
```

---

## 二、安装与配置

```bash
# 在 intelli-services 包中安装
cd apps/intelli-services
pnpm add @mastra/core zod
```

```bash
# .env 配置
OPENAI_API_KEY=sk-xxx
# 可选：自定义 endpoint
OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## 三、类型定义 (Zod Schema)

```typescript
// apps/intelli-services/src/agents/schemas.ts
import { z } from "zod";

// ============ Story Planner 输出 ============
export const PlanNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["scene", "branch", "ending"]),
  isStart: z.boolean().optional(),
  isEnding: z.boolean().optional(),
  title: z.string(),
  brief: z.string(),
  functionTag: z.enum(["setup", "rising", "conflict", "twist", "climax", "falling", "resolution"]),
  sceneName: z.string(),
  nextNodeId: z.string().optional(),
  choicesMeta: z.array(z.object({
    id: z.string(),
    leadsTo: z.string(),
    emotionalWeight: z.string(),
    consequenceHint: z.string(),
    pathType: z.string(),
  })).optional(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const NarrativePlanSchema = z.object({
  outline: z.object({
    premise: z.string(),
    centralConflict: z.string(),
    thematicArc: z.string(),
  }),
  nodes: z.array(PlanNodeSchema),
});

export type NarrativePlan = z.infer<typeof NarrativePlanSchema>;

// ============ Node Writer 输出 ============
export const NodeDraftSchema = z.object({
  id: z.string(),
  type: z.enum(["scene", "branch", "ending"]),
  title: z.string(),
  sceneName: z.string(),
  narration: z.string().optional(),
  dialogues: z.array(z.object({
    characterName: z.string(),
    text: z.string(),
    emotion: z.string().optional(),
  })),
  choices: z.array(z.object({
    id: z.string(),
    text: z.string(),
    targetNodeId: z.string(),
    meta: z.object({
      emotionalWeight: z.string(),
      consequenceHint: z.string(),
    }),
  })).optional(),
  nextNodeId: z.string().optional(),
  summary: z.string(),
});

export type NodeDraft = z.infer<typeof NodeDraftSchema>;

// ============ Story Reviewer 输出 ============
export const CriticReportSchema = z.object({
  scores: z.object({
    plotCoherence: z.number().min(0).max(100),
    characterConsistency: z.number().min(0).max(100),
    dialogueQuality: z.number().min(0).max(100),
    branchMeaningfulness: z.number().min(0).max(100),
    pacing: z.number().min(0).max(100),
  }),
  overallScore: z.number().min(0).max(100),
  issues: z.array(z.object({
    type: z.enum(["structure", "logic", "character", "dialogue", "branch"]),
    severity: z.enum(["minor", "major", "critical"]),
    nodeIds: z.array(z.string()),
    description: z.string(),
    suggestion: z.string(),
  })),
  shouldRegenerate: z.boolean(),
  regenerateTarget: z.enum(["none", "specific_nodes", "all"]),
  targetNodeIds: z.array(z.string()).optional(),
});

export type CriticReport = z.infer<typeof CriticReportSchema>;
```

---

## 四、Agent 定义

### 4.1 Story Planner Agent

```typescript
// apps/intelli-services/src/agents/storyPlanner.ts
import { Agent } from "@mastra/core/agent";

export const storyPlannerAgent = new Agent({
  name: "story-planner",
  instructions: `你是一位专业的非线性叙事设计师。你的任务是设计故事的**结构骨架**，不是写具体对话。

## 输出要求
请按以下步骤思考并输出 JSON：

**Step 1: 故事前提 (Tree-of-Thoughts)**
- 用一句话描述故事核心："一个关于[主角]在[世界]中[面对什么冲突]的故事"
- 列出 2-3 个可能的叙事方向，评估每个方向的戏剧性、与角色的契合度
- 选择得分最高的方向

**Step 2: 展开节点骨架**
- 设计 START 节点（必须唯一，isStart: true）
- 设计 2-3 个 BRANCH 节点（分支点，带 choicesMeta）
- 设计 2-3 个 ENDING 节点（isEnding: true）
- 用 SCENE 节点连接它们
- 每个分支选项必须有 emotionalWeight（情感重量）和 consequenceHint（后果暗示）

**Step 3: 验证连通性**
- 确保每个节点都能从 START 到达
- 确保每条路径最终都能到达某个 ENDING

## 关键约束
- 只规划结构和元信息，不生成具体对话
- sceneName 必须从用户定义的场景列表中选择
- 总节点数 10-15 个`,

  model: "openai/gpt-4-turbo",
});
```

### 4.2 Node Writer Agent

```typescript
// apps/intelli-services/src/agents/nodeWriter.ts
import { Agent } from "@mastra/core/agent";

export const nodeWriterAgent = new Agent({
  name: "node-writer",
  instructions: `你是一位专业的视觉小说编剧。你的任务是为单个故事节点撰写对话和旁白。

## 写作原则
1. 对话要体现角色性格（参考角色档案中的性格特点）
2. 每个节点 3-6 段对话，节奏紧凑
3. 分支选项要有"情感重量"差异，让玩家感受到选择的意义
4. 保持与前序节点的连贯性
5. 使用角色的 displayName 作为 characterName

## 输出格式
输出 JSON，包含：
- narration: 旁白（可选，设置场景氛围）
- dialogues: 对话列表（每段包含 characterName, text, emotion）
- choices: 分支选项（仅 branch 类型，包含 text, targetNodeId, meta）
- summary: 一句话摘要（供后续节点参考连贯性）

## 对话风格
- 避免过于书面化的表达
- 对话要有节奏感，有来有往
- 在关键情绪点使用旁白增强氛围`,

  model: "openai/gpt-4-turbo",
});
```

### 4.3 Story Reviewer Agent (带工具)

```typescript
// apps/intelli-services/src/agents/storyReviewer.ts
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// ============ 工具定义 ============

// 工具 1: 结构校验
export const validateStructureTool = createTool({
  id: "validate-structure",
  description: "检查节点连通性，找出孤立节点和死胡同。在审阅故事前必须先调用此工具。",
  inputSchema: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      isStart: z.boolean().optional(),
      isEnding: z.boolean().optional(),
      nextNodeId: z.string().optional(),
      choices: z.array(z.object({
        targetNodeId: z.string(),
      })).optional(),
    })),
  }),
  execute: async ({ context }) => {
    const { nodes } = context;
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const orphans: string[] = [];
    const deadEnds: string[] = [];
    const invalidLinks: string[] = [];

    // 找到开始节点
    const startNode = nodes.find((n: any) => n.isStart);
    if (!startNode) {
      return { valid: false, error: "没有找到开始节点", orphans: [], deadEnds: [], invalidLinks: [] };
    }

    // BFS 检查可达性
    const reachable = new Set<string>();
    const queue = [startNode.id];
    reachable.add(startNode.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = nodes.find((n: any) => n.id === currentId);
      if (!current) continue;

      // 检查 nextNodeId
      if (current.nextNodeId) {
        if (!nodeIds.has(current.nextNodeId)) {
          invalidLinks.push(`${currentId} → ${current.nextNodeId}`);
        } else if (!reachable.has(current.nextNodeId)) {
          reachable.add(current.nextNodeId);
          queue.push(current.nextNodeId);
        }
      }

      // 检查 choices
      current.choices?.forEach((choice: any) => {
        if (!nodeIds.has(choice.targetNodeId)) {
          invalidLinks.push(`${currentId} → ${choice.targetNodeId}`);
        } else if (!reachable.has(choice.targetNodeId)) {
          reachable.add(choice.targetNodeId);
          queue.push(choice.targetNodeId);
        }
      });
    }

    // 找出孤立节点
    nodes.forEach((n: any) => {
      if (!reachable.has(n.id)) {
        orphans.push(n.id);
      }
    });

    // 找出死胡同（非 ending 但没有出路）
    nodes.forEach((n: any) => {
      if (!n.isEnding && !n.nextNodeId && (!n.choices || n.choices.length === 0)) {
        deadEnds.push(n.id);
      }
    });

    return {
      valid: orphans.length === 0 && deadEnds.length === 0 && invalidLinks.length === 0,
      orphans,
      deadEnds,
      invalidLinks,
      reachableCount: reachable.size,
      totalCount: nodes.length,
    };
  },
});

// 工具 2: 路径多样性分析
export const analyzePathsTool = createTool({
  id: "analyze-paths",
  description: "分析所有可能的故事路径，评估分支的多样性和意义性",
  inputSchema: z.object({
    nodes: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const { nodes } = context;
    const paths: string[][] = [];
    const startNode = nodes.find((n: any) => n.isStart);
    
    if (!startNode) {
      return { totalPaths: 0, diversityScore: 0, pathDescriptions: [] };
    }

    // DFS 枚举所有路径
    const dfs = (nodeId: string, currentPath: string[]) => {
      const node = nodes.find((n: any) => n.id === nodeId);
      if (!node) return;

      currentPath.push(nodeId);

      if (node.isEnding) {
        paths.push([...currentPath]);
      } else if (node.choices && node.choices.length > 0) {
        node.choices.forEach((choice: any) => {
          dfs(choice.targetNodeId, currentPath);
        });
      } else if (node.nextNodeId) {
        dfs(node.nextNodeId, currentPath);
      }

      currentPath.pop();
    };

    dfs(startNode.id, []);

    // 简单的多样性评分（基于路径长度差异和独特节点比例）
    const avgLength = paths.reduce((sum, p) => sum + p.length, 0) / (paths.length || 1);
    const uniqueNodes = new Set(paths.flat()).size;
    const diversityScore = Math.min(1, (paths.length * uniqueNodes) / (nodes.length * 3));

    return {
      totalPaths: paths.length,
      diversityScore: Math.round(diversityScore * 100) / 100,
      pathDescriptions: paths.map(p => p.join(" → ")),
      avgPathLength: Math.round(avgLength * 10) / 10,
    };
  },
});

// ============ Reviewer Agent ============
export const storyReviewerAgent = new Agent({
  name: "story-reviewer",
  instructions: `你是一位资深的故事编辑。你的任务是审阅 AI 生成的故事草稿，找出问题并给出修改建议。

## 审阅流程 (ReAct 模式)
1. **首先**调用 validate-structure 工具检查结构连通性
2. 如果有结构问题（孤立节点、死胡同），标记为 critical
3. 调用 analyze-paths 工具评估分支多样性
4. 综合评分并给出修改建议

## 评分标准 (0-100)
- plotCoherence: 情节连贯性（是否有逻辑跳跃）
- characterConsistency: 角色一致性（对话是否符合性格设定）
- dialogueQuality: 对话质量（是否自然、有节奏感）
- branchMeaningfulness: 分支有意义程度（不同选择是否带来不同体验）
- pacing: 节奏（是否有松有紧，高潮铺垫是否到位）

## 输出决策
- 如果有 critical 问题 → shouldRegenerate = true, regenerateTarget = "all"
- 如果 overallScore < 70 → shouldRegenerate = true, regenerateTarget = "specific_nodes"
- 如果 overallScore >= 70 且无 critical → shouldRegenerate = false`,

  model: "openai/gpt-4-turbo",
  tools: {
    validateStructure: validateStructureTool,
    analyzePaths: analyzePathsTool,
  },
});
```

---

## 五、Workflow 定义

```typescript
// apps/intelli-services/src/workflows/storyGeneration.ts
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { 
  NarrativePlanSchema, 
  NodeDraftSchema, 
  CriticReportSchema 
} from "../agents/schemas";

// ============ Step 1: 规划 ============
const planStep = createStep({
  id: "plan",
  inputSchema: z.object({
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
    constraints: z.object({
      targetNodeCount: z.number(),
      targetEndingCount: z.number(),
    }),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("story-planner");
    
    const prompt = `## 世界观
${JSON.stringify(inputData.worldBible, null, 2)}

## 角色
${JSON.stringify(inputData.characterDB, null, 2)}

## 风格指南
${JSON.stringify(inputData.styleGuide, null, 2)}

## 约束
- 目标节点数: ${inputData.constraints.targetNodeCount}
- 目标结局数: ${inputData.constraints.targetEndingCount}

请设计故事的非线性结构骨架。`;

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: NarrativePlanSchema,
      },
    });

    return { plan: response.object };
  },
});

// ============ Step 2: 并行写作 ============
const writeStep = createStep({
  id: "write",
  inputSchema: z.object({
    plan: NarrativePlanSchema,
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  outputSchema: z.object({
    drafts: z.record(z.string(), NodeDraftSchema),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("node-writer");
    const { plan, characterDB, styleGuide } = inputData;

    // 拓扑排序：按深度分层
    const layers = topologicalSort(plan.nodes);
    const drafts: Record<string, z.infer<typeof NodeDraftSchema>> = {};

    for (const layer of layers) {
      // 同一层并行调用
      const results = await Promise.all(
        layer.map(async (node) => {
          // 获取前序节点摘要
          const previousSummary = getPreviousSummary(node, plan.nodes, drafts);

          const prompt = `## 当前节点
${JSON.stringify(node, null, 2)}

## 前序摘要
${previousSummary || "（故事开始）"}

## 角色档案
${JSON.stringify(characterDB, null, 2)}

## 风格指南
${JSON.stringify(styleGuide, null, 2)}

请为这个节点撰写对话和旁白。`;

          const response = await agent.generate(prompt, {
            structuredOutput: {
              schema: NodeDraftSchema,
            },
          });

          return { nodeId: node.id, draft: response.object };
        })
      );

      results.forEach(r => {
        drafts[r.nodeId] = r.draft;
      });
    }

    return { drafts };
  },
});

// ============ Step 3: 审阅 ============
const reviewStep = createStep({
  id: "review",
  inputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    worldBible: z.any(),
    characterDB: z.any(),
  }),
  outputSchema: z.object({
    report: CriticReportSchema,
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("story-reviewer");
    const { plan, drafts, worldBible, characterDB } = inputData;

    // 构建供工具使用的节点数据
    const nodesForValidation = Object.values(drafts).map(d => ({
      id: d.id,
      type: d.type,
      isStart: plan.nodes.find(n => n.id === d.id)?.isStart,
      isEnding: plan.nodes.find(n => n.id === d.id)?.isEnding,
      nextNodeId: d.nextNodeId,
      choices: d.choices?.map(c => ({ targetNodeId: c.targetNodeId })),
    }));

    const prompt = `## 节点草稿
${JSON.stringify(Object.values(drafts), null, 2)}

## 原始规划
${JSON.stringify(plan.outline, null, 2)}

## 角色档案
${JSON.stringify(characterDB, null, 2)}

请使用工具检查结构，然后综合评分并给出修改建议。

检查用的节点数据:
${JSON.stringify(nodesForValidation, null, 2)}`;

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: CriticReportSchema,
      },
      maxSteps: 5,  // 允许多次工具调用
    });

    return { report: response.object };
  },
});

// ============ Step 4: 重写（可选） ============
const rewriteStep = createStep({
  id: "rewrite",
  inputSchema: z.object({
    report: CriticReportSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  outputSchema: z.object({
    drafts: z.record(z.string(), NodeDraftSchema),
    rewritten: z.array(z.string()),
  }),
  execute: async ({ inputData, mastra }) => {
    const { report, drafts, characterDB, styleGuide } = inputData;

    if (!report.shouldRegenerate || report.regenerateTarget === "none") {
      return { drafts, rewritten: [] };
    }

    const agent = mastra.getAgent("node-writer");
    const targetIds = report.targetNodeIds || [];
    const updatedDrafts = { ...drafts };

    await Promise.all(
      targetIds.map(async (nodeId) => {
        const issue = report.issues.find(i => i.nodeIds.includes(nodeId));
        const originalDraft = drafts[nodeId];
        
        if (!originalDraft) return;

        const prompt = `## 原始草稿
${JSON.stringify(originalDraft, null, 2)}

## 修改建议
${issue?.suggestion || "请优化对话质量，使其更加生动自然"}

## 角色档案
${JSON.stringify(characterDB, null, 2)}

## 风格指南
${JSON.stringify(styleGuide, null, 2)}

请根据修改建议重写这个节点。`;

        const response = await agent.generate(prompt, {
          structuredOutput: {
            schema: NodeDraftSchema,
          },
        });

        updatedDrafts[nodeId] = response.object;
      })
    );

    return { drafts: updatedDrafts, rewritten: targetIds };
  },
});

// ============ 辅助函数 ============
function topologicalSort(nodes: z.infer<typeof NarrativePlanSchema>["nodes"]) {
  const layers: typeof nodes[] = [];
  const visited = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // 找到起始节点
  const startNode = nodes.find(n => n.isStart);
  if (!startNode) return [nodes];

  // BFS 分层
  let currentLayer = [startNode];
  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach(n => visited.add(n.id));

    const nextLayer: typeof nodes = [];
    currentLayer.forEach(node => {
      // 收集下一层节点
      if (node.nextNodeId && !visited.has(node.nextNodeId)) {
        const next = nodeMap.get(node.nextNodeId);
        if (next && !nextLayer.some(n => n.id === next.id)) {
          nextLayer.push(next);
        }
      }
      node.choicesMeta?.forEach(choice => {
        if (!visited.has(choice.leadsTo)) {
          const next = nodeMap.get(choice.leadsTo);
          if (next && !nextLayer.some(n => n.id === next.id)) {
            nextLayer.push(next);
          }
        }
      });
    });

    currentLayer = nextLayer;
  }

  return layers;
}

function getPreviousSummary(
  node: z.infer<typeof NarrativePlanSchema>["nodes"][number],
  allNodes: z.infer<typeof NarrativePlanSchema>["nodes"],
  drafts: Record<string, z.infer<typeof NodeDraftSchema>>
): string | undefined {
  // 找到指向当前节点的前序节点
  for (const n of allNodes) {
    if (n.nextNodeId === node.id) {
      return drafts[n.id]?.summary;
    }
    if (n.choicesMeta?.some(c => c.leadsTo === node.id)) {
      return drafts[n.id]?.summary;
    }
  }
  return undefined;
}

// ============ 组装工作流 ============
export const storyGenerationWorkflow = createWorkflow({
  id: "story-generation",
  inputSchema: z.object({
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
    constraints: z.object({
      targetNodeCount: z.number().default(12),
      targetEndingCount: z.number().default(3),
    }),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
  }),
})
  .then(planStep)
  .then(writeStep)
  .then(reviewStep)
  .then(rewriteStep)  // 根据 report 决定是否实际重写
  .commit();
```

---

## 六、Mastra 实例配置

```typescript
// apps/intelli-services/src/mastra/index.ts
import { Mastra } from "@mastra/core/mastra";
import { storyPlannerAgent } from "../agents/storyPlanner";
import { nodeWriterAgent } from "../agents/nodeWriter";
import { storyReviewerAgent } from "../agents/storyReviewer";
import { storyGenerationWorkflow } from "../workflows/storyGeneration";

export const mastra = new Mastra({
  agents: {
    "story-planner": storyPlannerAgent,
    "node-writer": nodeWriterAgent,
    "story-reviewer": storyReviewerAgent,
  },
  workflows: {
    "story-generation": storyGenerationWorkflow,
  },
  // 可选：启用日志和遥测
  logger: {
    level: "info",
  },
});
```

---

## 七、与现有 GameGenerator 集成

```typescript
// apps/intelli-services/src/services/game-generator.ts
import { mastra } from "../mastra";
import type { GameProject } from "./types";

export class GameGenerator {
  async generateFromSetup(
    characters: any[],
    worldSetting: any,
    scenes?: any[],
    themeSetting?: any
  ): Promise<GameProject> {
    
    // 构建输入
    const input = {
      worldBible: { ...worldSetting, scenes },
      characterDB: { characters },
      styleGuide: themeSetting || {},
      constraints: {
        targetNodeCount: 12,
        targetEndingCount: 3,
      },
    };

    // 获取并运行工作流
    const workflow = mastra.getWorkflow("story-generation");
    const run = await workflow.createRunAsync();
    
    const result = await run.start({
      inputData: input,
    });

    if (result.status !== "success") {
      throw new Error(`Workflow failed: ${result.status}`);
    }

    // 转换为 GameProject 格式
    return this.transformToGameProject(result.result, characters, scenes);
  }

  private transformToGameProject(
    workflowResult: any,
    userCharacters: any[],
    userScenes: any[]
  ): GameProject {
    const { drafts } = workflowResult;
    
    // 复用现有的 transformToGameProjectWithSetup 逻辑...
    // 1. 角色名 → 角色 ID 映射
    // 2. sceneName → backgroundId 映射
    // 3. 构建 StoryNode[]
    
    // ... 现有代码 ...
  }
}
```

---

## 八、文件结构

```
apps/intelli-services/src/
├── agents/
│   ├── schemas.ts              # Zod Schema 定义
│   ├── storyPlanner.ts         # Story Planner Agent
│   ├── nodeWriter.ts           # Node Writer Agent
│   └── storyReviewer.ts        # Story Reviewer Agent + Tools
├── workflows/
│   └── storyGeneration.ts      # 主工作流
├── mastra/
│   └── index.ts                # Mastra 实例配置
├── services/
│   └── game-generator.ts       # GameGenerator (集成入口)
└── index.ts
```

---

## 九、与原设计对比

| 方面 | 原 MASTRA_IMPLEMENTATION (旧) | 更新后 (新) |
|-----|------------------------------|------------|
| Agent 创建 | `new Agent({ model: { provider, name } })` | `new Agent({ model: "openai/gpt-4-turbo" })` |
| 结构化输出 | 在 Agent 定义时设置 `structuredOutput` | 在 `.generate()` 调用时传入 |
| Workflow 创建 | `new Workflow()` | `createWorkflow()` |
| Step 创建 | `new Step()` | `createStep()` |
| Step execute 参数 | `{ context }` | `{ inputData, mastra, state, setState }` |
| 获取 Agent | 直接 import | `mastra.getAgent("name")` |
| 运行 Workflow | `workflow.execute()` | `workflow.createRunAsync().start()` |

---

## 十、Hackathon 演示话术

> "我们的剧本工坊基于 **[Mastra 框架](https://github.com/mastra-ai/mastra)**——一个 18.6k star 的开源 TypeScript Agent 框架。
> 
> 系统由三个协作的智能体组成：
> - **Story Planner** 使用 Tree-of-Thoughts 设计非线性叙事骨架
> - **Node Writer** 支持并行写作，提升效率
> - **Story Reviewer** 采用 ReAct 模式，调用工具进行结构校验和路径分析
>
> 整个流程通过 Mastra Workflow 编排，每个步骤有明确的输入输出 Schema（基于 Zod）。
> 框架内置的 **可观测性** 让我们能实时追踪每个 Agent 的推理过程和工具调用。"

---

## 参考链接

- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Mastra Agents 文档](https://mastra.ai/docs/agents/overview)
- [Mastra Workflows 文档](https://mastra.ai/docs/workflows/overview)
- [Mastra Tools 文档](https://mastra.ai/docs/agents/using-tools)
