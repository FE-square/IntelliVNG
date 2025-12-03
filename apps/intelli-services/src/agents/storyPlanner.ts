/**
 * Story Planner Agent
 * 采用 Tree-of-Thoughts (ToT) 模式设计非线性故事骨架
 * 
 * ToT 通过多轮 LLM 调用实现：
 * 1. Round 1: 生成多个候选叙事方向
 * 2. Round 2: 评估每个方向的得分
 * 3. Round 3: 展开选中的方向为完整节点骨架
 */
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { NarrativePlanSchema, type NarrativePlan, type WorkflowInput } from "./schemas";
import { promptManager } from '../prompts';
import { type Locale, DEFAULT_LOCALE } from '../utils/locale';
import { generateStructuredOutput } from '../utils/structured-output-helper';

// ============ ToT 中间步骤的 Schema ============

/** 候选叙事方向 */
const CandidatePathSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  premise: z.string(),
  centralConflict: z.string(),
  potentialEndings: z.array(z.string()),
});

/** 候选方向列表 */
const CandidatePathsSchema = z.object({
  paths: z.array(CandidatePathSchema),
});

/** 方向评估结果 - 使用更宽松的类型以适应不同模型 */
const PathEvaluationSchema = z.object({
  pathId: z.string().optional(),
  id: z.string().optional(), // 某些模型可能使用 id 而不是 pathId
  scores: z.object({
    dramatic: z.number().min(1).max(5),
    characterFit: z.number().min(1).max(5),
    branchPotential: z.number().min(1).max(5),
    thematicDepth: z.number().min(1).max(5),
  }).optional(),
  totalScore: z.number().optional(),
  score: z.number().optional(), // 某些模型可能使用 score 而不是 totalScore
  reasoning: z.union([z.string(), z.object({}).passthrough()]).optional(), // 接受字符串或对象
}).passthrough().transform((data) => {
  // 标准化字段名
  return {
    pathId: data.pathId || data.id || '',
    scores: data.scores || { dramatic: 3, characterFit: 3, branchPotential: 3, thematicDepth: 3 },
    totalScore: data.totalScore || data.score || 12,
    reasoning: typeof data.reasoning === 'string' ? data.reasoning : JSON.stringify(data.reasoning || ''),
  };
});

/** 所有方向的评估 */
const AllEvaluationsSchema = z.object({
  evaluations: z.array(PathEvaluationSchema),
  selectedPathId: z.string().optional(),
  selected: z.string().optional(), // 某些模型可能使用 selected
  selectionReasoning: z.string().optional(),
  reason: z.string().optional(), // 某些模型可能使用 reason
}).passthrough().transform((data) => {
  return {
    evaluations: data.evaluations,
    selectedPathId: data.selectedPathId || data.selected || data.evaluations[0]?.pathId || '',
    selectionReasoning: data.selectionReasoning || data.reason || '选择了最佳方向',
  };
});

// ============ 基础 Agent（用于各轮调用） ============

