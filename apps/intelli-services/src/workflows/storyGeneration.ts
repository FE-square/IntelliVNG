/**
 * Story Generation Workflow
 * 使用 Mastra Workflow 编排 Plan → Write → Review → Rewrite 流程
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { 
  NarrativePlanSchema, 
  NodeDraftSchema, 
  CriticReportSchema,
  WorkflowInputSchema,
  type WorkflowInput,
} from "../agents/schemas";

// ============ 提示词构建函数 ============

/**
 * 构建 Story Planner 的提示词
 * 详细说明 Tree-of-Thoughts (ToT) 方法的执行步骤
 */
function buildPlannerPrompt(inputData: WorkflowInput): string {
  return `## 你的任务
设计一个非线性视觉小说的**故事结构骨架**（只规划结构，不写对话）。

## 世界观设定
${JSON.stringify(inputData.worldBible, null, 2)}

## 角色档案
${JSON.stringify(inputData.characterDB, null, 2)}

## 风格指南
${JSON.stringify(inputData.styleGuide || {}, null, 2)}

## 约束条件
- 目标节点数: ${inputData.constraints?.targetNodeCount || 12}
- 目标结局数: ${inputData.constraints?.targetEndingCount || 3}

---

## 🌳 请使用 Tree-of-Thoughts (ToT) 方法进行设计

ToT 是一种结构化思维方法，你需要像下棋一样"向前看几步"，探索多种可能性后选择最优解。

### Step 1: 生成故事前提 (Premise)
首先，用一句话描述故事核心：
> "一个关于 [主角名字] 在 [世界背景] 中 [面对什么核心冲突] 的故事"

### Step 2: 分支思考 - 探索 2-3 条叙事路径
针对这个前提，思考 2-3 种不同的叙事方向。对每条路径进行评估：

| 路径 | 描述 | 戏剧性(1-5) | 角色契合度(1-5) | 分支潜力(1-5) | 总分 |
|------|------|------------|----------------|--------------|------|
| A    | ...  | ?          | ?              | ?            | ?    |
| B    | ...  | ?          | ?              | ?            | ?    |
| C    | ...  | ?          | ?              | ?            | ?    |

### Step 3: 选择最优路径
选择总分最高的路径，并简要说明选择理由。

### Step 4: 展开节点骨架
基于选定的路径，设计具体的节点结构：

1. **START 节点** (唯一，isStart: true)
   - functionTag: "setup"
   - 介绍主角和世界观

2. **发展节点** (SCENE 类型)
   - functionTag: "rising" → "conflict"
   - 矛盾逐渐升温

3. **分支节点** (BRANCH 类型，2-3 个)
   - functionTag: 通常是 "conflict" 或 "climax"
   - 每个选项必须有：
     * emotionalWeight: "轻松" | "沉重" | "痛苦抉择"
     * consequenceHint: 暗示后果（不剧透）
     * pathType: "通向好结局" | "通向坏结局" | "中立路线"

4. **结局节点** (ENDING 类型，2-3 个，isEnding: true)
   - functionTag: "resolution"
   - 不同选择导向不同结局

### Step 5: 验证连通性
- ✅ 每个节点都能从 START 到达
- ✅ 每条路径最终都能到达某个 ENDING
- ✅ 非 ENDING 节点必须有 nextNodeId 或 choicesMeta
- ✅ sceneName 都来自用户定义的场景列表

---

请按照上述步骤思考，然后输出符合 NarrativePlan 格式的 JSON。`;
}

// ============ Step 1: 规划阶段 ============
export const planStep = createStep({
  id: "plan",
  inputSchema: WorkflowInputSchema,
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("story-planner");
    
    const prompt = buildPlannerPrompt(inputData);

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: NarrativePlanSchema,
      },
    });

    return { 
      plan: response.object as z.infer<typeof NarrativePlanSchema>,
      worldBible: inputData.worldBible,
      characterDB: inputData.characterDB,
      styleGuide: inputData.styleGuide || {},
    };
  },
});

