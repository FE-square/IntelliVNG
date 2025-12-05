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

export type ToTRound = 'round1' | 'round2' | 'round3';

export interface ToTProgressCallbacks {
  onRoundStart?: (round: ToTRound, payload?: Record<string, any>) => void;
  onRoundComplete?: (round: ToTRound, payload?: Record<string, any>) => void;
}
import { buildMastraModelConfig, type LLMProfile } from '../utils/llm-config';

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
const SelectedFieldSchema = z.union([
  z.string(),
  z.object({
    pathId: z.string().optional(),
    id: z.string().optional(),
    value: z.string().optional(),
  }).passthrough()
]).optional();

const AllEvaluationsSchema = z.object({
  evaluations: z.array(PathEvaluationSchema),
  selectedPathId: z.string().optional(),
  selected: SelectedFieldSchema, // 某些模型可能使用对象
  selectionReasoning: z.string().optional(),
  reason: z.string().optional(), // 某些模型可能使用 reason
}).passthrough().transform((data) => {
  return {
    evaluations: data.evaluations,
    selectedPathId: resolveSelectedPathId(data),
    selectionReasoning: data.selectionReasoning || data.reason || '选择了最佳方向',
  };
});

function resolveSelectedPathId(data: any): string {
  if (data.selectedPathId) {
    return data.selectedPathId;
  }
  const selected = data.selected;
  if (typeof selected === 'string') {
    return selected;
  }
  if (selected && typeof selected === 'object') {
    return selected.pathId || selected.id || selected.value || data.evaluations?.[0]?.pathId || '';
  }
  return data.evaluations?.[0]?.pathId || '';
}

// ============ 基础 Agent（用于各轮调用） ============

export function createStoryPlannerAgent(profile: LLMProfile = 'primary') {
  return new Agent({
    name: "story-planner",
    instructions: promptManager.build('story-planner.instructions').user,
    model: buildMastraModelConfig(profile),
  });
}

