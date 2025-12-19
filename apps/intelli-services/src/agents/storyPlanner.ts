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
import { tokenTracker } from '../services/token-tracker';

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
  earlyBranchingOpportunities: z.array(z.string()).optional().describe("故事前半段可设置的分支点描述"),
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
  const desiredNodeCount = Math.max(12, input.constraints?.targetNodeCount || 12);
  const desiredEndingCount = Math.max(2, input.constraints?.targetEndingCount || 3);

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
    candidates = createFallbackCandidates(input, locale);
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
    evaluation = createFallbackEvaluation(candidates.paths, locale);
  }
function createFallbackCandidates(input: WorkflowInput, locale: Locale = DEFAULT_LOCALE) {
  const isCN = locale.includes('zh');
  const worldName = input.worldBible?.name || (isCN ? '故事世界' : 'Story World');
  const mainScene = input.worldBible?.scenes?.[0]?.name || (isCN ? '起始场景' : 'Starting Scene');
  
  return {
    paths: [
      {
        id: 'path-1',
        name: isCN ? `${worldName} · 主线探秘` : `${worldName} · Main Mystery`,
        description: isCN ? `围绕 ${worldName} 的核心秘密展开线性推进` : `Linear progression centered on the core secrets of ${worldName}`,
        premise: isCN ? `主角在 ${worldName} 追寻真相` : `The protagonist seeks the truth in ${worldName}`,
        centralConflict: isCN ? '真相与代价的取舍' : 'The choice between truth and its cost',
        potentialEndings: isCN ? ['解锁真相', '陷入更深阴谋'] : ['Unlock the truth', 'Fall into deeper conspiracy'],
      },
      {
        id: 'path-2',
        name: isCN ? `${mainScene} · 关系冲突` : `${mainScene} · Relationship Conflict`,
        description: isCN ? `以人际关系为驱动力的情感主线` : `An emotional plot driven by interpersonal relationships`,
        premise: isCN ? `在 ${mainScene} 中伙伴间的信任考验` : `A test of trust between companions in ${mainScene}`,
        centralConflict: isCN ? '信任与背叛' : 'Trust and betrayal',
        potentialEndings: isCN ? ['羁绊更深', '关系破裂'] : ['Deeper bonds', 'Relationship breakdown'],
      },
      {
        id: 'path-3',
        name: isCN ? `系统对抗` : `System Opposition`,
        description: isCN ? '聚焦与权威系统的博弈与反击' : 'Focus on game and counter-strikes against authoritarian systems',
        premise: isCN ? '主角对抗掌控一切的系统' : 'The protagonist opposes the system that controls everything',
        centralConflict: isCN ? '自由与控制' : 'Freedom and control',
        potentialEndings: isCN ? ['推翻系统', '被系统同化'] : ['Overthrow the system', 'Assimilated by the system'],
      },
    ],
  };
}

function createFallbackEvaluation(paths: any[], locale: Locale = DEFAULT_LOCALE) {
  const isCN = locale.includes('zh');
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
    reasoning: isCN ? '默认评估' : 'Fallback evaluation',
  }));

  const selectedPathId = evaluations[0]?.pathId || safePaths[0]?.id || 'path-1';

  return {
    evaluations,
    selectedPathId,
    selectionReasoning: isCN ? '使用默认评分，选择首个候选方向' : 'Using default scores, selecting the first candidate path',
  };
}