// ============ Step 2: 并行写作阶段 ============
export const writeStep = createStep({
  id: "write",
  inputSchema: z.object({
    plan: NarrativePlanSchema,
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("node-writer");
    const { plan, characterDB, styleGuide, worldBible } = inputData;

    // 拓扑排序：按深度分层
    const layers = topologicalSort(plan.nodes);
    const drafts: Record<string, z.infer<typeof NodeDraftSchema>> = {};

    console.log(`[WriteStep] 开始写作，共 ${plan.nodes.length} 个节点，分 ${layers.length} 层`);

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      console.log(`[WriteStep] 正在写作第 ${layerIdx + 1} 层，包含 ${layer.length} 个节点`);
      
      // 同一层并行调用
      const results = await Promise.all(
        layer.map(async (node) => {
          // 获取前序节点摘要
          const previousSummary = getPreviousSummary(node, plan.nodes, drafts);

          const prompt = `## 当前要写的节点
${JSON.stringify(node, null, 2)}

## 前序节点摘要
${previousSummary || "（这是故事的开始）"}

## 角色档案
${JSON.stringify(characterDB.characters?.map((c: any) => ({
  name: c.name,
  displayName: c.displayName || c.name,
  personality: c.personality?.traits || [],
  identity: c.identity,
  description: c.description,
})), null, 2)}

## 风格指南
${JSON.stringify(styleGuide, null, 2)}

请为这个节点撰写对话和旁白。`;

          const response = await agent.generate(prompt, {
            structuredOutput: {
              schema: NodeDraftSchema,
            },
          });

          return { nodeId: node.id, draft: response.object as z.infer<typeof NodeDraftSchema> };
        })
      );

      // 保存本层结果
      results.forEach(r => {
        drafts[r.nodeId] = r.draft;
      });
    }

    console.log(`[WriteStep] 写作完成，共生成 ${Object.keys(drafts).length} 个节点草稿`);

    return { plan, drafts, worldBible, characterDB, styleGuide };
  },
});

// ============ Step 3: 审阅阶段 ============
export const reviewStep = createStep({
  id: "review",
  inputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("story-reviewer");
    const { plan, drafts, worldBible, characterDB, styleGuide } = inputData;

    console.log(`[ReviewStep] 开始审阅故事...`);

    // 构建供工具使用的节点数据
    const nodesForValidation = Object.values(drafts).map((d: any) => ({
      id: d.id,
      type: d.type,
      isStart: plan.nodes.find(n => n.id === d.id)?.isStart,
      isEnding: plan.nodes.find(n => n.id === d.id)?.isEnding,
      nextNodeId: d.nextNodeId,
      choices: d.choices?.map((c: any) => ({ targetNodeId: c.targetNodeId })),
      dialogues: d.dialogues,
      narration: d.narration,
    }));

    const prompt = `## 待审阅的节点草稿
${JSON.stringify(Object.values(drafts), null, 2)}

## 原始故事规划
${JSON.stringify(plan.outline, null, 2)}

## 角色档案
${JSON.stringify(characterDB.characters?.map((c: any) => ({
  name: c.name,
  displayName: c.displayName,
  personality: c.personality?.traits,
})), null, 2)}

---

请按照 ReAct 模式审阅这个故事：
1. 调用 validate-structure 检查结构
2. 调用 analyze-paths 分析路径多样性
3. 调用 analyze-dialogue-quality 检查对话质量
4. 基于工具输出，给出综合评分和修改建议

检查用的节点数据:
${JSON.stringify(nodesForValidation, null, 2)}`;

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: CriticReportSchema,
      },
      maxSteps: 5,
    });

    const report = response.object as z.infer<typeof CriticReportSchema>;
    console.log(`[ReviewStep] 审阅完成，综合评分: ${report.overallScore}`);

    return { plan, drafts, report, worldBible, characterDB, styleGuide };
  },
});

