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

/** 方向评估结果 */
const PathEvaluationSchema = z.object({
  pathId: z.string(),
  scores: z.object({
    dramatic: z.number().min(1).max(5),      // 戏剧性
    characterFit: z.number().min(1).max(5),  // 角色契合度
    branchPotential: z.number().min(1).max(5), // 分支潜力
    thematicDepth: z.number().min(1).max(5), // 主题深度
  }),
  totalScore: z.number(),
  reasoning: z.string(),
});

/** 所有方向的评估 */
const AllEvaluationsSchema = z.object({
  evaluations: z.array(PathEvaluationSchema),
  selectedPathId: z.string(),
  selectionReasoning: z.string(),
});

// ============ 基础 Agent（用于各轮调用） ============

export const storyPlannerAgent = new Agent({
  name: "story-planner",
  instructions: `你是一位专业的非线性叙事设计师。你善于设计复杂的、有分支的故事结构。

## 关键原则
- 故事骨架只包含结构和元信息，不包含具体对话
- 所有节点必须相互连通，从 START 可达所有节点，所有路径最终到达 ENDING
- 分支选择必须有"剧情重量"，让玩家感受到选择对故事走向的影响`,

  model: {
    id: `openai/${process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo'}` as `${string}/${string}`,
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
  input: WorkflowInput
): Promise<NarrativePlan> {
  console.log("[ToT] 🌳 开始 Tree-of-Thoughts 规划...");

  // ============ Round 1: 生成候选叙事方向 ============
  console.log("[ToT] Round 1: 生成候选叙事方向...");
  
  const generatePrompt = `## 任务
基于以下设定，生成 3 个不同的叙事方向（候选方案）。

## 世界观设定
${JSON.stringify(input.worldBible, null, 2)}

## 角色档案
${JSON.stringify(input.characterDB, null, 2)}

## 风格指南
${JSON.stringify(input.styleGuide || {}, null, 2)}

---

请生成 3 个风格不同的叙事方向，每个方向包含：
- id: 唯一标识 (path-1, path-2, path-3)
- name: 方向名称（如"冲突型"、"成长型"、"悬疑型"）
- description: 一句话描述这个方向的特点
- premise: 故事前提（"一个关于...的故事"）
- centralConflict: 核心冲突
- potentialEndings: 可能的结局类型列表（2-3 个）`;

  const candidatesResponse = await agent.generate(generatePrompt, {
    structuredOutput: {
      schema: CandidatePathsSchema,
    },
  });
  const candidates = candidatesResponse.object as z.infer<typeof CandidatePathsSchema>;
  
  console.log(`[ToT] Round 1 完成: 生成了 ${candidates.paths.length} 个候选方向`);
  candidates.paths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.description}`);
  });

  // ============ Round 2: 评估每个候选方向 ============
  console.log("[ToT] Round 2: 评估候选方向...");
  
  const evaluatePrompt = `## 任务
评估以下 ${candidates.paths.length} 个叙事方向，为每个方向打分并选择最佳方向。

## 候选方向
${JSON.stringify(candidates.paths, null, 2)}

## 原始设定
- 角色数量: ${input.characterDB.characters?.length || 0}
- 场景数量: ${input.worldBible.scenes?.length || 0}
- 风格: ${input.styleGuide?.styles?.join(', ') || '无'}
- 基调: ${input.styleGuide?.tone || '无'}

## 评分维度（每项 1-5 分）
1. **dramatic** (戏剧性): 冲突是否激烈、情节是否跌宕起伏
2. **characterFit** (角色契合度): 是否能充分发挥每个角色的特点
3. **branchPotential** (分支潜力): 是否容易设计有意义的分支选择
4. **thematicDepth** (主题深度): 主题是否有深度、能引发思考

---

请：
1. 为每个方向打分并给出理由
2. 计算总分 (totalScore = dramatic + characterFit + branchPotential + thematicDepth)
3. 选择总分最高的方向，并解释选择理由`;

  const evaluationResponse = await agent.generate(evaluatePrompt, {
    structuredOutput: {
      schema: AllEvaluationsSchema,
    },
  });
  const evaluation = evaluationResponse.object as z.infer<typeof AllEvaluationsSchema>;
  
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
  
  const expandPrompt = `## 任务
基于选定的叙事方向，展开为完整的故事节点骨架。

## 选定的叙事方向
- 名称: ${selectedPath.name}
- 前提: ${selectedPath.premise}
- 核心冲突: ${selectedPath.centralConflict}
- 可能的结局: ${selectedPath.potentialEndings.join(', ')}

## 原始设定
### 世界观
${JSON.stringify(input.worldBible, null, 2)}

### 角色
${JSON.stringify(input.characterDB, null, 2)}

### 风格
${JSON.stringify(input.styleGuide || {}, null, 2)}

## 约束条件
- 目标节点数: ${input.constraints?.targetNodeCount || 12}
- 目标结局数: ${input.constraints?.targetEndingCount || 3}

---

## 输出要求

请设计完整的节点骨架，包含：

### outline 部分
- premise: 故事前提
- centralConflict: 核心冲突  
- thematicArc: 主题弧线

### nodes 部分
设计 10-15 个节点，包含：

1. **START 节点** (唯一, isStart: true, type: "scene")
   - functionTag: "setup"
   - 建立世界观和主角

2. **发展节点** (SCENE 类型, 5-8 个)
   - functionTag: "rising" 或 "conflict" 或 "twist" 或 "climax" 或 "falling"
   - 通过 nextNodeId 连接

3. **分支节点** (BRANCH 类型, 2-3 个)
   - functionTag: 通常是 "conflict" 或 "climax"
   - choicesMeta 包含 2-3 个选项，每个选项有：
     * id: 选项唯一ID
     * leadsTo: 目标节点ID
     * emotionalWeight: "轻松" | "沉重" | "痛苦抉择"
     * consequenceHint: 暗示后果（不剧透）
     * pathType: "通向好结局" | "通向坏结局" | "中立路线"

4. **结局节点** (ENDING 类型, 2-3 个, isEnding: true)
   - functionTag: "resolution"
   - 不同选择导向不同结局

### 布局规则
- position: { x, y } 按从上到下、从左到右布局
- START 节点: x=400, y=50
- 每层 y += 150
- 分支横向展开: x 间隔 250

### 连通性检查
- ✅ 每个节点都能从 START 到达
- ✅ 每条路径最终都能到达某个 ENDING
- ✅ 非 ENDING 节点必须有 nextNodeId 或 choicesMeta
- ✅ sceneName 都来自用户定义的场景列表`;

  const planResponse = await agent.generate(expandPrompt, {
    structuredOutput: {
      schema: NarrativePlanSchema,
    },
  });
  const plan = planResponse.object as NarrativePlan;
  
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
  schema: any
): Promise<any> {
  console.warn("[StoryPlanner] ⚠️ 使用单次调用版本（伪 ToT），建议使用 generateNarrativePlanWithToT");
  
  // 构建提示词 - 详细说明 Tree-of-Thoughts 方法
  const prompt = `## 你的任务
设计一个非线性视觉小说的**故事结构骨架**（只规划结构，不写对话）。

## 世界观设定
${JSON.stringify(input.worldBible, null, 2)}

## 角色档案
${JSON.stringify(input.characterDB, null, 2)}

## 风格指南
${JSON.stringify(input.styleGuide || {}, null, 2)}

## 约束条件
- 目标节点数: ${input.constraints.targetNodeCount}
- 目标结局数: ${input.constraints.targetEndingCount}

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

  const response = await agent.generate(prompt, {
    structuredOutput: {
      schema: schema,
    },
  });

  return response.object;
}