export const storyPlannerAgent = createStoryPlannerAgent();

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
  locale: Locale = DEFAULT_LOCALE,
  callbacks?: ToTProgressCallbacks
): Promise<NarrativePlan> {
  console.log("[ToT] 🌳 开始 Tree-of-Thoughts 规划...");

  // ============ Round 1: 生成候选叙事方向 ============
  console.log("[ToT] Round 1: 生成候选叙事方向...");
  callbacks?.onRoundStart?.('round1');
  
  const { user: generatePrompt } = promptManager.build('story-planner.generate-candidates', {
    worldBible: JSON.stringify(input.worldBible, null, 2),
    characterDB: JSON.stringify(input.characterDB, null, 2),
    styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
  }, locale);

  let candidates: z.infer<typeof CandidatePathsSchema>;
  try {
    candidates = await generateStructuredOutput(
      agent,
      generatePrompt,
      CandidatePathsSchema,
      { temperature: 1 }
    );
  } catch (error) {
    console.warn("[ToT] ⚠️ Round 1 解析失败，回退到默认候选:", error instanceof Error ? error.message : error);
    candidates = createFallbackCandidates(input);
  }
  callbacks?.onRoundComplete?.('round1', { candidates: candidates.paths });
  
  console.log(`[ToT] Round 1 完成: 生成了 ${candidates.paths.length} 个候选方向`);
  candidates.paths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.description}`);
  });

  // ============ Round 2: 评估每个候选方向 ============
  console.log("[ToT] Round 2: 评估候选方向...");
  callbacks?.onRoundStart?.('round2', { candidates });
  
  const { user: evaluatePrompt } = promptManager.build('story-planner.evaluate', {
    candidateCount: String(candidates.paths.length),
    candidates: JSON.stringify(candidates.paths, null, 2),
    characterCount: String(input.characterDB.characters?.length || 0),
    sceneCount: String(input.worldBible.scenes?.length || 0),
    styles: input.styleGuide?.styles?.join(', ') || '无',
    tone: input.styleGuide?.tone || '无',
  }, locale);

  let evaluation: { evaluations: any[]; selectedPathId: string; selectionReasoning: string };
  try {
    evaluation = await generateStructuredOutput(
      agent,
      evaluatePrompt,
      AllEvaluationsSchema,
      { temperature: 1 }
    );
  } catch (error) {
    console.warn("[ToT] ⚠️ Round 2 解析失败，回退到默认评估:", error instanceof Error ? error.message : error);
    evaluation = createFallbackEvaluation(candidates.paths);
  }
function createFallbackCandidates(input: WorkflowInput) {
  const worldName = input.worldBible?.name || '故事世界';
  const mainScene = input.worldBible?.scenes?.[0]?.name || '起始场景';
  return {
    paths: [
      {
        id: 'path-1',
        name: `${worldName} · 主线探秘`,
        description: `围绕 ${worldName} 的核心秘密展开线性推进`,
        premise: `主角在 ${worldName} 追寻真相`,
        centralConflict: '真相与代价的取舍',
        potentialEndings: ['解锁真相', '陷入更深阴谋'],
      },
      {
        id: 'path-2',
        name: `${mainScene} · 关系冲突`,
        description: `以人际关系为驱动力的情感主线`,
        premise: `在 ${mainScene} 中伙伴间的信任考验`,
        centralConflict: '信任与背叛',
        potentialEndings: ['羁绊更深', '关系破裂'],
      },
      {
        id: 'path-3',
        name: `系统对抗`,
        description: '聚焦与权威系统的博弈与反击',
        premise: '主角对抗掌控一切的系统',
        centralConflict: '自由与控制',
        potentialEndings: ['推翻系统', '被系统同化'],
      },
    ],
  };
}

function createFallbackEvaluation(paths: any[]) {
  const safePaths = Array.isArray(paths) ? paths : [];
  const evaluations = safePaths.map((path, idx) => ({
    pathId: path.id || path.name || `path-${idx + 1}`,
    scores: {
      dramatic: 3,
      characterFit: 3,
      branchPotential: 3,
      thematicDepth: 3,
    },
    totalScore: 12,
    reasoning: 'Fallback evaluation',
  }));

  const selectedPathId = evaluations[0]?.pathId || safePaths[0]?.id || 'path-1';

  return {
    evaluations,
    selectedPathId,
    selectionReasoning: '使用默认评分，选择首个候选方向',
  };
}

function createFallbackPlan(input: WorkflowInput, selectedPath: any): NarrativePlan {
  const premise = selectedPath?.premise || `一个发生在 ${input.worldBible?.name || '世界'} 的故事`;
  const conflict = selectedPath?.centralConflict || '角色与系统之间的冲突';
  const sceneName = input.worldBible?.scenes?.[0]?.name || '默认场景';

  const startId = 'node-start';
  const branchId = 'node-branch';
  const endingA = 'node-ending-a';
  const endingB = 'node-ending-b';

  return {
    outline: {
      premise,
      centralConflict: conflict,
      thematicArc: selectedPath?.description || '自我觉醒与成长',
    },
    nodes: [
      {
        id: startId,
        type: 'scene',
        isStart: true,
        isEnding: false,
        title: '故事开端',
        brief: '主角接触到世界规则的裂缝',
        functionTag: 'setup',
        sceneName,
        nextNodeId: branchId,
        choicesMeta: [],
        position: { x: 0, y: 0 },
      },
      {
        id: branchId,
        type: 'branch',
        isStart: false,
        isEnding: false,
        title: '关键抉择',
        brief: '主角面临选择，决定故事走向',
        functionTag: 'conflict',
        sceneName,
        nextNodeId: undefined,
        choicesMeta: [
          { id: 'choice-a', leadsTo: endingA, text: '接受规则' },
          { id: 'choice-b', leadsTo: endingB, text: '冲破规则' },
        ],
        position: { x: 0, y: 200 },
      },
      {
        id: endingA,
        type: 'ending',
        isStart: false,
        isEnding: true,
        title: '顺从结局',
        brief: '主角选择守护现状，付出自我',
        functionTag: 'resolution',
        sceneName,
        choicesMeta: [],
        nextNodeId: undefined,
        position: { x: -150, y: 350 },
      },
      {
        id: endingB,
        type: 'ending',
        isStart: false,
        isEnding: true,
        title: '反抗结局',
        brief: '主角冲破系统，开启新的秩序',
        functionTag: 'resolution',
        sceneName,
        choicesMeta: [],
        nextNodeId: undefined,
        position: { x: 150, y: 350 },
      },
    ],
  };
}
  callbacks?.onRoundComplete?.('round2', { evaluation });
  
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
  callbacks?.onRoundStart?.('round3', { selectedPath });
  
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

  let plan: NarrativePlan;
  try {
    plan = await generateStructuredOutput(
      agent,
      expandPrompt,
      NarrativePlanSchema,
      { temperature: 1 }
    );
  } catch (error) {
    console.warn("[ToT] ⚠️ Round 3 解析失败，回退到默认故事骨架:", error instanceof Error ? error.message : error);
    plan = createFallbackPlan(input, selectedPath);
  }
  callbacks?.onRoundComplete?.('round3', { plan });
  
  console.log(`[ToT] Round 3 完成: 生成了 ${plan.nodes.length} 个节点`);
  console.log(`[ToT] 🌳 ToT 规划完成!`);
  console.log(`  - 背景设定: ${plan.outline.premise.slice(0, 50)}...`);
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
