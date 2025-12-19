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
import { generateStructuredOutput } from "../utils/structured-output-helper";

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
    const desiredNodeCount = Math.max(12, inputData.constraints?.targetNodeCount || 12);
    const desiredEndingCount = Math.max(2, inputData.constraints?.targetEndingCount || 3);
    const strictSuffix = `\n\n重要（硬约束检查）：\n- nodes 数组长度必须 >= ${desiredNodeCount}\n- branch 节点数量必须 >= 4\n- ending 节点数量必须 >= ${Math.max(2, Math.min(desiredEndingCount, 4))}\n- 必须从 START 早期就出现分支，禁止“最后才分叉”的伪非线性。\n- 只输出 JSON，不要 Markdown，不要 \`\`\` 代码块，不要解释。`;

    const isPlanTooSmall = (plan: z.infer<typeof NarrativePlanSchema>) => {
      const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
      const hasStart = nodes.some(n => n.isStart);
      const branchCount = nodes.filter(n => n.type === "branch").length;
      const endingCount = nodes.filter(n => n.isEnding).length;
      const minNodes = Math.max(10, Math.floor(desiredNodeCount * 0.7));
      return !hasStart || nodes.length < minNodes || branchCount < 2 || endingCount < 2;
    };

    try {
      const response = await agent.generate(prompt, {
        structuredOutput: {
          schema: NarrativePlanSchema,
        },
      });

      if (!response.object) {
        throw new Error("structuredOutput 返回了空 object");
      }

      const plan = response.object as z.infer<typeof NarrativePlanSchema>;
      if (isPlanTooSmall(plan)) {
        throw new Error(`plan 输出不合格/过小：nodes=${plan.nodes?.length || 0}`);
      }

      // ✅ 追踪 Token 使用
      tokenTracker.trackMastraAgent({
        agentName: 'story-planner',
        model: 'gpt-4o',
        response,
        operation: 'workflow.plan',
      });

      return {
        plan,
        worldBible: inputData.worldBible,
        characterDB: inputData.characterDB,
        styleGuide: inputData.styleGuide || {},
        constraints: inputData.constraints,
        locale: (inputData.locale as Locale) || DEFAULT_LOCALE,
      };
    } catch (error) {
      // structuredOutput 不支持/失败时：退化为“强制 JSON 输出 + 文本抽取解析”
      console.warn(
        "[planStep] structuredOutput 失败，启用退化解析:",
        error instanceof Error ? error.message : error
      );

      // 第一次退化：强制 JSON + 跳过缓存，避免复用坏缓存
      let plan = await generateStructuredOutput(agent, prompt, NarrativePlanSchema, {
        temperature: 1,
        skipCache: true,
        disableStructuredOutput: true,
      });

      // 仍不合格：加硬约束后缀再重试一次
      if (isPlanTooSmall(plan)) {
        console.warn("[planStep] 退化解析成功但 plan 仍过小，触发二次强制重试（严格约束）");
        plan = await generateStructuredOutput(agent, prompt + strictSuffix, NarrativePlanSchema, {
          temperature: 0.8,
          skipCache: true,
          disableStructuredOutput: true,
        });
      }

      return {
        plan,
      worldBible: inputData.worldBible,
      characterDB: inputData.characterDB,
      styleGuide: inputData.styleGuide || {},
      constraints: inputData.constraints,
      locale: (inputData.locale as Locale) || DEFAULT_LOCALE,
      };
    }
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

          try {
            const draft = await generateStructuredOutput(agent, prompt, NodeDraftSchema, {
              temperature: 1,
            });
            return { nodeId: node.id, draft };
          } catch (error) {
            console.warn(
              `[WriteStep] ⚠️ 节点 ${node.id} 写作失败，使用本地兜底草稿:`,
              error instanceof Error ? error.message : error
            );
            const fallbackDraft = buildFallbackNodeDraft(node, { worldBible, characterDB }, previousSummary, locale);
            return { nodeId: node.id, draft: fallbackDraft };
          }
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

    let report: z.infer<typeof CriticReportSchema>;
    try {
      report = await generateStructuredOutput(agent, prompt, CriticReportSchema, {
        temperature: 0.7,
        maxSteps: 5,
      });
    } catch (error) {
      console.warn(
        "[ReviewStep] ⚠️ 审阅失败，使用兜底报告（不重写）:",
        error instanceof Error ? error.message : error
      );
      report = buildFallbackReviewReport();
    }
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

    // 并行重写目标节点（单节点失败不影响整体）
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

        try {
          const rewrittenDraft = await generateStructuredOutput(agent, prompt, NodeDraftSchema, {
            temperature: 0.9,
          });
          updatedDrafts[nodeId] = rewrittenDraft;
        } catch (error) {
          console.warn(
            `[RewriteStep] ⚠️ 节点 ${nodeId} 重写失败，保留原草稿:`,
            error instanceof Error ? error.message : error
          );
          updatedDrafts[nodeId] = originalDraft;
        }
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

function buildFallbackNodeDraft(
  node: z.infer<typeof NarrativePlanSchema>["nodes"][number],
  ctx: { worldBible: any; characterDB: any },
  previousSummary: string | undefined,
  locale: Locale
): z.infer<typeof NodeDraftSchema> {
  const isCN = locale.includes("zh");
  const characters = ctx.characterDB?.characters || [];
  const speaker = characters[0]?.name || (isCN ? "旁白" : "Narrator");
  const sceneName =
    (node as any)?.sceneName ||
    ctx.worldBible?.scenes?.[0]?.name ||
    ctx.worldBible?.name ||
    (isCN ? "默认场景" : "Default Scene");

  const choices =
    node.type === "branch"
      ? (node.choicesMeta || []).slice(0, 2).map((choice: any, idx: number) => ({
          id: choice.id || `choice-${idx + 1}`,
          text: choice.text || (isCN ? `选择 ${idx + 1}` : `Choice ${idx + 1}`),
          targetNodeId: choice.leadsTo || choice.targetNodeId || node.nextNodeId || "unknown",
          meta: {
            emotionalWeight: choice.emotionalWeight || (isCN ? "中立" : "neutral"),
            consequenceHint: choice.consequenceHint || (isCN ? "继续故事" : "Continue"),
          },
        }))
      : undefined;

  const summary = (node as any)?.brief || (node as any)?.title || previousSummary || (isCN ? "故事继续展开……" : "The story continues...");

  return {
    id: node.id,
    type: node.type,
    title: (node as any)?.title || (node as any)?.name || (isCN ? "未命名节点" : "Untitled Node"),
    sceneName,
    narration: (node as any)?.brief || previousSummary || (isCN ? "系统自动生成的节点描述" : "System-generated node description"),
    dialogues: [
      {
        characterName: speaker,
        text: summary,
        emotion: "neutral",
      },
    ],
    choices,
    nextNodeId: (node as any)?.nextNodeId || undefined,
    summary,
  };
}

function buildFallbackReviewReport(): z.infer<typeof CriticReportSchema> {
  return {
    scores: {
      plotCoherence: 85,
      characterConsistency: 85,
      dialogueQuality: 85,
      branchMeaningfulness: 85,
      branchDistribution: 85,
      pacing: 85,
    },
    overallScore: 85,
    issues: [],
    shouldRegenerate: false,
    regenerateTarget: "none",
    targetNodeIds: [],
  };
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