// ============ Step 4: 重写阶段（条件执行） ============
export const rewriteStep = createStep({
  id: "rewrite",
  inputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
    rewritten: z.array(z.string()),
  }),
  execute: async ({ inputData, mastra }) => {
    const { plan, drafts, report, characterDB, styleGuide } = inputData;

    // 如果不需要重写，直接返回
    if (!report.shouldRegenerate || report.regenerateTarget === "none") {
      console.log(`[RewriteStep] 评分 ${report.overallScore}，无需重写`);
      return { plan, drafts, report, rewritten: [] };
    }

    const agent = mastra.getAgent("node-writer");
    const targetIds = report.targetNodeIds || [];
    const updatedDrafts = { ...drafts };

    console.log(`[RewriteStep] 需要重写 ${targetIds.length} 个节点: ${targetIds.join(", ")}`);

    // 并行重写目标节点
    await Promise.all(
      targetIds.map(async (nodeId) => {
        const issue = report.issues.find(i => i.nodeIds.includes(nodeId));
        const originalDraft = drafts[nodeId];
        
        if (!originalDraft) {
          console.log(`[RewriteStep] 节点 ${nodeId} 不存在，跳过`);
          return;
        }

        const prompt = `## 原始草稿
${JSON.stringify(originalDraft, null, 2)}

## 审稿人的修改建议
${issue?.suggestion || "请优化对话质量，使其更加生动自然"}

## 问题类型
${issue?.type || "dialogue"} - ${issue?.description || "需要优化"}

## 角色档案
${JSON.stringify(characterDB.characters?.map((c: any) => ({
  name: c.name,
  displayName: c.displayName || c.name,
  personality: c.personality?.traits || [],
})), null, 2)}

## 风格指南
${JSON.stringify(styleGuide, null, 2)}

请根据审稿人的修改建议重写这个节点，保持 id、type、sceneName、nextNodeId/choices 结构不变。`;

        const response = await agent.generate(prompt, {
          structuredOutput: {
            schema: NodeDraftSchema,
          },
        });

        updatedDrafts[nodeId] = response.object as z.infer<typeof NodeDraftSchema>;
      })
    );

    console.log(`[RewriteStep] 重写完成`);

    return { plan, drafts: updatedDrafts, report, rewritten: targetIds };
  },
});

// ============ 辅助函数 ============

/**
 * 拓扑排序：按 BFS 深度分层
 */
function topologicalSort(nodes: z.infer<typeof NarrativePlanSchema>["nodes"]) {
  const layers: (typeof nodes)[] = [];
  const visited = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // 找到起始节点
  const startNode = nodes.find(n => n.isStart);
  if (!startNode) {
    console.warn("[topologicalSort] 没有找到起始节点，返回所有节点为单层");
    return [nodes];
  }

  // BFS 分层
  let currentLayer = [startNode];
  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach(n => visited.add(n.id));

    const nextLayer: typeof nodes = [];
    currentLayer.forEach(node => {
      // 收集下一层节点（通过 nextNodeId）
      if (node.nextNodeId && !visited.has(node.nextNodeId)) {
        const next = nodeMap.get(node.nextNodeId);
        if (next && !nextLayer.some(n => n.id === next.id)) {
          nextLayer.push(next);
        }
      }
      // 收集下一层节点（通过 choicesMeta）
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

  // 处理孤立节点（可能是 Planner 的 bug）
  const orphans = nodes.filter(n => !visited.has(n.id));
  if (orphans.length > 0) {
    console.warn(`[topologicalSort] 发现 ${orphans.length} 个孤立节点: ${orphans.map(n => n.id).join(", ")}`);
    layers.push(orphans);
  }

  return layers;
}

/**
 * 获取前序节点的摘要
 */
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
  inputSchema: WorkflowInputSchema,
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
    rewritten: z.array(z.string()),
  }),
})
  .then(planStep)
  .then(writeStep)
  .then(reviewStep)
  .then(rewriteStep)
  .commit();