export const storyPlannerAgent = new Agent({
  name: "story-planner",
  instructions: promptManager.build('story-planner.instructions').user,

  model: {
    id: `openai/${process.env.OPENAI_MODEL_NAME || 'gpt-5'}` as `${string}/${string}`,
    url: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// ============ ToT 多轮调用实现 ============

/**
 * 使用 Tree-of-Thoughts 方法生成故事规划
 * 
 * 这是真正的 ToT 实现，通过 3 轮 LLM 调用：
 * 1. 生成候选方向 (Generate)
 * 2. 评估候选方向 (Evaluate)
 * 3. 展开最佳方向 (Expand)
 */
export async function generateNarrativePlanWithToT(
  agent: typeof storyPlannerAgent,
  input: WorkflowInput,
  locale: Locale = DEFAULT_LOCALE
): Promise<NarrativePlan> {
  console.log("[ToT] 🌳 开始 Tree-of-Thoughts 规划...");

  // ============ Round 1: 生成候选叙事方向 ============
  console.log("[ToT] Round 1: 生成候选叙事方向...");
  
  const { user: generatePrompt } = promptManager.build('story-planner.generate-candidates', {
    worldBible: JSON.stringify(input.worldBible, null, 2),
    characterDB: JSON.stringify(input.characterDB, null, 2),
    styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
  }, locale);

  const candidates = await generateStructuredOutput(
    agent,
    generatePrompt,
    CandidatePathsSchema,
    { temperature: 1 }
  );
  
  console.log(`[ToT] Round 1 完成: 生成了 ${candidates.paths.length} 个候选方向`);
  candidates.paths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.description}`);
  });

  // ============ Round 2: 评估每个候选方向 ============
  console.log("[ToT] Round 2: 评估候选方向...");
  
  const { user: evaluatePrompt } = promptManager.build('story-planner.evaluate', {
    candidateCount: String(candidates.paths.length),
    candidates: JSON.stringify(candidates.paths, null, 2),
    characterCount: String(input.characterDB.characters?.length || 0),
    sceneCount: String(input.worldBible.scenes?.length || 0),
    styles: input.styleGuide?.styles?.join(', ') || '无',
    tone: input.styleGuide?.tone || '无',
  }, locale);

  const evaluation = await generateStructuredOutput(
    agent,
    evaluatePrompt,
    AllEvaluationsSchema,
    { temperature: 1 }
  );
  
  console.log(`[ToT] Round 2 完成: 选择了 ${evaluation.selectedPathId}`);
  console.log(`  选择理由: ${evaluation.selectionReasoning.slice(0, 100)}...`);
  evaluation.evaluations.forEach(e => {
    console.log(`  - ${e.pathId}: ${e.totalScore} 分`);
  });

  // 找到被选中的方向
  const selectedPath = candidates.paths.find(p => p.id === evaluation.selectedPathId);
  if (!selectedPath) {
    throw new Error(`选中的方向 ${evaluation.selectedPathId} 不存在`);
  }

  // ============ Round 3: 展开为完整节点骨架 ============
  console.log("[ToT] Round 3: 展开节点骨架...");
  
  const { user: expandPrompt } = promptManager.build('story-planner.expand', {
    selectedPathName: selectedPath.name,
    selectedPathPremise: selectedPath.premise,
    selectedPathConflict: selectedPath.centralConflict,
    selectedPathEndings: selectedPath.potentialEndings.join(', '),
    worldBible: JSON.stringify(input.worldBible, null, 2),
    characterDB: JSON.stringify(input.characterDB, null, 2),
    styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
    targetNodeCount: String(input.constraints?.targetNodeCount || 12),
    targetEndingCount: String(input.constraints?.targetEndingCount || 3),
  }, locale);

  const plan = await generateStructuredOutput(
    agent,
    expandPrompt,
    NarrativePlanSchema,
    { temperature: 1 }
  );
  
  console.log(`[ToT] Round 3 完成: 生成了 ${plan.nodes.length} 个节点`);
  console.log(`[ToT] 🌳 ToT 规划完成!`);
  console.log(`  - 前提: ${plan.outline.premise.slice(0, 50)}...`);
  console.log(`  - 节点数: ${plan.nodes.length}`);
  console.log(`  - 结局数: ${plan.nodes.filter(n => n.isEnding).length}`);

  return plan;
}

// ============ 向后兼容的单次调用版本（简化 ToT） ============

/**
 * 单次调用版本（保留向后兼容）
 * 这是"伪 ToT"，只在提示词中描述步骤，实际只调用一次 LLM
 */
export async function generateNarrativePlan(
  agent: typeof storyPlannerAgent,
  input: {
    worldBible: any;
    characterDB: any;
    styleGuide: any;
    constraints: {
      targetNodeCount: number;
      targetEndingCount: number;
    };
  },
  schema: any,
  locale: Locale = DEFAULT_LOCALE
): Promise<any> {
  console.warn("[StoryPlanner] ⚠️ 使用单次调用版本（伪 ToT），建议使用 generateNarrativePlanWithToT");
  
  const { user: prompt } = promptManager.build('workflow.planner-single-call', {
    worldBible: JSON.stringify(input.worldBible, null, 2),
    characterDB: JSON.stringify(input.characterDB, null, 2),
    styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
    targetNodeCount: String(input.constraints.targetNodeCount),
    targetEndingCount: String(input.constraints.targetEndingCount),
  }, locale);

  const response = await agent.generate(prompt, {
    structuredOutput: {
      schema: schema,
    },
  });

  return response.object;
}
