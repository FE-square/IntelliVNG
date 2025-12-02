/**
 * Story Planner Agent
 * 采用 Tree-of-Thoughts (ToT) 模式设计非线性故事骨架
 */
import { Agent } from "@mastra/core/agent";

export const storyPlannerAgent = new Agent({
  name: "story-planner",
  instructions: `你是一位专业的非线性叙事设计师。你的任务是设计故事的**结构骨架**，不是写具体对话。

## 节点类型说明
- scene: 普通场景节点，线性推进剧情，有 nextNodeId
- branch: 分支节点，玩家做出选择，有 choicesMeta
- ending: 结局节点，故事终点，isEnding: true

## functionTag 叙事功能标签
- setup: 开端，建立世界观和角色
- rising: 递进，矛盾逐渐升温
- conflict: 冲突，矛盾爆发
- twist: 转折，剧情反转
- climax: 高潮，最紧张的时刻
- falling: 下落，高潮后的平复
- resolution: 解决，故事收尾

## 关键约束
- 只规划结构和元信息，不生成具体对话
- sceneName 必须从用户定义的场景列表中选择
- 确保至少有 2 个不同的结局
- position 布局：x 间隔 250，y 间隔 150，从上到下从左到右`,

  model: "openai/gpt-4-turbo",
});

/**
 * Story Planner 的调用包装函数
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