function createFallbackPlan(input: WorkflowInput, selectedPath: any, locale: Locale = DEFAULT_LOCALE): NarrativePlan {
  /**
   * 重要：旧版本 fallback 只有 4 个节点（start → branch → 2 endings），会导致“伪非线性”的灾难产出。
   * 这里升级为：即使 LLM 完全失败，也至少生成一个具备早期分支、多条路线、多个结局的安全骨架，
   * 并尽量满足 constraints.targetNodeCount/targetEndingCount。
   */

  // 判断是否为中文
  const isCN = locale.includes('zh');

  const premise = selectedPath?.premise || 
    (isCN 
      ? `一个发生在 ${input.worldBible?.name || '世界'} 的故事`
      : `A story set in ${input.worldBible?.name || 'the world'}`);
  
  const conflict = selectedPath?.centralConflict || 
    (isCN ? '角色与系统之间的冲突' : 'Conflict between characters and the system');
  
  const scenes: string[] = (input.worldBible?.scenes || [])
    .map((s: any) => s?.name)
    .filter(Boolean);

  const pickScene = (idx: number) => {
    if (scenes.length > 0) return scenes[idx % scenes.length];
    return input.worldBible?.name || (isCN ? '默认场景' : 'Default Scene');
  };

  const targetNodeCount = Math.max(12, input.constraints?.targetNodeCount || 12);
  const targetEndingCount = Math.min(4, Math.max(2, input.constraints?.targetEndingCount || 3));

  const outline = {
    premise,
    centralConflict: conflict,
    thematicArc: selectedPath?.description || (isCN ? '在压抑中寻找救赎与共存' : 'Seeking redemption and coexistence under oppression'),
  };

  // 基础骨架（11 + endings），可按 targetNodeCount 追加若干“过渡 scene”
  const startId = 'node-start';
  const b1 = 'node-branch-1';
  const a1 = 'node-a-1';
  const b1s = 'node-b-1';
  const b2a = 'node-branch-2a';
  const b2b = 'node-branch-2b';
  const a2 = 'node-a-2';
  const a3 = 'node-a-3';
  const b2 = 'node-b-2';
  const b3 = 'node-b-3';
  const bFinal = 'node-branch-final';

  const endings = Array.from({ length: targetEndingCount }).map((_, i) => `node-ending-${i + 1}`);

  const nodes: any[] = [
    {
      id: startId,
      type: 'scene',
      isStart: true,
      isEnding: false,
      title: isCN ? '故事开端' : 'Story Beginning',
      brief: isCN ? '主角被迫直面世界规则的裂缝与代价' : "The protagonist confronts a crack in the world's rules—and its cost",
      functionTag: 'setup',
      sceneName: pickScene(0),
      nextNodeId: b1,
      choicesMeta: [],
      position: { x: 400, y: 50 },
    },
    {
      id: b1,
      type: 'branch',
      isStart: false,
      isEnding: false,
      title: isCN ? '第一幕分支：选择路线' : 'Act 1 Branch: Choose a Route',
      brief: isCN ? '早期选择将导向不同路线，并影响后续信息/关系走向' : 'An early choice splits routes and shapes info/relationships later',
      functionTag: 'rising',
      sceneName: pickScene(0),
      choicesMeta: [
        { id: 'choice-route-a', leadsTo: a1, emotionalWeight: isCN ? '沉重' : 'heavy', consequenceHint: isCN ? '你将更快接触真相，但风险更高' : 'Faster truth, higher risk', branchType: 'route', impactDescription: isCN ? '开启“直面真相”路线' : 'Opens the “truth-forward” route' },
        { id: 'choice-route-b', leadsTo: b1s, emotionalWeight: isCN ? '痛苦抉择' : 'hard choice', consequenceHint: isCN ? '你将更安全，但可能错失关键线索' : 'Safer, but may miss key clues', branchType: 'route', impactDescription: isCN ? '开启“稳健生存”路线' : 'Opens the “survival-first” route' },
      ],
      position: { x: 400, y: 200 },
    },
    {
      id: a1,
      type: 'scene',
      title: isCN ? '路线A：追索线索' : 'Route A: Pursue Leads',
      brief: isCN ? '主角选择主动追索线索，触发更高压的对抗' : 'Proactively pursuing leads escalates confrontation early',
      functionTag: 'rising',
      sceneName: pickScene(1),
      nextNodeId: b2a,
      position: { x: 150, y: 350 },
    },
    {
      id: b1s,
      type: 'scene',
      title: isCN ? '路线B：寻找盟友' : 'Route B: Seek Allies',
      brief: isCN ? '主角选择稳妥结盟，优先建立关系与资源' : 'Building alliances first shapes relationships and resources',
      functionTag: 'rising',
      sceneName: pickScene(2),
      nextNodeId: b2b,
      position: { x: 650, y: 350 },
    },
    {
      id: b2a,
      type: 'branch',
      title: isCN ? '第二幕分支：信息抉择' : 'Act 2 Branch: Information Choice',
      brief: isCN ? '选择公开/隐匿信息，将改变敌我对抗节奏' : 'Reveal vs conceal changes pacing and threats',
      functionTag: 'conflict',
      sceneName: pickScene(1),
      choicesMeta: [
        { id: 'choice-info-reveal', leadsTo: a2, emotionalWeight: isCN ? '沉重' : 'heavy', consequenceHint: isCN ? '曝光会引发冲突升级' : 'Revealing escalates conflict', branchType: 'information', impactDescription: isCN ? '获得更快推进，但带来更大追捕压力' : 'Faster progress, higher pursuit pressure' },
        { id: 'choice-info-hide', leadsTo: a3, emotionalWeight: isCN ? '痛苦抉择' : 'hard choice', consequenceHint: isCN ? '隐匿更安全，但真相可能被扭曲' : 'Safer, but truth may be distorted', branchType: 'information', impactDescription: isCN ? '延后真相揭示，换取资源积累' : 'Delay truth for resource buildup' },
      ],
      position: { x: 150, y: 500 },
    },
    {
      id: b2b,
      type: 'branch',
      title: isCN ? '第二幕分支：关系抉择' : 'Act 2 Branch: Relationship Choice',
      brief: isCN ? '选择信任谁，将决定团队结构与关键支援' : 'Who you trust determines the team and key support',
      functionTag: 'conflict',
      sceneName: pickScene(2),
      choicesMeta: [
        { id: 'choice-rel-trust', leadsTo: b2, emotionalWeight: isCN ? '沉重' : 'heavy', consequenceHint: isCN ? '信任会带来力量，也可能被背叛' : 'Trust brings strength and risk', branchType: 'relationship', impactDescription: isCN ? '强化团队协作线' : 'Strengthens cooperation route' },
        { id: 'choice-rel-distance', leadsTo: b3, emotionalWeight: isCN ? '轻松' : 'light', consequenceHint: isCN ? '保持距离更安全，但缺少支援' : 'Safer distance, less support', branchType: 'relationship', impactDescription: isCN ? '走向更独行的对抗路线' : 'Leans into lone-wolf conflict route' },
      ],
      position: { x: 650, y: 500 },
    },
    {
      id: a2,
      type: 'scene',
      title: isCN ? '路线A：冲突升级' : 'Route A: Escalation',
      brief: isCN ? '公开信息引发对抗升级，主角被迫付出代价' : 'Revealing triggers escalation; the protagonist pays a price',
      functionTag: 'twist',
      sceneName: pickScene(3),
      nextNodeId: bFinal,
      position: { x: 0, y: 650 },
    },
    {
      id: a3,
      type: 'scene',
      title: isCN ? '路线A：暗线推进' : 'Route A: Shadow Progression',
      brief: isCN ? '隐匿信息换取资源，但真相被更深埋藏' : 'Conceal for resources; truth gets buried deeper',
      functionTag: 'twist',
      sceneName: pickScene(3),
      nextNodeId: bFinal,
      position: { x: 250, y: 650 },
    },
    {
      id: b2,
      type: 'scene',
      title: isCN ? '路线B：盟友之力' : "Route B: Allies' Strength",
      brief: isCN ? '信任带来关键支援，关系推动剧情发生质变' : 'Trust unlocks crucial support; relationships reshape the plot',
      functionTag: 'twist',
      sceneName: pickScene(4),
      nextNodeId: bFinal,
      position: { x: 550, y: 650 },
    },
    {
      id: b3,
      type: 'scene',
      title: isCN ? '路线B：孤注一掷' : 'Route B: Going Alone',
      brief: isCN ? '保持距离让主角更孤独，但也更自由' : 'Distance makes the protagonist lonelier—but freer',
      functionTag: 'twist',
      sceneName: pickScene(4),
      nextNodeId: bFinal,
      position: { x: 800, y: 650 },
    },
    {
      id: bFinal,
      type: 'branch',
      title: isCN ? '第三幕分支：最终选择' : 'Act 3 Branch: Final Choice',
      brief: isCN ? '多条路线汇合，基于之前选择导向不同结局' : 'Routes converge; endings reflect earlier choices',
      functionTag: 'climax',
      sceneName: pickScene(5),
      choicesMeta: endings.map((eid, i) => ({
        id: `choice-ending-${i + 1}`,
        leadsTo: eid,
        emotionalWeight: isCN ? '痛苦抉择' : 'hard choice',
        consequenceHint: isCN ? '代价将落在某个不可逆的地方' : 'The cost will be irreversible',
        branchType: 'ending',
        impactDescription: isCN ? `导向结局 ${i + 1}` : `Leads to ending ${i + 1}`,
      })),
      position: { x: 400, y: 800 },
    },
    ...endings.map((eid, i) => ({
      id: eid,
      type: 'ending',
      isStart: false,
      isEnding: true,
      title: isCN ? `结局 ${i + 1}` : `Ending ${i + 1}`,
      brief: isCN
        ? `路线的自然结果之一：在“真相/共存/牺牲”的张力中收束。`
        : `A natural resolution: closure under tension of truth/coexistence/sacrifice.`,
      functionTag: 'resolution',
      sceneName: pickScene(6 + i),
      position: { x: 150 + i * 250, y: 950 },
    })),
  ];

  // 追加过渡 scene 以尽量满足 targetNodeCount（插在 a2/a3/b2/b3 → bFinal 之间）
  let currentCount = nodes.length;
  const bridgeTargets = [a2, a3, b2, b3];
  let bridgeIdx = 0;
  while (currentCount < targetNodeCount) {
    const fromId = bridgeTargets[bridgeIdx % bridgeTargets.length];
    const bridgeId = `node-bridge-${bridgeIdx + 1}`;
    const fromNode = nodes.find(n => n.id === fromId);
    if (!fromNode) break;

    const oldNext = fromNode.nextNodeId;
    fromNode.nextNodeId = bridgeId;

    const bridgeNode = {
      id: bridgeId,
      type: 'scene',
      title: isCN ? `过渡事件 ${bridgeIdx + 1}` : `Bridge Event ${bridgeIdx + 1}`,
      brief: isCN ? '补充推进与铺垫，用于稳定节奏与因果链' : 'Adds pacing and causality to stabilize progression',
      functionTag: 'falling',
      sceneName: pickScene(7 + bridgeIdx),
      nextNodeId: oldNext || bFinal,
      position: { x: (fromNode.position?.x ?? 400), y: (fromNode.position?.y ?? 650) + 120 },
    };
    nodes.push(bridgeNode);
    currentCount++;
    bridgeIdx++;
  }

  return { outline, nodes };
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
  
  const sceneNames =
    Array.isArray(input.worldBible?.scenes) && input.worldBible.scenes.length > 0
      ? JSON.stringify(input.worldBible.scenes.map((s: any) => s?.name).filter(Boolean), null, 2)
      : JSON.stringify([input.worldBible?.name || (locale.includes('zh') ? '默认场景' : 'Default Scene')], null, 2);

  const { user: expandPrompt } = promptManager.build('story-planner.expand', {
    selectedPathName: selectedPath.name,
    selectedPathPremise: selectedPath.premise,
    selectedPathConflict: selectedPath.centralConflict,
    selectedPathEndings: selectedPath.potentialEndings.join(', '),
    worldBible: JSON.stringify(input.worldBible, null, 2),
    characterDB: JSON.stringify(input.characterDB, null, 2),
    styleGuide: JSON.stringify(input.styleGuide || {}, null, 2),
    targetNodeCount: String(desiredNodeCount),
    targetEndingCount: String(desiredEndingCount),
    sceneNames,
  }, locale);

  let plan: NarrativePlan;
  const isPlanTooSmall = (p: NarrativePlan) => {
    const nodes = Array.isArray(p?.nodes) ? p.nodes : [];
    const branchCount = nodes.filter(n => n.type === 'branch').length;
    const endingCount = nodes.filter(n => n.isEnding).length;
    const hasStart = nodes.some(n => n.isStart);

    // 允许略小于目标，但绝不能回退到“4节点伪非线性”
    const minNodes = Math.max(10, Math.floor(desiredNodeCount * 0.7));
    const minBranches = 2;
    const minEndings = Math.max(2, Math.min(desiredEndingCount, 4));

    return !hasStart || nodes.length < minNodes || branchCount < minBranches || endingCount < minEndings;
  };

  const strictSuffix = `\n\n重要（硬约束检查）：\n- nodes 数组长度必须 >= ${Math.max(12, desiredNodeCount)}\n- branch 节点数量必须 >= 4\n- ending 节点数量必须 >= ${Math.max(2, Math.min(desiredEndingCount, 4))}\n- 必须从 START 早期就出现分支，禁止“最后才分叉”的伪非线性。\n- 只输出 JSON，不要 Markdown，不要 \`\`\` 代码块，不要解释。`;

  try {
    plan = await generateStructuredOutput(agent, expandPrompt, NarrativePlanSchema, { temperature: 1 });
    if (isPlanTooSmall(plan)) {
      console.warn("[ToT] ⚠️ Round 3 输出过小/结构不合格，触发强制重试（skipCache + fallbackOnly）");
      plan = await generateStructuredOutput(agent, expandPrompt + strictSuffix, NarrativePlanSchema, {
        temperature: 0.8,
        skipCache: true,
        disableStructuredOutput: true,
      });
    }
  } catch (error) {
    console.warn("[ToT] ⚠️ Round 3 解析失败，尝试强制重试（skipCache + fallbackOnly）:", error instanceof Error ? error.message : error);
    try {
      plan = await generateStructuredOutput(agent, expandPrompt + strictSuffix, NarrativePlanSchema, {
        temperature: 0.8,
        skipCache: true,
        disableStructuredOutput: true,
      });
    } catch (error2) {
      console.warn("[ToT] ❌ Round 3 重试仍失败，回退到本地安全骨架:", error2 instanceof Error ? error2.message : error2);
      plan = createFallbackPlan(input, selectedPath, locale);
    }
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

  // ✅ 追踪 Token 使用
  tokenTracker.trackMastraAgent({
    agentName: 'story-planner',
    model: 'gpt-4o',  // 从 agent 配置获取
    response,
    operation: 'story-planner.generate',
  });

  return response.object;
}
