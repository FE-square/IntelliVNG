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
import { type Locale, DEFAULT_LOCALE } from '../utils/locale';
import { promptManager } from '../prompts';
import { tokenTracker } from '../services/token-tracker';

// ============ 提示词构建函数 ============

/**
 * 构建 Story Planner 的提示词
 * 详细说明 Tree-of-Thoughts (ToT) 方法的执行步骤
 */
function buildPlannerPrompt(inputData: WorkflowInput): string {
  const locale = (inputData.locale as Locale) || DEFAULT_LOCALE;
  const { user } = promptManager.build('workflow.planner-single-call', {
    worldBible: JSON.stringify(inputData.worldBible, null, 2),
    characterDB: JSON.stringify(inputData.characterDB, null, 2),
    styleGuide: JSON.stringify(inputData.styleGuide || {}, null, 2),
    targetNodeCount: String(inputData.constraints?.targetNodeCount || 12),
    targetEndingCount: String(inputData.constraints?.targetEndingCount || 3),
  }, locale);
  return user;
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
    constraints: z.any().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("story-planner");
    
    const prompt = buildPlannerPrompt(inputData);

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: NarrativePlanSchema,
      },
    });

    // ✅ 追踪 Token 使用
    tokenTracker.trackMastraAgent({
      agentName: 'story-planner',
      model: 'gpt-4o',
      response,
      operation: 'workflow.plan',
    });

    return { 
      plan: response.object as z.infer<typeof NarrativePlanSchema>,
      worldBible: inputData.worldBible,
      characterDB: inputData.characterDB,
      styleGuide: inputData.styleGuide || {},
      constraints: inputData.constraints,
      locale: (inputData.locale as Locale) || DEFAULT_LOCALE,
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
    constraints: z.any().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
    constraints: z.any().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("node-writer");
    const { plan, characterDB, styleGuide, worldBible, constraints } = inputData;
    const locale = (inputData.locale as Locale) || DEFAULT_LOCALE;

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

          const { user: prompt } = promptManager.build('workflow.write-node', {
            planNode: JSON.stringify(node, null, 2),
            previousNodeSummary: previousSummary || "（这是故事的开始）",
            characters: JSON.stringify(characterDB.characters?.map((c: any) => ({
              name: c.name,
              displayName: c.displayName || c.name,
              personality: c.personality?.traits || [],
              identity: c.identity,
              description: c.description,
            })), null, 2),
            styleGuide: JSON.stringify(styleGuide, null, 2),
          }, locale);

          const response = await agent.generate(prompt, {
            structuredOutput: {
              schema: NodeDraftSchema,
            },
          });

          // ✅ 追踪 Token 使用
          tokenTracker.trackMastraAgent({
            agentName: 'node-writer',
            model: 'gpt-4o',
            response,
            operation: `workflow.write.${node.id}`,
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

    return { plan, drafts, worldBible, characterDB, styleGuide, constraints, locale };
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
    constraints: z.any().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
    worldBible: z.any(),
    characterDB: z.any(),
    styleGuide: z.any(),
    constraints: z.any().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("story-reviewer");
    const { plan, drafts, worldBible, characterDB, styleGuide, constraints } = inputData;
    const locale = (inputData.locale as Locale) || DEFAULT_LOCALE;

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

    const useMcpPrompt = process.env.REVIEWER_USE_MCP === 'true';
    const promptName = useMcpPrompt ? 'workflow.review.mcp' : 'workflow.review';
    const { user: prompt } = promptManager.build(promptName, {
      drafts: JSON.stringify(Object.values(drafts), null, 2),
      planOutline: JSON.stringify(plan.outline, null, 2),
      characters: JSON.stringify(characterDB.characters?.map((c: any) => ({
        name: c.name,
        displayName: c.displayName,
        personality: c.personality?.traits,
      })), null, 2),
      constraints: JSON.stringify(constraints || {}, null, 2),
      nodesForValidation: JSON.stringify(nodesForValidation, null, 2),
    }, locale);

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: CriticReportSchema,
      },
      maxSteps: 5,
    });

    // ✅ 追踪 Token 使用
    tokenTracker.trackMastraAgent({
      agentName: 'story-reviewer',
      model: 'gpt-4o',
      response,
      operation: 'workflow.review',
    });

    const report = response.object as z.infer<typeof CriticReportSchema>;
    console.log(`[ReviewStep] 审阅完成，综合评分: ${report.overallScore}`);

    return { plan, drafts, report, worldBible, characterDB, styleGuide, constraints, locale };
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
    constraints: z.any().optional(),
    locale: z.enum(['zh-CN', 'zh-HK', 'en-US']).optional(),
  }),
  outputSchema: z.object({
    plan: NarrativePlanSchema,
    drafts: z.record(z.string(), NodeDraftSchema),
    report: CriticReportSchema,
    rewritten: z.array(z.string()),
  }),
  execute: async ({ inputData, mastra }) => {
    const { plan, drafts, report, characterDB, styleGuide } = inputData;
    const locale = (inputData.locale as Locale) || DEFAULT_LOCALE;

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

        const { user: prompt } = promptManager.build('workflow.rewrite', {
          originalDraft: JSON.stringify(originalDraft, null, 2),
          suggestion: issue?.suggestion || "请优化对话质量，使其更加生动自然",
          issueType: issue?.type || "dialogue",
          issueDescription: issue?.description || "需要优化",
          characters: JSON.stringify(characterDB.characters?.map((c: any) => ({
            name: c.name,
            displayName: c.displayName || c.name,
            personality: c.personality?.traits || [],
          })), null, 2),
          styleGuide: JSON.stringify(styleGuide, null, 2),
        }, locale);

        const response = await agent.generate(prompt, {
          structuredOutput: {
            schema: NodeDraftSchema,
          },
        });

        // ✅ 追踪 Token 使用
        tokenTracker.trackMastraAgent({
          agentName: 'node-writer',
          model: 'gpt-4o',
          response,
          operation: `workflow.rewrite.${nodeId}`,
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

